import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

interface DashboardStats {
  totalConversations: number;
  openConversations: number;
  totalContacts: number;
  totalMessages: number;
  messagesToday: number;
  activeSessions: number;
  totalSessions: number;
  responseRate: number;
}

interface ConversationTrend {
  date: string;
  count: number;
}

interface MessageTrend {
  date: string;
  inbound: number;
  outbound: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async getStats(tenantId: string): Promise<DashboardStats> {
    // Check cache first
    const cached = await this.cache.getDashboardStats(tenantId);
    if (cached) {
      return cached as DashboardStats;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalConversations,
      openConversations,
      totalContacts,
      totalMessages,
      messagesToday,
      sessions,
    ] = await Promise.all([
      // Total conversations
      this.prisma.conversation.count({ where: { tenantId } }),

      // Open conversations
      this.prisma.conversation.count({
        where: { tenantId, status: 'open' },
      }),

      // Total contacts
      this.prisma.contact.count({ where: { tenantId } }),

      // Total messages
      this.prisma.message.count({
        where: { conversation: { tenantId } },
      }),

      // Messages today
      this.prisma.message.count({
        where: {
          conversation: { tenantId },
          createdAt: { gte: today },
        },
      }),

      // Sessions
      this.prisma.whatsappSession.findMany({
        where: { tenantId },
        select: { status: true },
      }),
    ]);

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter((s) => s.status === 'connected').length;

    // Calculate response rate (outbound / inbound * 100)
    const [inboundCount, outboundCount] = await Promise.all([
      this.prisma.message.count({
        where: {
          conversation: { tenantId },
          direction: 'inbound',
        },
      }),
      this.prisma.message.count({
        where: {
          conversation: { tenantId },
          direction: 'outbound',
        },
      }),
    ]);

    const responseRate = inboundCount > 0 ? Math.round((outboundCount / inboundCount) * 100) : 0;

    const stats = {
      totalConversations,
      openConversations,
      totalContacts,
      totalMessages,
      messagesToday,
      activeSessions,
      totalSessions,
      responseRate,
    };

    // Cache for 60 seconds
    await this.cache.setDashboardStats(tenantId, stats);

    return stats;
  }

  async getConversationTrends(tenantId: string, days = 7): Promise<ConversationTrend[]> {
    const trends: ConversationTrend[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await this.prisma.conversation.count({
        where: {
          tenantId,
          createdAt: {
            gte: date,
            lt: nextDate,
          },
        },
      });

      trends.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    return trends;
  }

  async getMessageTrends(tenantId: string, days = 7): Promise<MessageTrend[]> {
    const trends: MessageTrend[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [inbound, outbound] = await Promise.all([
        this.prisma.message.count({
          where: {
            conversation: { tenantId },
            direction: 'inbound',
            createdAt: { gte: date, lt: nextDate },
          },
        }),
        this.prisma.message.count({
          where: {
            conversation: { tenantId },
            direction: 'outbound',
            createdAt: { gte: date, lt: nextDate },
          },
        }),
      ]);

      trends.push({
        date: date.toISOString().split('T')[0],
        inbound,
        outbound,
      });
    }

    return trends;
  }

  async getTopContacts(tenantId: string, limit = 5) {
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
      orderBy: {
        conversations: { _count: 'desc' },
      },
      take: limit,
    });

    return contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      conversationCount: contact._count.conversations,
    }));
  }

  async getRecentActivity(tenantId: string, limit = 10) {
    const messages = await this.prisma.message.findMany({
      where: {
        conversation: { tenantId },
      },
      include: {
        conversation: {
          include: {
            contact: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.map((msg) => ({
      id: msg.id,
      type: msg.type,
      direction: msg.direction,
      content: msg.content,
      createdAt: msg.createdAt,
      contact: msg.conversation.contact,
    }));
  }
}
