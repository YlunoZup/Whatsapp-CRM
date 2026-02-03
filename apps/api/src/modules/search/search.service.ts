import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SearchResults {
  conversations: Array<{
    id: string;
    contact: { id: string; name: string; phone: string };
    lastMessage?: { content: string; createdAt: Date };
  }>;
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string;
  }>;
  messages: Array<{
    id: string;
    content: string;
    conversationId: string;
    contactName: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, query: string, limit = 5): Promise<SearchResults> {
    const searchTerm = `%${query}%`;

    // Search conversations by contact name or phone
    const conversations = await this.prisma.conversation.findMany({
      where: {
        tenantId,
        contact: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
          ],
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        messages: {
          select: {
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    // Search contacts
    const contacts = await this.prisma.contact.findMany({
      where: {
        tenantId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
      take: limit,
      orderBy: { name: 'asc' },
    });

    // Search messages
    const messages = await this.prisma.message.findMany({
      where: {
        tenantId,
        content: { contains: query, mode: 'insensitive' },
        type: 'text', // Only search text messages
      },
      include: {
        conversation: {
          include: {
            contact: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return {
      conversations: conversations.map((conv) => ({
        id: conv.id,
        contact: conv.contact,
        lastMessage: conv.messages[0]
          ? {
              content: conv.messages[0].content,
              createdAt: conv.messages[0].createdAt,
            }
          : undefined,
      })),
      contacts,
      messages: messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        conversationId: msg.conversationId,
        contactName: msg.conversation.contact.name,
        createdAt: msg.createdAt,
      })),
    };
  }
}
