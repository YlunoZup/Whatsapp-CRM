import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface ForwardMessageParams {
  messageId: string;
  targetIds: string[];
  targetType: 'conversation' | 'contact';
}

export function useForwardMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, targetIds, targetType }: ForwardMessageParams) => {
      const { data } = await api.post(`/messages/${messageId}/forward`, {
        targetIds,
        targetType,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
