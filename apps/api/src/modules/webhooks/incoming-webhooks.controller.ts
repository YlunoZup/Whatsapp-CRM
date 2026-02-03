import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { SessionsService } from '../sessions/sessions.service';
import { MessagesService } from '../messages/messages.service';
import { ContactsService } from '../contacts/contacts.service';
import { ConversationsService } from '../conversations/conversations.service';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../../common/prisma/prisma.service';

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
      imageMessage?: {
        url?: string;
        caption?: string;
      };
      videoMessage?: {
        url?: string;
        caption?: string;
      };
      audioMessage?: {
        url?: string;
      };
      documentMessage?: {
        url?: string;
        fileName?: string;
      };
    };
    messageTimestamp?: number;
    status?: string;
    qrcode?: {
      base64?: string;
    };
  };
}

@ApiTags('Webhooks - Incoming')
@Controller('webhooks/whatsapp')
export class IncomingWebhooksController {
  private readonly logger = new Logger('IncomingWebhooks');
  private readonly webhookSecret: string;

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly messagesService: MessagesService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly webhooksService: WebhooksService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('EVOLUTION_WEBHOOK_SECRET', '');
    // Warn if webhook secret is not configured (security risk in production)
    if (!this.webhookSecret) {
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      if (nodeEnv === 'production') {
        this.logger.error('CRITICAL SECURITY WARNING: EVOLUTION_WEBHOOK_SECRET is not configured in production! Webhook authentication is disabled.');
      } else {
        this.logger.warn('EVOLUTION_WEBHOOK_SECRET is not configured. Webhook authentication is disabled. This is acceptable for development only.');
      }
    }
  }

  @Post(':sessionId')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 1000, limit: 100 } }) // 100 webhooks per second per IP
  @ApiOperation({ summary: 'Receive webhooks from Evolution API' })
  @ApiHeader({ name: 'x-webhook-secret', required: true, description: 'Webhook secret for authentication (required in production)' })
  async handleEvolutionWebhook(
    @Param('sessionId') sessionId: string,
    @Body() payload: EvolutionWebhookPayload,
    @Headers('x-webhook-secret') webhookSecretHeader?: string,
  ) {
    // Validate webhook secret - required in production for security
    if (this.webhookSecret) {
      if (!webhookSecretHeader) {
        this.logger.warn(`Missing webhook secret header for session ${sessionId}`);
        throw new UnauthorizedException('Webhook secret header is required');
      }
      // Use timing-safe comparison to prevent timing attacks
      const secretBuffer = Buffer.from(this.webhookSecret);
      const headerBuffer = Buffer.from(webhookSecretHeader);
      if (secretBuffer.length !== headerBuffer.length ||
          !require('crypto').timingSafeEqual(secretBuffer, headerBuffer)) {
        this.logger.warn(`Invalid webhook secret for session ${sessionId}`);
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }
    this.logger.debug(`Received webhook for session ${sessionId}: ${payload.event}`);

    try {
      const session = await this.prisma.whatsappSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        this.logger.warn(`Session not found: ${sessionId}`);
        return { success: false, error: 'Session not found' };
      }

      switch (payload.event) {
        case 'qrcode.updated':
          await this.handleQrCodeUpdate(sessionId, payload);
          break;

        case 'connection.update':
          await this.handleConnectionUpdate(sessionId, session.tenantId, payload);
          break;

        case 'messages.upsert':
          await this.handleMessageUpsert(sessionId, session.tenantId, payload);
          break;

        case 'messages.update':
          await this.handleMessageUpdate(payload);
          break;

        default:
          this.logger.debug(`Unhandled event: ${payload.event}`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error}`);
      return { success: false, error: 'Processing error' };
    }
  }

  private async handleQrCodeUpdate(sessionId: string, payload: EvolutionWebhookPayload) {
    const qrCode = payload.data?.qrcode?.base64;
    if (qrCode) {
      await this.prisma.whatsappSession.update({
        where: { id: sessionId },
        data: { qrCode, status: 'qr_pending' },
      });
    }
  }

  private async handleConnectionUpdate(
    sessionId: string,
    tenantId: string,
    payload: EvolutionWebhookPayload,
  ) {
    const status = payload.data?.status;
    if (status === 'open') {
      await this.sessionsService.updateStatus(sessionId, 'connected');
      await this.webhooksService.triggerWebhooks(tenantId, 'session.connected', {
        sessionId,
        status: 'connected',
      });
    } else if (status === 'close') {
      await this.sessionsService.updateStatus(sessionId, 'disconnected');
      await this.webhooksService.triggerWebhooks(tenantId, 'session.disconnected', {
        sessionId,
        status: 'disconnected',
      });
    }
  }

  private async handleMessageUpsert(
    sessionId: string,
    tenantId: string,
    payload: EvolutionWebhookPayload,
  ) {
    const key = payload.data?.key;
    const messageData = payload.data?.message;

    if (!key?.remoteJid || key.fromMe) {
      return; // Skip outbound messages or invalid data
    }

    // Extract phone number from JID
    const phone = key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const whatsappId = key.remoteJid;
    const contactName = payload.data?.pushName;

    // Find or create contact
    const contact = await this.contactsService.findOrCreate(
      tenantId,
      whatsappId,
      phone,
      contactName,
    );

    // Find or create conversation
    const conversation = await this.conversationsService.findOrCreate(
      tenantId,
      sessionId,
      contact.id,
    );

    // Determine message type and content
    let type = 'text';
    let content = '';
    let mediaUrl: string | undefined;

    if (messageData?.conversation) {
      content = messageData.conversation;
    } else if (messageData?.extendedTextMessage?.text) {
      content = messageData.extendedTextMessage.text;
    } else if (messageData?.imageMessage) {
      type = 'image';
      mediaUrl = messageData.imageMessage.url;
      content = messageData.imageMessage.caption || '';
    } else if (messageData?.videoMessage) {
      type = 'video';
      mediaUrl = messageData.videoMessage.url;
      content = messageData.videoMessage.caption || '';
    } else if (messageData?.audioMessage) {
      type = 'audio';
      mediaUrl = messageData.audioMessage.url;
    } else if (messageData?.documentMessage) {
      type = 'document';
      mediaUrl = messageData.documentMessage.url;
      content = messageData.documentMessage.fileName || '';
    }

    // Create message
    const message = await this.messagesService.create({
      tenantId,
      conversationId: conversation.id,
      whatsappMessageId: key.id,
      direction: 'inbound',
      type,
      content,
      mediaUrl,
      metadata: {
        timestamp: payload.data?.messageTimestamp,
        pushName: contactName,
      },
    });

    // Trigger outgoing webhooks
    await this.webhooksService.triggerWebhooks(tenantId, 'message.received', {
      messageId: message.id,
      conversationId: conversation.id,
      contactId: contact.id,
      sessionId,
      type,
      content,
      mediaUrl,
      from: phone,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleMessageUpdate(payload: EvolutionWebhookPayload) {
    const key = payload.data?.key;
    const status = payload.data?.status;

    if (!key?.id || !status) {
      return;
    }

    // Map Evolution API status to our status
    const statusMap: Record<string, string> = {
      PENDING: 'pending',
      SENT: 'sent',
      DELIVERY_ACK: 'delivered',
      READ: 'read',
      PLAYED: 'read',
    };

    const mappedStatus = statusMap[status] || status.toLowerCase();

    const message = await this.messagesService.findByWhatsAppId(key.id);
    if (message) {
      await this.messagesService.updateStatus(message.id, mappedStatus);
    }
  }
}
