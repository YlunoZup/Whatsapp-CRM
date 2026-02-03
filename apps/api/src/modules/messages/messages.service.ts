import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueueService } from '../../common/queue/queue.service';
import { SocketService } from '../../common/socket/socket.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ContactsService, SessionConflictResult } from '../contacts/contacts.service';

interface CreateMessageDto {
  tenantId: string;
  conversationId: string;
  whatsappMessageId?: string;
  direction?: 'inbound' | 'outbound';
  type: string;
  content?: string;
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
  forceSessionOverride?: boolean; // Force send even if session conflict exists
  skipSessionCheck?: boolean; // Skip session check (for internal use, e.g., incoming messages)
}

interface SendMessageDto {
  sessionId: string;
  to: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document';
  content?: string;
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
}

interface FindAllOptions {
  cursor?: string;
  limit?: number;
  direction?: 'before' | 'after';
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly socketService: SocketService,
    private readonly conversationsService: ConversationsService,
    private readonly contactsService: ContactsService,
  ) {}

  async findByConversation(conversationId: string, tenantId: string, options: FindAllOptions = {}) {
    const { cursor, direction = 'before' } = options;
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));

    // Verify conversation belongs to tenant
    await this.conversationsService.findOne(conversationId, tenantId);

    const where: Record<string, unknown> = { conversationId };

    if (cursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });

      if (cursorMessage) {
        where.createdAt = direction === 'before'
          ? { lt: cursorMessage.createdAt }
          : { gt: cursorMessage.createdAt };
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      take: limit,
      orderBy: { createdAt: direction === 'before' ? 'desc' : 'asc' },
    });

    // Always return in ascending order (oldest first)
    if (direction === 'before') {
      messages.reverse();
    }

    return {
      data: messages,
      pagination: {
        hasMore: messages.length === limit,
        cursor: messages.length > 0 ? messages[messages.length - 1]?.id : null,
      },
    };
  }

  async create(dto: CreateMessageDto) {
    const direction = dto.direction || 'outbound';

    // Get conversation to find session and contact
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: {
        contact: true,
        session: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // For outbound messages, validate that session and contact exist
    if (direction === 'outbound') {
      if (!conversation.session) {
        throw new BadRequestException('Cannot send message: No WhatsApp session is connected to this conversation');
      }
      if (!conversation.contact) {
        throw new BadRequestException('Cannot send message: No contact is associated with this conversation');
      }
      if (conversation.session.status !== 'connected') {
        throw new BadRequestException(`Cannot send message: WhatsApp session "${conversation.session.name}" is not connected (status: ${conversation.session.status})`);
      }
    }

    // SESSION BINDING CHECK - Only for outbound messages and if not skipped
    if (direction === 'outbound' && !dto.skipSessionCheck && conversation.contact && conversation.session) {
      const conflictResult = await this.contactsService.checkSessionConflict(
        conversation.contact.id,
        conversation.session.id,
        dto.tenantId,
      );

      if (conflictResult.hasConflict) {
        if (!dto.forceSessionOverride) {
          // Return the conflict info so the frontend can show a warning
          throw new BadRequestException({
            code: 'SESSION_CONFLICT',
            message: conflictResult.message,
            conflict: conflictResult,
          });
        }

        // Force override - reassign contact to new session
        this.logger.warn(
          `Force overriding session for contact ${conversation.contact.id}: ` +
          `${conflictResult.currentSession?.name} -> ${conflictResult.requestedSession?.name}`,
        );
        await this.contactsService.assignToSession(
          conversation.contact.id,
          conversation.session.id,
          dto.tenantId,
          true, // force
        );
      } else if (!conversation.contact.assignedSessionId) {
        // First time messaging this contact - assign the session automatically
        await this.contactsService.assignToSession(
          conversation.contact.id,
          conversation.session.id,
          dto.tenantId,
        );
        this.logger.log(
          `Auto-assigned contact ${conversation.contact.id} to session ${conversation.session.id}`,
        );
      }
    }

    const message = await this.prisma.message.create({
      data: {
        tenantId: dto.tenantId,
        conversationId: dto.conversationId,
        whatsappMessageId: dto.whatsappMessageId,
        direction,
        type: dto.type,
        content: dto.content,
        mediaUrl: dto.mediaUrl,
        status: direction === 'outbound' ? 'pending' : 'received',
        metadata: dto.metadata as any,
      } as any,
    });

    // Update conversation
    await this.conversationsService.updateLastMessageAt(dto.conversationId);

    if (direction === 'inbound') {
      await this.conversationsService.incrementUnreadCount(dto.conversationId);
    }

    // Emit real-time event to conversation room
    this.socketService.emitNewMessage(dto.conversationId, {
      conversationId: dto.conversationId,
      message: {
        id: message.id,
        content: message.content || '',
        type: message.type,
        direction: message.direction,
        status: message.status,
        createdAt: message.createdAt,
      },
    });

    // Also emit to tenant room for sidebar updates and cross-tab sync
    this.socketService.emitNewMessageToTenant(dto.tenantId, {
      conversationId: dto.conversationId,
      message: {
        id: message.id,
        content: message.content || '',
        type: message.type,
        direction: message.direction,
        status: message.status,
        createdAt: message.createdAt,
      },
    });

    // Queue outbound messages for WhatsApp sending
    if (direction === 'outbound' && dto.content && conversation.session && conversation.contact) {
      try {
        await this.queueService.addMessageJob({
          sessionId: conversation.session.id,
          to: conversation.contact.phone,
          message: dto.content,
          type: (dto.type as 'text' | 'image' | 'video' | 'audio' | 'document') || 'text',
          mediaUrl: dto.mediaUrl,
          metadata: { messageId: message.id },
        });
        this.logger.log(`Queued message ${message.id} for WhatsApp delivery via session ${conversation.session.id}`);
      } catch (error) {
        this.logger.error(`Failed to queue message ${message.id} for sending:`, error);
        // Update message status to failed
        await this.prisma.message.update({
          where: { id: message.id },
          data: { status: 'failed' },
        });
        throw new BadRequestException('Failed to queue message for delivery. Please try again.');
      }
    }

    return message;
  }

  /**
   * Check if sending a message would cause a session conflict
   * Returns conflict info if there's a conflict, null otherwise
   */
  async checkMessageSessionConflict(
    conversationId: string,
    tenantId: string,
  ): Promise<SessionConflictResult | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true,
        session: true,
      },
    });

    if (!conversation || !conversation.contact || !conversation.session) {
      return null;
    }

    const result = await this.contactsService.checkSessionConflict(
      conversation.contact.id,
      conversation.session.id,
      tenantId,
    );

    return result.hasConflict ? result : null;
  }

  async send(tenantId: string, dto: SendMessageDto) {
    // Queue the message for sending
    const job = await this.queueService.addMessageJob({
      sessionId: dto.sessionId,
      to: dto.to,
      message: dto.content || '',
      type: dto.type,
      mediaUrl: dto.mediaUrl,
      metadata: dto.metadata,
    });

    return {
      jobId: job.id,
      status: 'queued',
    };
  }

  async updateStatus(id: string, status: string, whatsappMessageId?: string) {
    const message = await this.prisma.message.update({
      where: { id },
      data: {
        status,
        ...(whatsappMessageId && { whatsappMessageId }),
      },
    });

    // Emit status update
    this.socketService.emitMessageStatusUpdate(message.conversationId, {
      conversationId: message.conversationId,
      messageId: message.id,
      status,
    });

    return message;
  }

  /**
   * Find a message by WhatsApp message ID
   * @param whatsappMessageId - The WhatsApp message ID
   * @param tenantId - Optional tenant ID for tenant isolation. If provided, only messages from that tenant will be returned.
   */
  async findByWhatsAppId(whatsappMessageId: string, tenantId?: string) {
    return this.prisma.message.findFirst({
      where: {
        whatsappMessageId,
        ...(tenantId && { tenantId }),
      },
    });
  }

  async delete(id: string, tenantId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        conversation: true,
      },
    });

    if (!message || message.conversation.tenantId !== tenantId) {
      throw new NotFoundException('Message not found');
    }

    await this.prisma.message.delete({
      where: { id },
    });

    return { success: true };
  }

  async forwardMessage(
    messageId: string,
    tenantId: string,
    targetIds: string[],
    targetType: 'conversation' | 'contact',
  ) {
    // Get original message
    const originalMessage = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: true,
      },
    });

    if (!originalMessage || originalMessage.conversation.tenantId !== tenantId) {
      throw new NotFoundException('Message not found');
    }

    const results = [];

    for (const targetId of targetIds) {
      try {
        let conversationId: string;

        if (targetType === 'conversation') {
          // Verify conversation exists
          const conversation = await this.prisma.conversation.findFirst({
            where: { id: targetId, tenantId },
          });
          if (!conversation) continue;
          conversationId = conversation.id;
        } else {
          // Find or create conversation with contact
          const contact = await this.prisma.contact.findFirst({
            where: { id: targetId, tenantId },
          });
          if (!contact) continue;

          // Find existing conversation or create new one
          let conversation = await this.prisma.conversation.findFirst({
            where: { contactId: contact.id, tenantId },
          });

          if (!conversation) {
            // Create new conversation - need a session
            const session = await this.prisma.whatsappSession.findFirst({
              where: { tenantId, status: 'connected' },
            });
            if (!session) continue;

            conversation = await this.prisma.conversation.create({
              data: {
                tenantId,
                sessionId: session.id,
                contactId: contact.id,
                status: 'open',
              },
            });
          }
          conversationId = conversation.id;
        }

        // Create forwarded message
        const forwardedMessage = await this.create({
          tenantId,
          conversationId,
          direction: 'outbound',
          type: originalMessage.type,
          content: originalMessage.content ? `[Forwarded]\n${originalMessage.content}` : '[Forwarded]',
          mediaUrl: originalMessage.mediaUrl,
          metadata: {
            forwarded: true,
            originalMessageId: messageId,
          },
        });

        results.push({
          targetId,
          success: true,
          messageId: forwardedMessage.id,
        });
      } catch (error) {
        results.push({
          targetId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      forwarded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async toggleStar(messageId: string, tenantId: string, isStarred: boolean) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message || message.conversation.tenantId !== tenantId) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        isStarred,
        starredAt: isStarred ? new Date() : null,
      },
    });
  }

  async getStarredMessages(
    tenantId: string,
    options: { conversationId?: string; limit?: number } = {},
  ) {
    const { conversationId } = options;
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));

    const where: Record<string, unknown> = {
      isStarred: true,
      conversation: {
        tenantId,
      },
    };

    if (conversationId) {
      where.conversationId = conversationId;
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { starredAt: 'desc' },
      take: limit,
      include: {
        conversation: {
          include: {
            contact: true,
          },
        },
      },
    });

    return {
      data: messages,
      total: messages.length,
    };
  }
}
