import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
}

interface JoinConversationPayload {
  conversationId: string;
}

interface TypingPayload {
  conversationId: string;
  isTyping: boolean;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('SocketGateway');

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private userSockets: Map<string, Set<string>> = new Map();

  afterInit() {
    this.logger.log('Socket.IO Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract and validate JWT token
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without valid token - disconnecting`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn(`Client ${client.id} has invalid token - disconnecting`);
        client.disconnect();
        return;
      }

      // Attach user info to socket for later use
      client.userId = payload.sub;
      client.tenantId = payload.tenantId;

      // Track socket connection
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub}, Tenant: ${payload.tenantId})`);
    } catch (error) {
      this.logger.error(`Connection error for ${client.id}: ${error}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private extractToken(client: Socket): string | null {
    // Extract from Authorization header or auth object
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    // Also check handshake auth for token
    return (client.handshake.auth?.token as string) || null;
  }

  private async verifyToken(token: string): Promise<{ sub: string; tenantId: string; email: string } | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
      return payload;
    } catch {
      return null;
    }
  }

  @SubscribeMessage('join_tenant')
  handleJoinTenant(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { tenantId: string },
  ) {
    // Verify user belongs to this tenant
    if (client.tenantId !== payload.tenantId) {
      this.logger.warn(`Client ${client.id} attempted to join unauthorized tenant ${payload.tenantId}`);
      return { success: false, error: 'Unauthorized' };
    }

    const room = `tenant:${payload.tenantId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} joined tenant room ${room}`);
    return { success: true, room };
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinConversationPayload,
  ) {
    // Verify conversation belongs to user's tenant
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: payload.conversationId,
        tenantId: client.tenantId,
      },
      select: { id: true },
    });

    if (!conversation) {
      this.logger.warn(`Client ${client.id} attempted to join unauthorized conversation ${payload.conversationId}`);
      return { success: false, error: 'Conversation not found or unauthorized' };
    }

    const room = `conversation:${payload.conversationId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} joined ${room}`);
    return { success: true, room };
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinConversationPayload,
  ) {
    const room = `conversation:${payload.conversationId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} left ${room}`);
    return { success: true };
  }

  @SubscribeMessage('typing')
  async handleTyping(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() payload: TypingPayload) {
    // Verify conversation belongs to user's tenant
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: payload.conversationId,
        tenantId: client.tenantId,
      },
      select: { id: true },
    });

    if (!conversation) {
      this.logger.warn(`Client ${client.id} attempted to send typing to unauthorized conversation ${payload.conversationId}`);
      return { success: false, error: 'Conversation not found or unauthorized' };
    }

    const room = `conversation:${payload.conversationId}`;
    client.to(room).emit('typing_indicator', {
      conversationId: payload.conversationId,
      userId: client.userId,
      isTyping: payload.isTyping,
    });
    return { success: true };
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinConversationPayload,
  ) {
    // Verify conversation belongs to user's tenant
    const conversationCheck = await this.prisma.conversation.findFirst({
      where: {
        id: payload.conversationId,
        tenantId: client.tenantId,
      },
      select: { id: true },
    });

    if (!conversationCheck) {
      return { success: false, error: 'Conversation not found or unauthorized' };
    }

    const room = `conversation:${payload.conversationId}`;
    const userId = client.userId;
    const now = new Date();

    try {
      // Get conversation with session and contact info
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: payload.conversationId },
        include: {
          session: true,
          contact: true,
        },
      });

      if (conversation) {
        // Reset unread count
        await this.prisma.conversation.update({
          where: { id: payload.conversationId },
          data: { unreadCount: 0 },
        });

        // Get all unread inbound messages and mark them as read
        const unreadInboundMessages = await this.prisma.message.findMany({
          where: {
            conversationId: payload.conversationId,
            direction: 'inbound',
            status: { not: 'read' },
          },
          select: { id: true, whatsappMessageId: true },
        });

        if (unreadInboundMessages.length > 0) {
          // Mark all inbound messages as read
          await this.prisma.message.updateMany({
            where: {
              conversationId: payload.conversationId,
              direction: 'inbound',
              status: { not: 'read' },
            },
            data: {
              status: 'read',
              readAt: now,
            },
          });

          this.logger.log(`Marked ${unreadInboundMessages.length} inbound messages as read in conversation ${payload.conversationId}`);

          // Emit status updates for each message
          for (const msg of unreadInboundMessages) {
            this.server.to(room).emit('message_status_update', {
              conversationId: payload.conversationId,
              messageId: msg.id,
              status: 'read',
              readAt: now,
            });
          }
        }

        // Get the last inbound message to send read receipt for
        const lastInboundMessage = unreadInboundMessages.find(m => m.whatsappMessageId);

        // Send read receipt to WhatsApp
        if (lastInboundMessage?.whatsappMessageId && conversation.session && conversation.contact) {
          try {
            const remoteJid = conversation.contact.whatsappId || conversation.contact.phone;
            await this.whatsappService.sendReadReceipt(
              conversation.session.id,
              remoteJid,
              [lastInboundMessage.whatsappMessageId],
            );
            this.logger.log(`Sent read receipt for conversation ${payload.conversationId}`);
          } catch (error) {
            this.logger.error(`Failed to send read receipt to WhatsApp: ${error}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to mark conversation as read: ${error}`);
    }

    // Broadcast to other clients in the conversation
    client.to(room).emit('messages_read', {
      conversationId: payload.conversationId,
      userId,
    });

    return { success: true };
  }

  // Methods to emit events from services
  emitToUser(userId: string, event: string, data: unknown) {
    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      for (const socketId of socketIds) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }

  emitToConversation(conversationId: string, event: string, data: unknown) {
    const room = `conversation:${conversationId}`;
    this.server.to(room).emit(event, data);
  }

  emitToTenant(tenantId: string, event: string, data: unknown) {
    const room = `tenant:${tenantId}`;
    this.server.to(room).emit(event, data);
  }
}
