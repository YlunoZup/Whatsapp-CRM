import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ApiKey } from '@whatsapp-crm/shared';

interface CreateApiKeyData {
  name: string;
  permissions: string[];
  expiresAt?: string;
}

interface ApiKeyWithSecret extends ApiKey {
  key?: string; // Only returned on creation
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data } = await api.get<ApiKey[]>('/api-keys');
      return data;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyData: CreateApiKeyData) => {
      const { data } = await api.post<ApiKeyWithSecret>('/api-keys', keyData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api-keys/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}
