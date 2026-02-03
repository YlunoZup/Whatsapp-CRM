import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export interface Reaction {
  userId: string | null;
  userName?: string;
  isFromContact?: boolean;
}

export type GroupedReactions = Record<string, Reaction[]>;

export function useReactions(messageId: string) {
  return useQuery({
    queryKey: ['reactions', messageId],
    queryFn: async (): Promise<GroupedReactions> => {
      const { data } = await api.get<GroupedReactions>(`/messages/${messageId}/reactions`);
      return data;
    },
    enabled: !!messageId,
  });
}

export function useAddReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const { data } = await api.post(`/messages/${messageId}/reactions`, { emoji });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reactions', variables.messageId] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to add reaction';
      console.error('Reaction error:', message);
    },
  });
}

export function useRemoveReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const { data } = await api.delete(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reactions', variables.messageId] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to remove reaction';
      console.error('Reaction error:', message);
    },
  });
}

export const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '🎉', '💯'];
