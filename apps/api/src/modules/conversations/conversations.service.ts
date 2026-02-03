import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService, AuditActions } from '../../common/audit/audit.service';

interface FindAllOptions {
  status?: string;
  sessionId?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}
  // Include contact.assignedSession in queries to show session binding in UI

  async findAll(tenantId: string, options: FindAllOptions = {}) {
    const { status, sessionId, assignedTo, search } = options;
    // Ensure page and limit are valid numbers with defaults
    const page = Math.max(1, parseInt(String(options.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(options.limit), 10) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (status) where.status = status;
    if (sessionId) where.sessionId = sessionId;
    if (assignedTo) where.assignedTo = assignedTo;

    if (search) {
      where.contact = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      };
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          contact: {
            include: {
              assignedSession: {
                select: {
                  id: true,
                  name: true,
                  phoneNumber: true,
                },
              },
            },
          },
          session: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        contact: {
          include: {
            assignedSession: {
              select: {
                id: true,
                name: true,
                phoneNumber: true,
              },
            },
          },
        },
        session: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async findByContactAndSession(contactId: string, sessionId: string, tenantId: string) {
    return this.prisma.conversation.findFirst({
      where: { contactId, sessionId, tenantId },
    });
  }

  async findOrCreate(tenantId: string, sessionId: string, contactId: string) {
    // Use transaction with retry to handle race conditions atomically
    return this.prisma.$transaction(async (tx) => {
      // Try to find existing conversation
      let conversation = await tx.conversation.findFirst({
        where: { contactId, sessionId, tenantId },
      });

      if (conversation) {
        return conversation;
      }

      // Create new conversation
      try {
        return await tx.conversation.create({
          data: {
            tenantId,
            sessionId,
            contactId,
            status: 'open',
            unreadCount: 0,
          },
        });
      } catch (error: any) {
        // Handle unique constraint violation (race condition - another request created it)
        if (error.code === 'P2002') {
          const existing = await tx.conversation.findFirst({
            where: { contactId, sessionId, tenantId },
          });
          if (existing) return existing;
        }
        throw error;
      }
    });
  }

  async update(id: string, tenantId: string, data: { status?: string; metadata?: Record<string, unknown> }) {
    await this.findOne(id, tenantId);

    return this.prisma.conversation.update({
      where: { id },
      data: data as any,
    });
  }

  async assign(id: string, tenantId: string, userId: string | null, actorUserId?: string) {
    const conversation = await this.findOne(id, tenantId);

    const result = await this.prisma.conversation.update({
      where: { id },
      data: { assignedTo: userId },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      userId: actorUserId,
      action: AuditActions.CONVERSATION_ASSIGNED,
      resource: 'conversation',
      resourceId: id,
      metadata: {
        assignedTo: userId,
        assignedUserName: result.assignedUser?.name || null,
        contactName: conversation.contact?.name,
      },
    });

    return result;
  }

  async close(id: string, tenantId: string, actorUserId?: string) {
    const conversation = await this.findOne(id, tenantId);

    const result = await this.prisma.conversation.update({
      where: { id },
      data: { status: 'closed' },
    });

    await this.auditService.log({
      tenantId,
      userId: actorUserId,
      action: AuditActions.CONVERSATION_CLOSED,
      resource: 'conversation',
      resourceId: id,
      metadata: {
        previousStatus: conversation.status,
        contactName: conversation.contact?.name,
      },
    });

    return result;
  }

  async reopen(id: string, tenantId: string, actorUserId?: string) {
    const conversation = await this.findOne(id, tenantId);

    const result = await this.prisma.conversation.update({
      where: { id },
      data: { status: 'open' },
    });

    await this.auditService.log({
      tenantId,
      userId: actorUserId,
      action: AuditActions.CONVERSATION_REOPENED,
      resource: 'conversation',
      resourceId: id,
      metadata: {
        previousStatus: conversation.status,
        contactName: conversation.contact?.name,
      },
    });

    return result;
  }

  async incrementUnreadCount(id: string) {
    return this.prisma.conversation.update({
      where: { id },
      data: {
        unreadCount: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });
  }

  async resetUnreadCount(id: string) {
    return this.prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }

  async updateLastMessageAt(id: string) {
    return this.prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });
  }

  async bulkUpdate(
    tenantId: string,
    ids: string[],
    data: {
      status?: string;
      priority?: string;
      label?: string | null;
      assignedTo?: string | null;
    },
    actorUserId?: string,
  ) {
    // Build update data - only include fields that are provided
    const updateData: Record<string, unknown> = {};
    const updatedFields: string[] = [];

    if (data.status !== undefined) {
      updateData.status = data.status;
      updatedFields.push('status');
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority;
      updatedFields.push('priority');
    }
    if (data.label !== undefined) {
      updateData.label = data.label;
      updatedFields.push('label');
    }
    if (data.assignedTo !== undefined) {
      updateData.assignedTo = data.assignedTo;
      updatedFields.push('assignedTo');
    }

    // Only update conversations that belong to this tenant
    const result = await this.prisma.conversation.updateMany({
      where: {
        id: { in: ids },
        tenantId,
      },
      data: updateData,
    });

    await this.auditService.log({
      tenantId,
      userId: actorUserId,
      action: AuditActions.CONVERSATIONS_BULK_UPDATED,
      resource: 'conversation',
      metadata: {
        count: result.count,
        conversationIds: ids,
        updatedFields,
        changes: data,
      },
    });

    return {
      updated: result.count,
      ids,
    };
  }

  async delete(id: string, tenantId: string, actorUserId?: string) {
    // First verify the conversation exists and belongs to this tenant
    const conversation = await this.findOne(id, tenantId);

    // Delete related records in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Delete reactions on messages in this conversation
      await tx.messageReaction.deleteMany({
        where: {
          message: {
            conversationId: id,
          },
        },
      });

      // Delete messages in this conversation
      await tx.message.deleteMany({
        where: { conversationId: id },
      });

      // Delete the conversation
      return tx.conversation.delete({
        where: { id },
      });
    });

    await this.auditService.log({
      tenantId,
      userId: actorUserId,
      action: AuditActions.CONVERSATION_DELETED,
      resource: 'conversation',
      resourceId: id,
      metadata: {
        contactName: conversation.contact?.name,
        contactPhone: conversation.contact?.phone,
        status: conversation.status,
      },
    });

    return result;
  }

  async bulkDelete(tenantId: string, ids: string[], actorUserId?: string) {
    // Verify all conversations belong to this tenant
    const conversations = await this.prisma.conversation.findMany({
      where: {
        id: { in: ids },
        tenantId,
      },
      select: { id: true },
    });

    const validIds = conversations.map((c) => c.id);

    if (validIds.length === 0) {
      return { deleted: 0, ids: [] };
    }

    // Delete in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Delete reactions
      await tx.messageReaction.deleteMany({
        where: {
          message: {
            conversationId: { in: validIds },
          },
        },
      });

      // Delete messages
      await tx.message.deleteMany({
        where: { conversationId: { in: validIds } },
      });

      // Delete conversations
      const deleteResult = await tx.conversation.deleteMany({
        where: { id: { in: validIds } },
      });

      return {
        deleted: deleteResult.count,
        ids: validIds,
      };
    });

    await this.auditService.log({
      tenantId,
      userId: actorUserId,
      action: AuditActions.CONVERSATIONS_BULK_DELETED,
      resource: 'conversation',
      metadata: {
        count: result.deleted,
        conversationIds: validIds,
      },
    });

    return result;
  }
}
