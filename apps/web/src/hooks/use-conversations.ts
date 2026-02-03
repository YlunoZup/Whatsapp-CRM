import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Conversation, Message } from '@whatsapp-crm/shared';

interface ConversationsParams {
  page?: number;
  limit?: number;
  status?: 'open' | 'closed';
  sessionId?: string;
  assignedTo?: string;
}

interface ConversationsResponse {
  data: Conversation[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface MessagesParams {
  page?: number;
  limit?: number;
}

interface MessagesResponse {
  data: Message[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface SendMessageData {
  conversationId: string;
  content: string;
  type?: 'text' | 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  forceSessionOverride?: boolean; // Force send even if session conflict
}

// Session conflict types
export interface SessionConflict {
  hasConflict: boolean;
  contact?: {
    id: string;
    name: string | null;
    phone: string;
  };
  currentSession?: {
    id: string;
    name: string;
    phoneNumber: string | null;
  };
  requestedSession?: {
    id: string;
    name: string;
    phoneNumber: string | null;
  };
  lockedAt?: string;
  message?: string;
}

export interface SessionConflictError {
  code: 'SESSION_CONFLICT';
  message: string;
  conflict: SessionConflict;
}

export function useConversations(params: ConversationsParams = {}) {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: async () => {
      const { data } = await api.get<ConversationsResponse>('/conversations', params);
      return data;
    },
  });
}

export function useInfiniteConversations(params: Omit<ConversationsParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: ['conversations', 'infinite', params],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<ConversationsResponse>('/conversations', { ...params, page: pageParam });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.page < lastPage.meta.totalPages) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversations', id],
    queryFn: async () => {
      const { data } = await api.get<Conversation>(`/conversations/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useConversationMessages(conversationId: string, params: MessagesParams = {}) {
  return useQuery({
    queryKey: ['conversations', conversationId, 'messages', params],
    queryFn: async () => {
      const { data } = await api.get<MessagesResponse>(
        `/conversations/${conversationId}/messages`,
        params
      );
      return data;
    },
    enabled: !!conversationId,
  });
}

export function useInfiniteMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['conversations', conversationId, 'messages', 'infinite'],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<MessagesResponse>(
        `/conversations/${conversationId}/messages`,
        { page: pageParam, limit: 50 }
      );
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta && lastPage.meta.page < lastPage.meta.totalPages) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, forceSessionOverride, type, ...messageData }: SendMessageData) => {
      const { data } = await api.post<Message>(
        `/conversations/${conversationId}/messages`,
        {
          ...messageData,
          type: type || 'text', // Ensure type is always sent, default to 'text'
          forceSessionOverride
        }
      );
      return data;
    },
    onSuccess: (newMessage, variables) => {
      // Immediately add the new message to the cache for instant UI update
      queryClient.setQueriesData<MessagesResponse>(
        { queryKey: ['conversations', variables.conversationId, 'messages'] },
        (oldData) => {
          if (!oldData) return oldData;
          // Check if message already exists (avoid duplicates)
          const exists = oldData.data.some(m => m.id === newMessage.id);
          if (exists) return oldData;
          return {
            ...oldData,
            data: [...oldData.data, newMessage],
          };
        }
      );
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ['conversations', variables.conversationId, 'messages'],
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/**
 * Helper to check if an error is a session conflict error
 */
export function isSessionConflictError(error: unknown): error is { response: { data: SessionConflictError } } {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'code' in error.response.data &&
    error.response.data.code === 'SESSION_CONFLICT'
  ) {
    return true;
  }
  return false;
}

export function useUpdateConversationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: 'open' | 'closed' | 'pending';
    }) => {
      const { data } = await api.patch<Conversation>(`/conversations/${id}`, { status });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData(['conversations', data.id], data);
    },
  });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string | null }) => {
      const { data } = await api.post<Conversation>(`/conversations/${id}/assign`, {
        userId,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData(['conversations', data.id], data);
    },
  });
}

export function useCloseConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Conversation>(`/conversations/${id}/close`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData(['conversations', data.id], data);
    },
  });
}

export function useReopenConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Conversation>(`/conversations/${id}/reopen`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData(['conversations', data.id], data);
    },
  });
}

export function useMarkConversationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Conversation>(`/conversations/${id}/read`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData(['conversations', data.id], data);
    },
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, sessionId }: { contactId: string; sessionId: string }) => {
      const { data } = await api.post<Conversation>('/conversations/start', {
        contactId,
        sessionId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
