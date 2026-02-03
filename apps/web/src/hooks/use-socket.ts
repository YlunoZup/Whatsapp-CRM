import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketService } from '../services/socket';
import { useChatStore } from '../stores/chat-store';
import type { Message, Conversation } from '@whatsapp-crm/shared';

export function useSocket() {
  const queryClient = useQueryClient();
  const addMessage = useChatStore((state) => state.addMessage);
  const updateConversation = useChatStore((state) => state.updateConversation);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (connectedRef.current) return;

    socketService.connect();
    connectedRef.current = true;

    // Handle new messages (server emits 'new_message')
    socketService.on('new_message', (data: { conversationId: string; message: Message }) => {
      addMessage(data.message);
      // Immediately add message to cache for instant UI update
      queryClient.setQueriesData<{ data: Message[]; meta?: unknown }>(
        { queryKey: ['conversations', data.conversationId, 'messages'] },
        (oldData) => {
          if (!oldData) return oldData;
          // Check if message already exists (avoid duplicates)
          const exists = oldData.data.some(m => m.id === data.message.id);
          if (exists) return oldData;
          return {
            ...oldData,
            data: [...oldData.data, data.message],
          };
        }
      );
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ['conversations', data.conversationId, 'messages'],
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    // Handle message status updates (server emits 'message_status_update')
    socketService.on('message_status_update', (data: { conversationId: string; messageId: string; status: string }) => {
      queryClient.invalidateQueries({
        queryKey: ['conversations', data.conversationId, 'messages']
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    // Handle conversation updates (server emits 'conversation_update')
    socketService.on('conversation_update', (data: { conversationId: string; unreadCount?: number; status?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', data.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    // Handle new conversations
    socketService.on('conversation:new', (conversation: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    // Handle session status changes (server emits 'session_status_change')
    socketService.on('session_status_change', (data: { sessionId: string; status: string; phoneNumber?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', data.sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      // Also invalidate QR code query
      queryClient.invalidateQueries({ queryKey: ['sessions', data.sessionId, 'qr'] });
    });

    // Handle presence updates (online/offline, last seen)
    socketService.on('presence_update', (data: { contactId: string; isOnline: boolean; presence: string; lastSeenAt?: string }) => {
      // Invalidate contacts and conversations to refresh presence data
      queryClient.invalidateQueries({ queryKey: ['contacts', data.contactId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    // Handle QR code updates (server emits 'qr_code_update')
    socketService.on('qr_code_update', (data: {
      sessionId: string;
      qrCode: string;
      generatedAt: string;
      expiresAt: string;
      expirySeconds: number;
      remainingSeconds: number;
      isExpired: boolean;
    }) => {
      // Set the full QR code data object with expiration info
      queryClient.setQueryData(['sessions', data.sessionId, 'qr'], {
        qrCode: data.qrCode,
        generatedAt: data.generatedAt,
        expiresAt: data.expiresAt,
        expirySeconds: data.expirySeconds,
        remainingSeconds: data.remainingSeconds,
        isExpired: data.isExpired,
      });
    });

    // Handle typing indicators (handled separately in TypingIndicator component)
    // This is here for completeness - actual handling is in the component

    // Handle reaction added from contacts
    socketService.on('reaction:added', (data: {
      conversationId?: string;
      messageId: string;
      reaction: {
        emoji: string;
        userId: string;
        userName?: string;
        isFromContact?: boolean;
      };
    }) => {
      // Invalidate reactions for this message
      queryClient.invalidateQueries({ queryKey: ['reactions', data.messageId] });
      // Also invalidate messages to update the UI
      if (data.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ['conversations', data.conversationId, 'messages'],
        });
      }
    });

    // Handle reaction removed from contacts
    socketService.on('reaction:removed', (data: {
      conversationId?: string;
      messageId: string;
      userId: string;
      emoji?: string;
      isFromContact?: boolean;
    }) => {
      // Invalidate reactions for this message
      queryClient.invalidateQueries({ queryKey: ['reactions', data.messageId] });
      // Also invalidate messages to update the UI
      if (data.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ['conversations', data.conversationId, 'messages'],
        });
      }
    });

    return () => {
      socketService.disconnect();
      connectedRef.current = false;
    };
  }, [queryClient, addMessage, updateConversation]);

  const joinConversation = useCallback((conversationId: string) => {
    socketService.emit('join_conversation', { conversationId });
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketService.emit('leave_conversation', { conversationId });
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    socketService.emit('typing', { conversationId, isTyping });
  }, []);

  return {
    joinConversation,
    leaveConversation,
    sendTyping,
    isConnected: socketService.isConnected,
  };
}

export function useConversationSocket(conversationId: string | null) {
  const markedReadRef = useRef<string | null>(null);

  useEffect(() => {
    if (conversationId) {
      socketService.emit('join_conversation', { conversationId });

      // Mark conversation as read when opening (only once per conversation)
      if (markedReadRef.current !== conversationId) {
        socketService.emit('mark_read', { conversationId });
        markedReadRef.current = conversationId;
      }

      return () => {
        socketService.emit('leave_conversation', { conversationId });
      };
    }
  }, [conversationId]);

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (conversationId) {
        socketService.emit('typing', { conversationId, isTyping });
      }
    },
    [conversationId]
  );

  const markRead = useCallback(() => {
    if (conversationId) {
      socketService.emit('mark_read', { conversationId });
    }
  }, [conversationId]);

  return { sendTyping: handleTyping, markRead };
}
