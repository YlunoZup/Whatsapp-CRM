import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface ContactNote {
  id: string;
  contactId: string;
  userId: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactActivity {
  id: string;
  contactId: string;
  userId?: string;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface CreateNoteDto {
  contactId: string;
  content: string;
  isPinned?: boolean;
}

interface UpdateNoteDto {
  content?: string;
  isPinned?: boolean;
}

export function useContactNotes(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-notes', contactId],
    queryFn: async () => {
      const { data } = await api.get<ContactNote[]>('/contact-notes', {
        params: { contactId },
      });
      return data;
    },
    enabled: !!contactId,
  });
}

export function useCreateContactNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateNoteDto) => {
      const { data } = await api.post<ContactNote>('/contact-notes', dto);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', variables.contactId] });
      queryClient.invalidateQueries({ queryKey: ['contact-activity', variables.contactId] });
    },
  });
}

export function useUpdateContactNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contactId, ...dto }: UpdateNoteDto & { id: string; contactId: string }) => {
      const { data } = await api.put<ContactNote>(`/contact-notes/${id}`, dto);
      return { data, contactId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', result.contactId] });
    },
  });
}

export function useDeleteContactNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contactId }: { id: string; contactId: string }) => {
      await api.delete(`/contact-notes/${id}`);
      return { contactId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', result.contactId] });
    },
  });
}

export function useToggleContactNotePin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contactId }: { id: string; contactId: string }) => {
      const { data } = await api.post<ContactNote>(`/contact-notes/${id}/toggle-pin`);
      return { data, contactId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', result.contactId] });
    },
  });
}

export function useContactActivity(contactId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['contact-activity', contactId, limit],
    queryFn: async () => {
      const { data } = await api.get<ContactActivity[]>(`/contact-notes/activity/${contactId}`, {
        params: { limit },
      });
      return data;
    },
    enabled: !!contactId,
  });
}
