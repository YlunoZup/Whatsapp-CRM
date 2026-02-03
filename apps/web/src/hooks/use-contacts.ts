import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useChatStore } from '../stores/chat-store';
import type { Contact } from '@whatsapp-crm/shared';

interface ContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  tagId?: string;
}

interface ContactsResponse {
  data: Contact[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface CreateContactData {
  phone: string;
  name?: string;
  email?: string;
  notes?: string;
  customFields?: Record<string, any>;
  metadata?: Record<string, unknown>;
}

interface UpdateContactData extends Partial<CreateContactData> {
  metadata?: Record<string, unknown>;
}

export function useContacts(params: ContactsParams = {}) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn: async () => {
      const { data } = await api.get<ContactsResponse>('/contacts', params);
      return data;
    },
  });
}

export function useInfiniteContacts(params: Omit<ContactsParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: ['contacts', 'infinite', params],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<ContactsResponse>('/contacts', { ...params, page: pageParam });
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

export function useContact(id: string) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: async () => {
      const { data } = await api.get<Contact>(`/contacts/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactData: CreateContactData) => {
      const { data } = await api.post<Contact>('/contacts', contactData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  const updateContactInConversations = useChatStore((state) => state.updateContactInConversations);

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateContactData & { id: string }) => {
      const { data } = await api.put<Contact>(`/contacts/${id}`, updateData);
      return data;
    },
    onSuccess: (data) => {
      // Immediately update the chat store for instant UI feedback
      updateContactInConversations(data.id, data);

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData(['contacts', data.id], data);
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/contacts/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// Session assignment hooks
export function useAssignContactSession() {
  const queryClient = useQueryClient();
  const updateContactInConversations = useChatStore((state) => state.updateContactInConversations);

  return useMutation({
    mutationFn: async ({ contactId, sessionId, force }: { contactId: string; sessionId: string; force?: boolean }) => {
      const { data } = await api.post<Contact>(`/contacts/${contactId}/assign-session`, {
        sessionId,
        force,
      });
      return data;
    },
    onSuccess: (data) => {
      // Immediately update the chat store
      updateContactInConversations(data.id, data);

      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData(['contacts', data.id], data);
    },
  });
}

export function useUnassignContactSession() {
  const queryClient = useQueryClient();
  const updateContactInConversations = useChatStore((state) => state.updateContactInConversations);

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data } = await api.delete<Contact>(`/contacts/${contactId}/assign-session`);
      return data;
    },
    onSuccess: (data) => {
      // Immediately update the chat store
      updateContactInConversations(data.id, data);

      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData(['contacts', data.id], data);
    },
  });
}

// Lead status hooks
export function useUpdateContactStatus() {
  const queryClient = useQueryClient();
  const updateContactInConversations = useChatStore((state) => state.updateContactInConversations);

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.put<Contact>(`/contacts/${id}/status`, { status });
      return data;
    },
    onSuccess: (data) => {
      // Immediately update the chat store for instant UI feedback
      updateContactInConversations(data.id, { status: (data as any).status } as any);

      // Invalidate all related queries to ensure data consistency everywhere
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData(['contacts', data.id], data);
    },
  });
}

export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();
  const updateContactInConversations = useChatStore((state) => state.updateContactInConversations);

  return useMutation({
    mutationFn: async ({ contactIds, status }: { contactIds: string[]; status: string }) => {
      const { data } = await api.post<{ success: number; failed: number }>('/contacts/bulk/update-status', { contactIds, status });
      return { ...data, contactIds, status };
    },
    onSuccess: (data) => {
      // Immediately update the chat store for all affected contacts
      data.contactIds.forEach((id: string) => {
        updateContactInConversations(id, { status: data.status } as any);
      });

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useContactStatusCounts() {
  return useQuery({
    queryKey: ['contacts', 'status-counts'],
    queryFn: async () => {
      const { data } = await api.get<{ counts: Record<string, number>; total: number }>('/contacts/status-counts');
      return data;
    },
  });
}
