import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { logger } from '@/lib/logger';

let socket: Socket | null = null;

// Session status change callbacks
type SessionStatusCallback = (data: { sessionId: string; status: string; qrCode?: string; phoneNumber?: string }) => void;
const sessionStatusCallbacks: Set<SessionStatusCallback> = new Set();

// QR code update callbacks
type QrCodeUpdateCallback = (data: { sessionId: string; qrCode: string; expiresAt: string }) => void;
const qrCodeUpdateCallbacks: Set<QrCodeUpdateCallback> = new Set();

// Presence update callbacks
type PresenceUpdateCallback = (data: { contactId: string; isOnline: boolean; presence: string; lastSeenAt?: string }) => void;
const presenceUpdateCallbacks: Set<PresenceUpdateCallback> = new Set();

export function connectSocket(): Socket | undefined {
  const token = useAuthStore.getState().accessToken;
  const userId = useAuthStore.getState().user?.id;
  const tenantId = useAuthStore.getState().user?.tenantId;

  if (!token || !userId) {
    return undefined;
  }

  socket = io('/chat', {
    auth: {
      token, // JWT token for authentication
    },
    transports: ['websocket'],
    // Reconnection settings
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    // Join tenant room for real-time updates across all conversations
    if (tenantId) {
      socket?.emit('join_tenant', { tenantId });
    }
  });

  socket.on('disconnect', () => {
    // Socket disconnected
  });

  socket.on('new_message', (data: { conversationId: string; message: unknown }) => {
    const chatStore = useChatStore.getState();
    const message = data.message as Parameters<typeof chatStore.addMessage>[0];
    if (chatStore.selectedConversation?.id === data.conversationId) {
      chatStore.addMessage(message);
    }
    // Update conversation list
    const conversation = chatStore.conversations.find(c => c.id === data.conversationId);
    if (conversation) {
      chatStore.updateConversation({
        ...conversation,
        lastMessageAt: new Date(),
        unreadCount: chatStore.selectedConversation?.id === data.conversationId
          ? 0
          : (conversation.unreadCount || 0) + 1,
      });
    }
  });

  socket.on('message_status_update', (data: { conversationId: string; messageId: string; status: string }) => {
    useChatStore.getState().updateMessage(data.conversationId, data.messageId, { status: data.status as 'pending' | 'sent' | 'delivered' | 'read' | 'failed' });
  });

  socket.on('typing_indicator', (_data: { conversationId: string; userId: string; isTyping: boolean }) => {
    // Typing indicator handled by ChatWindow component directly
  });

  // Session status change handler - for real-time QR/connection updates
  socket.on('session_status_change', (data: { sessionId: string; status: string; qrCode?: string; phoneNumber?: string }) => {
    logger.log('[Socket] Session status change:', data.sessionId, data.status);
    // Notify all subscribers
    sessionStatusCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        logger.error('[Socket] Error in session status callback:', err);
      }
    });
  });

  // QR code update handler - for real-time QR refresh
  socket.on('qr_code_update', (data: { sessionId: string; qrCode: string; expiresAt: string }) => {
    logger.log('[Socket] QR code update:', data.sessionId);
    // Notify all subscribers
    qrCodeUpdateCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        logger.error('[Socket] Error in QR code callback:', err);
      }
    });
  });

  // Presence update handler - for online/offline and last seen updates
  socket.on('presence_update', (data: { contactId: string; isOnline: boolean; presence: string; lastSeenAt?: string }) => {
    logger.log('[Socket] Presence update:', data.contactId, data.isOnline ? 'online' : 'offline');
    // Notify all subscribers
    presenceUpdateCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        logger.error('[Socket] Error in presence callback:', err);
      }
    });
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinConversation(conversationId: string) {
  if (socket) {
    socket.emit('join_conversation', { conversationId });
  }
}

export function leaveConversation(conversationId: string) {
  if (socket) {
    socket.emit('leave_conversation', { conversationId });
  }
}

export function sendTyping(conversationId: string, isTyping: boolean) {
  if (socket) {
    socket.emit('typing', { conversationId, isTyping });
  }
}

export function markConversationRead(conversationId: string) {
  if (socket) {
    socket.emit('mark_read', { conversationId });
  }
}

export function subscribeToSessionStatus(callback: SessionStatusCallback): () => void {
  sessionStatusCallbacks.add(callback);
  return () => {
    sessionStatusCallbacks.delete(callback);
  };
}

export function subscribeToQrCodeUpdate(callback: QrCodeUpdateCallback): () => void {
  qrCodeUpdateCallbacks.add(callback);
  return () => {
    qrCodeUpdateCallbacks.delete(callback);
  };
}

export function subscribeToPresenceUpdate(callback: PresenceUpdateCallback): () => void {
  presenceUpdateCallbacks.add(callback);
  return () => {
    presenceUpdateCallbacks.delete(callback);
  };
}

export function getSocket(): Socket | null {
  return socket;
}

// Export as a service object for convenience
export const socketService = {
  connect: connectSocket,
  disconnect: disconnectSocket,
  joinConversation,
  leaveConversation,
  sendTyping,
  markRead: markConversationRead,
  subscribeToSessionStatus,
  subscribeToQrCodeUpdate,
  getSocket,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, callback: (...args: any[]) => void) => {
    const s = getSocket();
    if (s) s.on(event, callback);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off: (event: string, callback?: (...args: any[]) => void) => {
    const s = getSocket();
    if (s) s.off(event, callback);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit: (event: string, ...args: any[]) => {
    const s = getSocket();
    if (s) s.emit(event, ...args);
  },
  get isConnected() {
    const s = getSocket();
    return s?.connected ?? false;
  },
};
