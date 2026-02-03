import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueueService, MessageJobData } from '../../common/queue/queue.service';
import { SocketService } from '../../common/socket/socket.service';
import { WhatsAppService, IncomingMessage, MessageStatusUpdate, IncomingReaction, PresenceUpdate } from '../../common/whatsapp/whatsapp.service';

interface SendResult {
  success: boolean;
  whatsappMessageId?: string;
  remoteJid?: string;
  error?: string;
}

@Injectable()
export class MessageProcessor implements OnModuleInit {
  private readonly logger = new Logger(MessageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly socketService: SocketService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  onModuleInit() {
    this.registerWorker();
    this.registerIncomingMessageHandler();
    this.registerMessageStatusHandler();
    this.registerIncomingReactionHandler();
    this.registerPresenceUpdateHandler();
  }

  private registerWorker() {
    this.queueService.registerWorker<MessageJobData>(
      'whatsapp-outbound',
      async (job: Job<MessageJobData>) => {
        await this.processMessage(job);
      },
      { concurrency: 1 }, // Process 1 message at a time to avoid WhatsApp ban detection
    );

    this.logger.log('Message processor initialized - whatsapp-outbound queue worker registered');
  }

  private registerIncomingMessageHandler() {
    this.whatsappService.onMessage(async (msg: IncomingMessage) => {
      await this.processIncomingMessage(msg);
    });
    this.logger.log('Incoming message handler registered');
  }

  private registerMessageStatusHandler() {
    this.whatsappService.onMessageStatus(async (update: MessageStatusUpdate) => {
      await this.processMessageStatusUpdate(update);
    });
    this.logger.log('Message status handler registered');
  }

  private registerIncomingReactionHandler() {
    this.whatsappService.onReaction(async (reaction: IncomingReaction) => {
      await this.processIncomingReaction(reaction);
    });
    this.logger.log('Incoming reaction handler registered');
  }

  private registerPresenceUpdateHandler() {
    this.whatsappService.onPresence(async (presence: PresenceUpdate) => {
      await this.processPresenceUpdate(presence);
    });
    this.logger.log('Presence update handler registered');
  }

  private async processPresenceUpdate(presence: PresenceUpdate) {
    try {
      // Get session to find tenant
      const session = await this.prisma.whatsappSession.findUnique({
        where: { id: presence.sessionId },
      });

      if (!session) {
        this.logger.debug(`Session not found for presence update: ${presence.sessionId}`);
        return;
      }

      // Extract phone number from JID
      const phone = presence.remoteJid.split('@')[0].replace(/\D/g, '');
      if (!phone) return;

      // Find contact by phone or whatsappId
      const contact = await this.prisma.contact.findFirst({
        where: {
          tenantId: session.tenantId,
          OR: [
            { whatsappId: presence.remoteJid },
            { phone: phone },
            { phone: { endsWith: phone.slice(-10) } },
          ],
        },
      });

      if (!contact) {
        this.logger.debug(`Contact not found for presence update: ${presence.remoteJid}`);
        return;
      }

      // Determine online status
      const isOnline = presence.presence === 'available' || presence.presence === 'composing' || presence.presence === 'recording';

      // Update contact presence
      const updateData: any = {
        isOnline,
        lastPresence: presence.presence,
      };

      // If going offline or we have lastSeen, update lastSeenAt
      if (!isOnline || presence.lastSeen) {
        updateData.lastSeenAt = presence.lastSeen ? new Date(presence.lastSeen * 1000) : new Date();
      }

      await this.prisma.contact.update({
        where: { id: contact.id },
        data: updateData,
      });

      this.logger.debug(`Updated presence for contact ${contact.id}: ${presence.presence}, online: ${isOnline}`);

      // Emit presence update to frontend
      this.socketService.emitToTenant(session.tenantId, 'presence_update', {
        contactId: contact.id,
        isOnline,
        presence: presence.presence,
        lastSeenAt: updateData.lastSeenAt,
      });
    } catch (error) {
      this.logger.error(`Error processing presence update: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async processMessageStatusUpdate(update: MessageStatusUpdate) {
    try {
      // Find message by WhatsApp message ID, include conversation for tenantId
      const message = await this.prisma.message.findFirst({
        where: { whatsappMessageId: update.messageId },
        include: { conversation: true },
      });

      if (!message) {
        this.logger.debug(`Message not found for status update: ${update.messageId}`);
        return;
      }

      // Only update if status is progressing (don't downgrade)
      const statusOrder = { pending: 0, sent: 1, delivered: 2, read: 3 };
      const currentOrder = statusOrder[message.status as keyof typeof statusOrder] || 0;
      const newOrder = statusOrder[update.status] || 0;

      if (newOrder <= currentOrder) {
        this.logger.debug(`Skipping status update: ${message.status} -> ${update.status}`);
        return;
      }

      this.logger.log(`Updating message ${message.id} status: ${message.status} -> ${update.status}`);

      // Build update data with timestamps
      const updateData: any = { status: update.status };
      const now = new Date();

      if (update.status === 'delivered' && !message.deliveredAt) {
        updateData.deliveredAt = now;
      } else if (update.status === 'read') {
        if (!message.deliveredAt) {
          updateData.deliveredAt = now;
        }
        if (!message.readAt) {
          updateData.readAt = now;
        }
      }

      // Update message status with timestamps
      const updatedMessage = await this.prisma.message.update({
        where: { id: message.id },
        data: updateData,
      });

      // Prepare status event data with timestamps
      const statusEventData = {
        conversationId: message.conversationId,
        messageId: message.id,
        status: update.status,
        deliveredAt: updatedMessage.deliveredAt,
        readAt: updatedMessage.readAt,
      };

      // Emit to conversation room (for clients viewing this conversation)
      this.socketService.emitMessageStatusUpdate(message.conversationId, statusEventData);

      // Emit to tenant room (for all clients in the tenant - ensures immediate updates)
      if (message.conversation?.tenantId) {
        this.socketService.emitMessageStatusUpdateToTenant(message.conversation.tenantId, statusEventData);
      }
    } catch (error) {
      this.logger.error(
        `Error processing message status update: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async processIncomingReaction(reaction: IncomingReaction) {
    try {
      // Find the message being reacted to by WhatsApp message ID
      const message = await this.prisma.message.findFirst({
        where: { whatsappMessageId: reaction.messageId },
        include: {
          conversation: {
            include: {
              contact: true,
            },
          },
        },
      });

      if (!message) {
        this.logger.debug(`Message not found for reaction: ${reaction.messageId}`);
        return;
      }

      this.logger.log(
        `Processing reaction - Emoji: "${reaction.emoji || '[removed]'}", ` +
        `Message: ${message.id}, FromMe: ${reaction.fromMe}, ReactedMsgFromMe: ${reaction.reactedMessageFromMe}`,
      );

      // Determine who reacted - if fromMe is true, it's us (already handled by our own addReaction)
      // If fromMe is false, it's the contact reacting
      if (reaction.fromMe) {
        // Reaction from us - likely already saved via our API, skip
        this.logger.debug(`Skipping our own reaction to message ${message.id}`);
        return;
      }

      // This is a reaction from the contact
      const contactId = message.conversation?.contact?.id;

      if (reaction.emoji) {
        // Adding a reaction from contact
        // Use a special "contact:" prefix for userId to distinguish from user reactions
        const contactUserId = contactId ? `contact:${contactId}` : 'contact:unknown';

        // Check if this exact reaction already exists
        const existingReaction = await this.prisma.messageReaction.findFirst({
          where: {
            messageId: message.id,
            userId: contactUserId,
          },
        });

        if (existingReaction) {
          // Update the existing reaction if emoji changed
          if (existingReaction.emoji !== reaction.emoji) {
            await this.prisma.messageReaction.update({
              where: { id: existingReaction.id },
              data: { emoji: reaction.emoji },
            });
            this.logger.log(`Updated contact reaction on message ${message.id}: ${existingReaction.emoji} -> ${reaction.emoji}`);
          }
        } else {
          // Create new reaction
          await this.prisma.messageReaction.create({
            data: {
              messageId: message.id,
              userId: contactUserId,
              emoji: reaction.emoji,
            },
          });
          this.logger.log(`Created contact reaction on message ${message.id}: ${reaction.emoji}`);
        }

        // Emit socket event for reaction added
        this.socketService.emitToConversation(message.conversationId, 'reaction:added', {
          conversationId: message.conversationId,
          messageId: message.id,
          reaction: {
            id: `contact-${message.id}-${reaction.emoji}`,
            emoji: reaction.emoji,
            userId: contactUserId,
            userName: message.conversation?.contact?.name || 'Contact',
            isFromContact: true,
          },
        });

        // Also emit to tenant for real-time updates
        if (message.conversation?.tenantId) {
          this.socketService.emitToTenant(message.conversation.tenantId, 'reaction:added', {
            conversationId: message.conversationId,
            messageId: message.id,
            reaction: {
              emoji: reaction.emoji,
              userId: contactUserId,
              userName: message.conversation?.contact?.name || 'Contact',
              isFromContact: true,
            },
          });
        }
      } else {
        // Removing reaction from contact (empty emoji)
        const contactUserId = contactId ? `contact:${contactId}` : 'contact:unknown';

        // Delete all reactions from this contact on this message
        const deleted = await this.prisma.messageReaction.deleteMany({
          where: {
            messageId: message.id,
            userId: contactUserId,
          },
        });

        if (deleted.count > 0) {
          this.logger.log(`Removed ${deleted.count} contact reaction(s) from message ${message.id}`);

          // Emit socket event for reaction removed
          this.socketService.emitToConversation(message.conversationId, 'reaction:removed', {
            conversationId: message.conversationId,
            messageId: message.id,
            userId: contactUserId,
            isFromContact: true,
          });

          // Also emit to tenant
          if (message.conversation?.tenantId) {
            this.socketService.emitToTenant(message.conversation.tenantId, 'reaction:removed', {
              conversationId: message.conversationId,
              messageId: message.id,
              userId: contactUserId,
              isFromContact: true,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing incoming reaction: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async processIncomingMessage(msg: IncomingMessage) {
    try {
      // Skip messages sent by us (fromMe = true)
      if (msg.fromMe) {
        this.logger.debug(`Skipping outgoing message: ${msg.messageId}`);
        return;
      }

      // Get session to find tenant
      const session = await this.prisma.whatsappSession.findUnique({
        where: { id: msg.sessionId },
      });

      if (!session) {
        this.logger.error(`Session not found for incoming message: ${msg.sessionId}`);
        return;
      }

      // Extract phone number from JID (remove @s.whatsapp.net or @lid)
      const phone = msg.remoteJid.split('@')[0];
      // Normalize phone: remove all non-digits
      const normalizedPhone = phone.replace(/\D/g, '');
      const isLidFormat = msg.remoteJid.includes('@lid');

      // CRITICAL: remoteJidAlt gives us the phone number directly from WhatsApp when message is from @lid
      // This is the key to 100% reliable matching - same as WhatsApp Web
      const phoneFromAlt = msg.remoteJidAlt?.includes('@s.whatsapp.net') ? msg.remoteJidAlt : null;
      const resolvedPhone = phoneFromAlt || msg.senderPn; // Use Alt first, then fallback to senderPn

      // Extract clean phone number for matching
      const resolvedPhoneNumber = resolvedPhone ? resolvedPhone.split('@')[0].replace(/\D/g, '') : null;

      this.logger.log(`Processing incoming message from ${msg.remoteJid} (alt: ${msg.remoteJidAlt || 'none'}, pushName: ${msg.pushName}, isLid: ${isLidFormat}, resolvedPhone: ${resolvedPhoneNumber || 'unknown'})`);

      // Helper function to create phone matching conditions
      const createPhoneMatchConditions = (phoneNumber: string) => {
        const conditions: any[] = [
          { phone: phoneNumber },
          { phone: `+${phoneNumber}` },
        ];
        // Try with/without leading country code variations
        if (phoneNumber.length > 10) {
          conditions.push({ phone: phoneNumber.slice(-10) });
          conditions.push({ phone: `+${phoneNumber.slice(-10)}` });
        }
        if (phoneNumber.length > 9) {
          conditions.push({ phone: { contains: phoneNumber.slice(-9) } });
        }
        // Try partial matches for different formats
        if (phoneNumber.length >= 10) {
          conditions.push({ phone: { endsWith: phoneNumber.slice(-10) } });
        }
        return conditions;
      };

      // Strategy 1: Find contact by exact whatsappId match (matches @lid or @s.whatsapp.net)
      let contact = await this.prisma.contact.findFirst({
        where: {
          tenantId: session.tenantId,
          whatsappId: msg.remoteJid,
        },
      });

      // Strategy 1.25: If @lid format and not found, check our stored LID->phone mappings
      // This helps when we previously learned the mapping from an outbound message or earlier inbound
      if (!contact && isLidFormat) {
        const storedPhoneJid = this.whatsappService.getPhoneFromLid(msg.sessionId, msg.remoteJid);
        if (storedPhoneJid) {
          const storedPhone = storedPhoneJid.split('@')[0].replace(/\D/g, '');
          contact = await this.prisma.contact.findFirst({
            where: {
              tenantId: session.tenantId,
              OR: [
                { whatsappId: storedPhoneJid },
                ...createPhoneMatchConditions(storedPhone),
              ],
            },
          });
          if (contact) {
            this.logger.log(`✓ Found contact ${contact.id} via stored LID mapping: ${msg.remoteJid} -> ${storedPhoneJid}`);
          }
        }
      }

      // Strategy 1.5: If @lid format, try matching by the PHONE NUMBER from remoteJidAlt
      // This is the most reliable method - WhatsApp gives us both identifiers!
      if (!contact && isLidFormat && resolvedPhoneNumber) {
        const phoneJid = resolvedPhone!;

        contact = await this.prisma.contact.findFirst({
          where: {
            tenantId: session.tenantId,
            OR: [
              // Match by phone JID whatsappId
              { whatsappId: phoneJid },
              // Match by phone number variations using helper
              ...createPhoneMatchConditions(resolvedPhoneNumber),
            ],
          },
        });
        if (contact) {
          this.logger.log(`✓ Found contact ${contact.id} by phone from remoteJidAlt: ${phoneJid}`);
          // Store the LID mapping for future messages
          this.whatsappService.storeLidMapping(msg.sessionId, msg.remoteJid, phoneJid);
        }
      }

      // Strategy 2: If not found and NOT @lid format, try phone number matching
      if (!contact && !isLidFormat) {
        contact = await this.prisma.contact.findFirst({
          where: {
            tenantId: session.tenantId,
            OR: [
              // Also match by whatsappId in standard format
              { whatsappId: `${normalizedPhone}@s.whatsapp.net` },
              // Use helper function for consistent phone matching
              ...createPhoneMatchConditions(normalizedPhone),
              // Also try with original phone format (may have different formatting)
              { phone: phone },
            ],
          },
        });
        if (contact) {
          this.logger.log(`✓ Found contact ${contact.id} by phone number matching`);
        }
      }

      // Strategy 3: Try to find a contact by pushName that has NO whatsappId yet
      // This helps match manually created contacts before we've sent them a message
      if (!contact && msg.pushName) {
        const contactByName = await this.prisma.contact.findFirst({
          where: {
            tenantId: session.tenantId,
            whatsappId: null, // Only match contacts without whatsappId
            name: {
              equals: msg.pushName,
              mode: 'insensitive',
            },
          },
        });
        if (contactByName) {
          contact = contactByName;
          this.logger.log(`Found contact ${contact.id} by pushName match: ${msg.pushName}`);
        }
      }

      // Strategy 4: For @lid messages, ONLY match if there's exactly ONE contact
      // with recent outbound and no inbound reply yet. This prevents mismatches in bulk scenarios.
      if (!contact && isLidFormat) {
        // Find conversations with recent outbound messages (within last 10 minutes)
        // that haven't received a reply yet - much stricter for bulk safety
        const recentTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes
        const candidateConversations = await this.prisma.conversation.findMany({
          where: {
            tenantId: session.tenantId,
            sessionId: session.id,
            contact: {
              // Contact has a phone-based whatsappId (not @lid)
              whatsappId: { contains: '@s.whatsapp.net' },
            },
          },
          include: {
            contact: true,
            messages: {
              where: { createdAt: { gte: recentTime } },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        });

        // Filter to conversations that:
        // 1. Have at least one recent outbound message
        // 2. Have NO inbound messages (haven't received reply yet)
        const eligibleConversations = candidateConversations.filter(conv => {
          const hasRecentOutbound = conv.messages.some(m => m.direction === 'outbound');
          const hasAnyInbound = conv.messages.some(m => m.direction === 'inbound');
          return hasRecentOutbound && !hasAnyInbound;
        });

        // ONLY match if there's exactly ONE eligible conversation
        // This prevents wrong matches in bulk messaging scenarios
        if (eligibleConversations.length === 1) {
          contact = eligibleConversations[0].contact;
          this.logger.log(`Found single eligible contact ${contact.id} awaiting reply (safe match)`);
        } else if (eligibleConversations.length > 1) {
          this.logger.warn(`Multiple contacts (${eligibleConversations.length}) awaiting replies - cannot safely match @lid ${msg.remoteJid}`);
        }
      }

      // Strategy 5: Check if there's a contact without whatsappId that has sent messages
      if (!contact) {
        const existingConversation = await this.prisma.conversation.findFirst({
          where: {
            tenantId: session.tenantId,
            sessionId: session.id,
            contact: {
              whatsappId: null,
            },
          },
          include: {
            contact: true,
            messages: {
              where: {
                direction: 'outbound',
                status: { in: ['sent', 'delivered', 'read'] },
              },
              take: 1,
            },
          },
          orderBy: { lastMessageAt: 'desc' },
        });

        if (existingConversation?.contact && existingConversation.messages.length > 0) {
          contact = existingConversation.contact;
          this.logger.log(`Found unlinked contact ${contact.id} with recent outbound messages`);
        }
      }

      if (!contact) {
        // Create new contact as last resort
        // For @lid format: use resolved phone from remoteJidAlt (most reliable) or senderPn
        let contactPhone: string;
        let needsReview = false;

        if (isLidFormat) {
          // Use resolvedPhone which comes from remoteJidAlt (WhatsApp's own mapping)
          if (resolvedPhone) {
            contactPhone = resolvedPhone.split('@')[0].replace(/\D/g, '');
            this.logger.log(`Creating contact with phone from remoteJidAlt: ${contactPhone}`);
          } else {
            // No phone available - use the LID as identifier (rare case if remoteJidAlt not provided)
            contactPhone = msg.remoteJid.split('@')[0];
            // Flag for review - this contact might be a duplicate that couldn't be matched
            needsReview = true;
            this.logger.warn(`Creating unmatched @lid contact (no remoteJidAlt) - may need manual review/merge: ${msg.remoteJid}`);
          }
        } else {
          contactPhone = normalizedPhone;
        }

        contact = await this.prisma.contact.create({
          data: {
            tenantId: session.tenantId,
            phone: contactPhone,
            whatsappId: msg.remoteJid,
            name: msg.pushName || (isLidFormat ? 'Unknown' : normalizedPhone),
            metadata: needsReview ? { needsReview: true, reason: 'unmatched_lid_no_alt', createdFrom: msg.remoteJid } : undefined,
          },
        });
        this.logger.log(`Created new contact: ${contact.id} (name: ${contact.name}, phone: ${contactPhone}, whatsappId: ${msg.remoteJid}, needsReview: ${needsReview})`);
      } else {
        // Update existing contact with whatsappId and name if needed
        const updates: Record<string, string> = {};

        // Update whatsappId if:
        // 1. Contact has no whatsappId, OR
        // 2. Contact has @s.whatsapp.net format but incoming is @lid format (use @lid for future matching)
        const shouldUpdateWhatsappId = !contact.whatsappId ||
          (isLidFormat && contact.whatsappId && contact.whatsappId.includes('@s.whatsapp.net'));

        if (shouldUpdateWhatsappId && contact.whatsappId !== msg.remoteJid) {
          updates.whatsappId = msg.remoteJid;
          this.logger.log(`Updating contact whatsappId from ${contact.whatsappId} to ${msg.remoteJid}`);
        }

        if (msg.pushName && (contact.name === contact.phone || !contact.name || contact.name === 'Unknown')) {
          updates.name = msg.pushName;
        }
        if (Object.keys(updates).length > 0) {
          contact = await this.prisma.contact.update({
            where: { id: contact.id },
            data: updates,
          });
          this.logger.log(`Updated contact ${contact.id} with: ${JSON.stringify(updates)}`);
        }

        // Store LID mapping if this is a @lid message and contact has a phone number
        // This allows future messages from this LID to be matched to this contact
        if (isLidFormat && contact.phone) {
          const phoneJid = `${contact.phone.replace(/\D/g, '')}@s.whatsapp.net`;
          this.whatsappService.storeLidMapping(msg.sessionId, msg.remoteJid, phoneJid);
          this.logger.log(`Stored LID mapping: ${msg.remoteJid} -> ${phoneJid} (from contact ${contact.id})`);
        }
      }

      // Find or create conversation
      let conversation = await this.prisma.conversation.findFirst({
        where: {
          tenantId: session.tenantId,
          contactId: contact.id,
          sessionId: session.id,
        },
      });

      if (!conversation) {
        // Create new conversation
        conversation = await this.prisma.conversation.create({
          data: {
            tenantId: session.tenantId,
            sessionId: session.id,
            contactId: contact.id,
            status: 'open',
          },
        });
        this.logger.log(`Created new conversation: ${conversation.id}`);
      }

      // Check if message already exists (by whatsappMessageId)
      const existingMessage = await this.prisma.message.findFirst({
        where: {
          whatsappMessageId: msg.messageId,
        },
      });

      if (existingMessage) {
        this.logger.debug(`Message already exists: ${msg.messageId}`);
        return;
      }

      // Create the message
      const message = await this.prisma.message.create({
        data: {
          tenantId: session.tenantId,
          conversationId: conversation.id,
          whatsappMessageId: msg.messageId,
          direction: 'inbound',
          type: msg.type,
          content: msg.content || '',
          mediaUrl: msg.mediaUrl,
          status: 'received',
          createdAt: new Date(msg.timestamp * 1000),
        } as any,
      });

      this.logger.log(`Created incoming message: ${message.id} in conversation: ${conversation.id}`);

      // Update conversation last message time
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
          status: 'open', // Reopen if closed
        },
      });

      // Prepare message data for socket events
      const messageData = {
        conversationId: conversation.id,
        message: {
          id: message.id,
          content: message.content || '',
          type: message.type,
          direction: message.direction,
          status: message.status,
          createdAt: message.createdAt,
        },
      };

      // Emit to conversation room (for clients viewing this conversation)
      this.socketService.emitNewMessage(conversation.id, messageData);

      // Emit to tenant room (for all clients in the tenant - ensures immediate updates)
      this.socketService.emitNewMessageToTenant(session.tenantId, messageData);

      // Also emit conversation update to tenant room for conversation list updates
      this.socketService.emitConversationUpdate(session.tenantId, {
        conversationId: conversation.id,
        lastMessage: {
          content: message.content || '',
          type: message.type,
          createdAt: message.createdAt,
        },
        unreadCount: conversation.unreadCount + 1,
      });

    } catch (error) {
      this.logger.error(
        `Error processing incoming message: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async processMessage(job: Job<MessageJobData>) {
    const { sessionId, to, message, type, mediaUrl, metadata } = job.data;
    const attemptNumber = job.attemptsMade + 1;

    this.logger.log(
      `Processing message - session: ${sessionId}, to: ${to}, type: ${type}, attempt: ${attemptNumber}`,
    );

    try {
      // Get session info
      const session = await this.prisma.whatsappSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        this.logger.error(`Session not found: ${sessionId}`);
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (session.status !== 'connected') {
        this.logger.warn(`Session not connected: ${sessionId} (status: ${session.status})`);
        throw new Error(`Session not connected. Current status: ${session.status}`);
      }

      // Send message via WhatsApp (Baileys)
      const result = await this.sendViaBaileys(sessionId, to, message, type, mediaUrl);

      if (result.success) {
        this.logger.log(
          `Message sent successfully - session: ${sessionId}, to: ${to}, whatsappId: ${result.whatsappMessageId}, remoteJid: ${result.remoteJid}`,
        );

        // Update message status if we have a message ID in metadata
        if (metadata?.messageId) {
          // Get message with conversation and contact to update whatsappId
          const msg = await this.prisma.message.findUnique({
            where: { id: metadata.messageId as string },
            include: {
              conversation: {
                include: {
                  contact: true,
                },
              },
            },
          });

          if (msg) {
            // Update message status
            await this.prisma.message.update({
              where: { id: metadata.messageId as string },
              data: {
                status: 'sent',
                whatsappMessageId: result.whatsappMessageId,
              },
            });

            // Update contact's whatsappId if we have a VALID remoteJid and it's not already set
            // Valid remoteJid must have an identifier before the @ sign (e.g., 639763131506@s.whatsapp.net)
            const isValidRemoteJid = result.remoteJid &&
              result.remoteJid.includes('@') &&
              result.remoteJid.split('@')[0].length > 0;

            if (isValidRemoteJid && msg.conversation?.contact) {
              const contact = msg.conversation.contact;
              if (!contact.whatsappId || contact.whatsappId !== result.remoteJid) {
                await this.prisma.contact.update({
                  where: { id: contact.id },
                  data: { whatsappId: result.remoteJid },
                });
                this.logger.log(`Updated contact ${contact.id} whatsappId to: ${result.remoteJid}`);
              }

              // Store LID mapping if remoteJid is @lid format and we have contact's phone
              // This enables matching future incoming messages from this LID
              if (result.remoteJid.includes('@lid') && contact.phone) {
                const phoneJid = `${contact.phone.replace(/\D/g, '')}@s.whatsapp.net`;
                this.whatsappService.storeLidMapping(sessionId, result.remoteJid, phoneJid);
                this.logger.log(`Stored LID mapping from outbound: ${result.remoteJid} -> ${phoneJid}`);
              }
            } else if (result.remoteJid && !isValidRemoteJid) {
              this.logger.warn(`Skipping invalid remoteJid: ${result.remoteJid}`);
            }

            // Emit socket event for status update
            this.socketService.emitMessageStatusUpdate(msg.conversationId, {
              conversationId: msg.conversationId,
              messageId: metadata.messageId as string,
              status: 'sent',
            });
          }
        }

        // If this was from a scheduled message, update its status
        if (metadata?.scheduledMessageId) {
          await this.prisma.scheduledMessage.update({
            where: { id: metadata.scheduledMessageId as string },
            data: { status: 'sent' },
          });
        }
      } else {
        this.logger.error(
          `Failed to send message - session: ${sessionId}, error: ${result.error}`,
        );

        // Update scheduled message status on final failure
        if (attemptNumber >= 3 && metadata?.scheduledMessageId) {
          await this.prisma.scheduledMessage.update({
            where: { id: metadata.scheduledMessageId as string },
            data: { status: 'failed' },
          });
        }

        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      this.logger.error(
        `Message processing error - session: ${sessionId}, attempt: ${attemptNumber}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private async sendViaBaileys(
    sessionId: string,
    to: string,
    message: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'document',
    mediaUrl?: string,
  ): Promise<SendResult> {
    try {
      // Check if session is connected in WhatsAppService
      const status = this.whatsappService.getStatus(sessionId);
      if (status !== 'connected') {
        return {
          success: false,
          error: `WhatsApp session not connected. Status: ${status}`,
        };
      }

      // Normalize phone number - remove non-digits
      const normalizedTo = to.replace(/\D/g, '');

      if (type === 'text') {
        const result = await this.whatsappService.sendMessage(sessionId, normalizedTo, message);
        this.logger.log(`Baileys send result: ${JSON.stringify(result?.key)}`);

        return {
          success: true,
          whatsappMessageId: result?.key?.id,
          remoteJid: result?.key?.remoteJid,
        };
      } else {
        // TODO: Implement media message sending
        this.logger.warn(`Media message type ${type} not yet implemented, sending as text`);
        const result = await this.whatsappService.sendMessage(sessionId, normalizedTo, message || `[${type}]`);

        return {
          success: true,
          whatsappMessageId: result?.key?.id,
          remoteJid: result?.key?.remoteJid,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Baileys send error: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
