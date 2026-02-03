import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SocketService } from '../../common/socket/socket.service';
import { WhatsAppService } from '../../common/whatsapp/whatsapp.service';

const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '🎉', '💯'];

@Injectable()
export class ReactionsService {
  private readonly logger = new Logger(ReactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  async addReaction(messageId: string, userId: string, tenantId: string, emoji: string) {
    // Validate emoji
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      throw new BadRequestException(`Invalid emoji. Allowed emojis: ${ALLOWED_EMOJIS.join(', ')}`);
    }

    // Check if message exists and belongs to tenant, include session and contact info
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            session: true,
            contact: true,
          },
        },
      },
    });

    if (!message || message.conversation.tenantId !== tenantId) {
      throw new NotFoundException('Message not found');
    }

    // Create or update reaction (upsert)
    const reaction = await this.prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
      update: {},
      create: {
        messageId,
        userId,
        emoji,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Send reaction to WhatsApp if we have the WhatsApp message ID
    if (message.whatsappMessageId && message.conversation.session && message.conversation.contact) {
      try {
        const sessionId = message.conversation.session.id;
        const remoteJid = message.conversation.contact.whatsappId || message.conversation.contact.phone;
        // fromMe should be true if we're reacting to an outbound message (message we sent)
        const isOutboundMessage = message.direction === 'outbound';

        await this.whatsappService.sendReaction(
          sessionId,
          remoteJid,
          message.whatsappMessageId,
          emoji,
          isOutboundMessage, // Pass fromMe flag
        );
        this.logger.log(`Sent reaction ${emoji} to WhatsApp message ${message.whatsappMessageId} (outbound: ${isOutboundMessage})`);
      } catch (error) {
        this.logger.error(`Failed to send reaction to WhatsApp: ${error}`);
        // Don't throw - reaction is saved locally, WhatsApp send is best effort
      }
    }

    // Emit socket event
    this.socketService.emitToConversation(message.conversationId, 'reaction:added', {
      conversationId: message.conversationId,
      messageId,
      reaction: {
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        userName: reaction.user?.name,
      },
    });

    return reaction;
  }

  async removeReaction(messageId: string, userId: string, tenantId: string, emoji: string) {
    // Check if message exists and belongs to tenant, include session and contact info
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            session: true,
            contact: true,
          },
        },
      },
    });

    if (!message || message.conversation.tenantId !== tenantId) {
      throw new NotFoundException('Message not found');
    }

    try {
      await this.prisma.messageReaction.delete({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId,
            emoji,
          },
        },
      });

      // Remove reaction from WhatsApp (send empty string as emoji)
      if (message.whatsappMessageId && message.conversation.session && message.conversation.contact) {
        try {
          const sessionId = message.conversation.session.id;
          const remoteJid = message.conversation.contact.whatsappId || message.conversation.contact.phone;
          // fromMe should be true if we're removing reaction from an outbound message (message we sent)
          const isOutboundMessage = message.direction === 'outbound';

          await this.whatsappService.sendReaction(
            sessionId,
            remoteJid,
            message.whatsappMessageId,
            '', // Empty string removes the reaction
            isOutboundMessage, // Pass fromMe flag
          );
          this.logger.log(`Removed reaction from WhatsApp message ${message.whatsappMessageId} (outbound: ${isOutboundMessage})`);
        } catch (error) {
          this.logger.error(`Failed to remove reaction from WhatsApp: ${error}`);
          // Don't throw - reaction is removed locally, WhatsApp update is best effort
        }
      }

      // Emit socket event
      this.socketService.emitToConversation(message.conversationId, 'reaction:removed', {
        conversationId: message.conversationId,
        messageId,
        userId,
        emoji,
      });

      return { success: true };
    } catch {
      throw new NotFoundException('Reaction not found');
    }
  }

  async getReactions(messageId: string, tenantId: string) {
    // Verify message belongs to tenant and get contact info
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            contact: true,
          },
        },
      },
    });

    if (!message || message.conversation.tenantId !== tenantId) {
      throw new NotFoundException('Message not found');
    }

    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group reactions by emoji, handling both user and contact reactions
    const grouped = reactions.reduce(
      (acc, reaction) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = [];
        }

        // Check if this is a contact reaction (userId starts with "contact:")
        const isContactReaction = reaction.userId?.startsWith('contact:');

        let userName: string | undefined;
        if (isContactReaction) {
          // For contact reactions, use the contact's name from the conversation
          userName = message.conversation.contact?.name || 'Contact';
        } else {
          // For user reactions, use the user's name from the relation
          userName = reaction.user?.name;
        }

        acc[reaction.emoji].push({
          userId: reaction.userId,
          userName,
          isFromContact: isContactReaction,
        });
        return acc;
      },
      {} as Record<string, { userId: string | null; userName: string | undefined; isFromContact?: boolean }[]>,
    );

    return grouped;
  }

  async getMessageWithReactions(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  getAllowedEmojis() {
    return ALLOWED_EMOJIS;
  }
}
