import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { WebhookEndpoint } from '@whatsapp-crm/shared';

interface CreateWebhookData {
  name: string;
  url: string;
  events: string[];
  secret?: string;
}

interface UpdateWebhookData {
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  isActive?: boolean;
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data } = await api.get<WebhookEndpoint[]>('/webhooks');
      return data;
    },
  });
}

export function useWebhook(id: string) {
  return useQuery({
    queryKey: ['webhooks', id],
    queryFn: async () => {
      const { data } = await api.get<WebhookEndpoint>(`/webhooks/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (webhookData: CreateWebhookData) => {
      const { data } = await api.post<WebhookEndpoint>('/webhooks', webhookData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateWebhookData & { id: string }) => {
      const { data } = await api.patch<WebhookEndpoint>(`/webhooks/${id}`, updateData);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      queryClient.setQueryData(['webhooks', data.id], data);
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/webhooks/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/webhooks/${id}/test`);
      return data;
    },
  });
}

export function useToggleWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data } = await api.patch<WebhookEndpoint>(`/webhooks/${id}`, { isActive });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      queryClient.setQueryData(['webhooks', data.id], data);
    },
  });
}
