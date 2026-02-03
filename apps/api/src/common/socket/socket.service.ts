import { Injectable } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';

export interface NewMessageEvent {
  conversationId: string;
  message: {
    id: string;
    content: string;
    type: string;
    direction: string;
    status: string;
    createdAt: Date;
  };
}

export interface MessageStatusEvent {
  conversationId: string;
  messageId: string;
  status: string;
}

export interface SessionStatusEvent {
  sessionId: string;
  status: string;
  phoneNumber?: string;
}

export interface ContactUpdateEvent {
  contact: {
    id: string;
    name?: string;
    phone: string;
    avatarUrl?: string;
  };
}

export interface QrCodeUpdateEvent {
  sessionId: string;
  qrCode: string;
  generatedAt: string;
  expiresAt: string;
  expirySeconds: number;
  remainingSeconds: number;
  isExpired: boolean;
}

@Injectable()
export class SocketService {
  constructor(private readonly gateway: SocketGateway) {}

  // Message events
  emitNewMessage(conversationId: string, data: NewMessageEvent) {
    this.gateway.emitToConversation(conversationId, 'new_message', data);
  }

  // Emit new message to all clients in a tenant (for real-time updates across all conversations)
  emitNewMessageToTenant(tenantId: string, data: NewMessageEvent) {
    this.gateway.emitToTenant(tenantId, 'new_message', data);
  }

  emitMessageStatusUpdate(conversationId: string, data: MessageStatusEvent) {
    this.gateway.emitToConversation(conversationId, 'message_status_update', data);
  }

  // Emit message status update to all clients in a tenant
  emitMessageStatusUpdateToTenant(tenantId: string, data: MessageStatusEvent) {
    this.gateway.emitToTenant(tenantId, 'message_status_update', data);
  }

  // Session events
  emitSessionStatusChange(tenantId: string, data: SessionStatusEvent) {
    this.gateway.emitToTenant(tenantId, 'session_status_change', data);
  }

  emitQrCodeUpdate(tenantId: string, data: QrCodeUpdateEvent) {
    this.gateway.emitToTenant(tenantId, 'qr_code_update', data);
  }

  // Contact events
  emitContactUpdate(tenantId: string, data: ContactUpdateEvent) {
    this.gateway.emitToTenant(tenantId, 'contact_update', data);
  }

  // Conversation events
  emitConversationUpdate(
    tenantId: string,
    data: {
      conversationId: string;
      unreadCount?: number;
      lastMessageAt?: Date;
      status?: string;
      lastMessage?: {
        content: string;
        type: string;
        createdAt: Date;
      };
    },
  ) {
    this.gateway.emitToTenant(tenantId, 'conversation_update', data);
  }

  // Direct user notification
  notifyUser(
    userId: string,
    data: {
      type: string;
      title: string;
      message: string;
      data?: Record<string, unknown>;
    },
  ) {
    this.gateway.emitToUser(userId, 'notification', data);
  }

  // Generic emit to conversation
  emitToConversation(conversationId: string, event: string, data: unknown) {
    this.gateway.emitToConversation(conversationId, event, data);
  }

  // Generic emit to tenant
  emitToTenant(tenantId: string, event: string, data: unknown) {
    this.gateway.emitToTenant(tenantId, event, data);
  }
}
