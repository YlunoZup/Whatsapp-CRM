import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { MessageTemplate } from '@whatsapp-crm/shared';

type TemplateCategory = 'greeting' | 'follow_up' | 'support' | 'sales' | 'notification' | 'other';

interface CreateTemplateData {
  name: string;
  content: string;
  variables?: string[];
  category?: TemplateCategory;
}

interface UpdateTemplateData {
  name?: string;
  content?: string;
  variables?: string[];
  category?: TemplateCategory;
}

interface RenderTemplateData {
  templateId: string;
  variables: Record<string, string>;
}

export function useTemplates(category?: TemplateCategory) {
  return useQuery({
    queryKey: ['templates', { category }],
    queryFn: async () => {
      const { data } = await api.get<MessageTemplate[]>('/templates', {
        params: category ? { category } : undefined,
      });
      return data;
    },
  });
}

export function useTemplatesGrouped() {
  return useQuery({
    queryKey: ['templates', 'grouped'],
    queryFn: async () => {
      const { data } = await api.get<Record<string, MessageTemplate[]>>('/templates/grouped');
      return data;
    },
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: async () => {
      const { data } = await api.get<MessageTemplate>(`/templates/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateData: CreateTemplateData) => {
      const { data } = await api.post<MessageTemplate>('/templates', templateData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateTemplateData & { id: string }) => {
      const { data } = await api.patch<MessageTemplate>(`/templates/${id}`, updateData);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.setQueryData(['templates', data.id], data);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/templates/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useRenderTemplate() {
  return useMutation({
    mutationFn: async ({ templateId, variables }: RenderTemplateData) => {
      const { data } = await api.post<string>('/templates/render', {
        templateId,
        variables,
      });
      return data;
    },
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      const url = name ? `/templates/${id}/duplicate?name=${encodeURIComponent(name)}` : `/templates/${id}/duplicate`;
      const { data } = await api.post<MessageTemplate>(url);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
