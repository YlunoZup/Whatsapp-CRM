import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Tag } from '@whatsapp-crm/shared';

interface CreateTagData {
  name: string;
  color?: string;
}

interface UpdateTagData {
  name?: string;
  color?: string;
}

interface TagWithCount extends Tag {
  _count: {
    contacts: number;
  };
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get<TagWithCount[]>('/tags');
      return data;
    },
  });
}

export function useTag(id: string) {
  return useQuery({
    queryKey: ['tags', id],
    queryFn: async () => {
      const { data } = await api.get<TagWithCount>(`/tags/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagData: CreateTagData) => {
      const { data } = await api.post<Tag>('/tags', tagData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateTagData & { id: string }) => {
      const { data } = await api.patch<Tag>(`/tags/${id}`, updateData);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.setQueryData(['tags', data.id], data);
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tags/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useAssignTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { data } = await api.post('/tags/assign', { contactId, tagId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useRemoveTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { data } = await api.delete(`/tags/contact/${contactId}/tag/${tagId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useContactsByTag(tagId: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['tags', tagId, 'contacts', { page, limit }],
    queryFn: async () => {
      const { data } = await api.get(`/tags/${tagId}/contacts`, {
        params: { page, limit },
      });
      return data;
    },
    enabled: !!tagId,
  });
}
