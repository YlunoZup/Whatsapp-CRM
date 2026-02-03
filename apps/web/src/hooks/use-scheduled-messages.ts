import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface ScheduledMessage {
  id: string;
  sessionId: string;
  conversationId?: string;
  contactPhone: string;
  type: string;
  content: string;
  mediaUrl?: string;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error?: string;
  sentAt?: string;
  createdBy: string;
  createdAt: string;
}

interface ScheduledMessagesResponse {
  data: ScheduledMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CreateScheduledMessageDto {
  sessionId: string;
  conversationId?: string;
  contactPhone: string;
  type?: string;
  content: string;
  mediaUrl?: string;
  scheduledFor: string;
}

export function useScheduledMessages(options?: {
  status?: string;
  sessionId?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['scheduled-messages', options],
    queryFn: async () => {
      const { data } = await api.get<ScheduledMessagesResponse>('/scheduled-messages', {
        params: options,
      });
      return data;
    },
  });
}

export function useScheduledMessage(id: string | undefined) {
  return useQuery({
    queryKey: ['scheduled-messages', id],
    queryFn: async () => {
      const { data } = await api.get<ScheduledMessage>(`/scheduled-messages/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateScheduledMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateScheduledMessageDto) => {
      const { data } = await api.post<ScheduledMessage>('/scheduled-messages', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
    },
  });
}

export function useUpdateScheduledMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...dto }: Partial<CreateScheduledMessageDto> & { id: string }) => {
      const { data } = await api.put<ScheduledMessage>(`/scheduled-messages/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
    },
  });
}

export function useCancelScheduledMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ScheduledMessage>(`/scheduled-messages/${id}/cancel`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
    },
  });
}

export function useDeleteScheduledMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/scheduled-messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
    },
  });
}
