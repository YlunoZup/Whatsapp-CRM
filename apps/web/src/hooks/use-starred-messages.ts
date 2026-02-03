import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Message } from '@whatsapp-crm/shared';

interface StarredMessagesResponse {
  data: (Message & {
    conversation: {
      contact: {
        name: string;
        phone: string;
      };
    };
  })[];
  total: number;
}

export function useStarredMessages(conversationId?: string) {
  return useQuery({
    queryKey: ['starred-messages', conversationId],
    queryFn: async (): Promise<StarredMessagesResponse> => {
      const params = new URLSearchParams();
      if (conversationId) params.append('conversationId', conversationId);
      const { data } = await api.get<StarredMessagesResponse>(`/messages/starred?${params.toString()}`);
      return data;
    },
  });
}

export function useStarMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await api.post(`/messages/${messageId}/star`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['starred-messages'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useUnstarMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data } = await api.delete(`/messages/${messageId}/star`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['starred-messages'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useToggleStarMessage() {
  const starMessage = useStarMessage();
  const unstarMessage = useUnstarMessage();

  return {
    toggle: (messageId: string, currentlyStarred: boolean) => {
      if (currentlyStarred) {
        return unstarMessage.mutateAsync(messageId);
      }
      return starMessage.mutateAsync(messageId);
    },
    isPending: starMessage.isPending || unstarMessage.isPending,
  };
}
