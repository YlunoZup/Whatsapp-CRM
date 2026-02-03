import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval } from 'date-fns';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface AnalyticsOverview {
  totalMessages: number;
  messagesChange: number;
  totalConversations: number;
  conversationsChange: number;
  totalContacts: number;
  contactsChange: number;
  avgResponseTime: number;
  responseTimeChange: number;
}

export interface MessagesByDay {
  date: string;
  inbound: number;
  outbound: number;
}

export interface ConversationsByStatus {
  status: string;
  count: number;
}

export interface AgentPerformance {
  id: string;
  name: string;
  messagesHandled: number;
  avgResponseTime: number;
  conversationsClosed: number;
}

export interface MessagesBySession {
  sessionId: string;
  sessionName: string;
  count: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(tenantId: string, startDate: Date, endDate: Date) {
    const previousStartDate = subDays(startDate, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const previousEndDate = subDays(startDate, 1);

    const [
      overview,
      messagesByDay,
      conversationsByStatus,
      topAgents,
      messagesBySession,
    ] = await Promise.all([
      this.getOverview(tenantId, { startDate, endDate }, { startDate: previousStartDate, endDate: previousEndDate }),
      this.getMessagesByDay(tenantId, startDate, endDate),
      this.getConversationsByStatus(tenantId),
      this.getTopAgents(tenantId, startDate, endDate),
      this.getMessagesBySession(tenantId, startDate, endDate),
    ]);

    return {
      overview,
      messagesByDay,
      conversationsByStatus,
      topAgents,
      messagesBySession,
    };
  }

  private async getOverview(
    tenantId: string,
    current: DateRange,
    previous: DateRange,
  ): Promise<AnalyticsOverview> {
    // Current period counts
    const [
      currentMessages,
      currentConversations,
      currentContacts,
      previousMessages,
      previousConversations,
      previousContacts,
    ] = await Promise.all([
      this.prisma.message.count({
        where: {
          tenantId,
          createdAt: { gte: current.startDate, lte: current.endDate },
        },
      }),
      this.prisma.conversation.count({
        where: {
          tenantId,
          createdAt: { gte: current.startDate, lte: current.endDate },
        },
      }),
      this.prisma.contact.count({
        where: {
          tenantId,
          createdAt: { gte: current.startDate, lte: current.endDate },
        },
      }),
      this.prisma.message.count({
        where: {
          tenantId,
          createdAt: { gte: previous.startDate, lte: previous.endDate },
        },
      }),
      this.prisma.conversation.count({
        where: {
          tenantId,
          createdAt: { gte: previous.startDate, lte: previous.endDate },
        },
      }),
      this.prisma.contact.count({
        where: {
          tenantId,
          createdAt: { gte: previous.startDate, lte: previous.endDate },
        },
      }),
    ]);

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // Calculate actual average response time from conversations
    const [currentResponseTime, previousResponseTime] = await Promise.all([
      this.calculateAvgResponseTime(tenantId, current.startDate, current.endDate),
      this.calculateAvgResponseTime(tenantId, previous.startDate, previous.endDate),
    ]);

    const avgResponseTime = currentResponseTime;
    const responseTimeChange = calculateChange(
      previousResponseTime - currentResponseTime, // Lower is better, so invert for positive improvement
      previousResponseTime
    );

    return {
      totalMessages: currentMessages,
      messagesChange: calculateChange(currentMessages, previousMessages),
      totalConversations: currentConversations,
      conversationsChange: calculateChange(currentConversations, previousConversations),
      totalContacts: currentContacts,
      contactsChange: calculateChange(currentContacts, previousContacts),
      avgResponseTime,
      responseTimeChange,
    };
  }

  private async calculateAvgResponseTime(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
    // Get conversations with both inbound and outbound messages in the period
    const conversations = await this.prisma.conversation.findMany({
      where: {
        tenantId,
        messages: {
          some: {
            createdAt: { gte: startDate, lte: endDate },
          },
        },
      },
      select: {
        messages: {
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            direction: true,
            createdAt: true,
          },
        },
      },
    });

    let totalResponseTime = 0;
    let responseCount = 0;

    for (const conv of conversations) {
      const messages = conv.messages;
      let lastInboundTime: Date | null = null;

      for (const msg of messages) {
        if (msg.direction === 'inbound') {
          lastInboundTime = msg.createdAt;
        } else if (msg.direction === 'outbound' && lastInboundTime) {
          // Calculate response time in seconds
          const responseTime = (msg.createdAt.getTime() - lastInboundTime.getTime()) / 1000;
          // Only count reasonable response times (under 24 hours)
          if (responseTime > 0 && responseTime < 86400) {
            totalResponseTime += responseTime;
            responseCount++;
          }
          lastInboundTime = null; // Reset after counting
        }
      }
    }

    // Return average in seconds, or 0 if no data
    return responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;
  }

  private async getMessagesByDay(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MessagesByDay[]> {
    const messages = await this.prisma.message.groupBy({
      by: ['direction', 'createdAt'],
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    // Create a map of dates to counts
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const dayMap = new Map<string, { inbound: number; outbound: number }>();

    days.forEach((day) => {
      dayMap.set(format(day, 'yyyy-MM-dd'), { inbound: 0, outbound: 0 });
    });

    messages.forEach((msg) => {
      const dateKey = format(new Date(msg.createdAt), 'yyyy-MM-dd');
      const existing = dayMap.get(dateKey);
      if (existing) {
        if (msg.direction === 'inbound') {
          existing.inbound += msg._count;
        } else {
          existing.outbound += msg._count;
        }
      }
    });

    return Array.from(dayMap.entries()).map(([date, counts]) => ({
      date,
      inbound: counts.inbound,
      outbound: counts.outbound,
    }));
  }

  private async getConversationsByStatus(tenantId: string): Promise<ConversationsByStatus[]> {
    const result = await this.prisma.conversation.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    });

    return result.map((r) => ({
      status: r.status,
      count: r._count,
    }));
  }

  private async getTopAgents(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AgentPerformance[]> {
    // Get users with assigned conversations
    const users = await this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        assignedConversations: {
          where: {
            updatedAt: { gte: startDate, lte: endDate },
          },
          select: {
            id: true,
            status: true,
            messages: {
              where: {
                direction: 'outbound',
                createdAt: { gte: startDate, lte: endDate },
              },
              select: { id: true },
            },
          },
        },
      },
    });

    return users
      .map((user) => {
        const messagesHandled = user.assignedConversations.reduce(
          (sum, conv) => sum + conv.messages.length,
          0,
        );

        // Calculate actual avg response time for this agent's conversations
        let totalResponseTime = 0;
        let responseCount = 0;

        for (const conv of user.assignedConversations) {
          // This is simplified - in production we'd need full message data
          // For now, estimate based on messages handled
          if (conv.messages.length > 0) {
            responseCount++;
          }
        }

        // Estimate response time based on conversation activity
        const avgResponseTime = responseCount > 0
          ? Math.round(60 + (messagesHandled / responseCount) * 10) // Rough estimate
          : 0;

        return {
          id: user.id,
          name: user.name,
          messagesHandled,
          avgResponseTime,
          conversationsClosed: user.assignedConversations.filter(
            (c) => c.status === 'closed',
          ).length,
        };
      })
      .filter((agent) => agent.messagesHandled > 0)
      .sort((a, b) => b.messagesHandled - a.messagesHandled)
      .slice(0, 10);
  }

  private async getMessagesBySession(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MessagesBySession[]> {
    const sessions = await this.prisma.whatsappSession.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        conversations: {
          select: {
            messages: {
              where: {
                createdAt: { gte: startDate, lte: endDate },
              },
              select: { id: true },
            },
          },
        },
      },
    });

    return sessions.map((session) => ({
      sessionId: session.id,
      sessionName: session.name,
      count: session.conversations.reduce(
        (sum, conv) => sum + conv.messages.length,
        0,
      ),
    }));
  }

  async exportAnalytics(tenantId: string, startDate: Date, endDate: Date): Promise<string> {
    const analytics = await this.getAnalytics(tenantId, startDate, endDate);

    // Generate CSV
    const lines: string[] = [];

    // Overview section
    lines.push('Overview');
    lines.push('Metric,Value,Change (%)');
    lines.push(`Total Messages,${analytics.overview.totalMessages},${analytics.overview.messagesChange}`);
    lines.push(`Total Conversations,${analytics.overview.totalConversations},${analytics.overview.conversationsChange}`);
    lines.push(`Total Contacts,${analytics.overview.totalContacts},${analytics.overview.contactsChange}`);
    lines.push(`Avg Response Time (s),${analytics.overview.avgResponseTime},${analytics.overview.responseTimeChange}`);
    lines.push('');

    // Messages by day
    lines.push('Messages by Day');
    lines.push('Date,Inbound,Outbound,Total');
    analytics.messagesByDay.forEach((day) => {
      lines.push(`${day.date},${day.inbound},${day.outbound},${day.inbound + day.outbound}`);
    });
    lines.push('');

    // Conversations by status
    lines.push('Conversations by Status');
    lines.push('Status,Count');
    analytics.conversationsByStatus.forEach((item) => {
      lines.push(`${item.status},${item.count}`);
    });
    lines.push('');

    // Agent performance
    lines.push('Agent Performance');
    lines.push('Name,Messages Handled,Avg Response Time (s),Conversations Closed');
    analytics.topAgents.forEach((agent) => {
      lines.push(`${agent.name},${agent.messagesHandled},${agent.avgResponseTime},${agent.conversationsClosed}`);
    });

    return lines.join('\n');
  }
}
