import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

interface Broadcast {
  id: string;
  tenantId: string;
  sessionId: string;
  name: string;
  content: string;
  type: string;
  mediaUrl?: string;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalCount: number;
  sentCount: number;
  failedCount: number;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  recipients?: BroadcastRecipient[];
  _count?: {
    recipients: number;
  };
}

interface BroadcastRecipient {
  id: string;
  broadcastId: string;
  contactId: string;
  phone: string;
  status: string;
  error?: string;
  sentAt?: string;
  createdAt: string;
}

interface CreateBroadcastData {
  name: string;
  sessionId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'document';
  mediaUrl?: string;
  contactIds: string[];
  scheduledAt?: string;
}

interface BroadcastStats {
  total: number;
  completed: number;
  processing: number;
  scheduled: number;
  recentBroadcasts: Broadcast[];
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useBroadcasts(options?: { page?: number; limit?: number; status?: string }) {
  const { page = 1, limit = 10, status } = options || {};

  return useQuery({
    queryKey: ['broadcasts', { page, limit, status }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (status) params.set('status', status);

      const { data } = await api.get<PaginatedResponse<Broadcast>>(`/broadcasts?${params}`);
      return data;
    },
  });
}

export function useBroadcast(id: string) {
  return useQuery({
    queryKey: ['broadcasts', id],
    queryFn: async () => {
      const { data } = await api.get<Broadcast>(`/broadcasts/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useBroadcastStats() {
  return useQuery({
    queryKey: ['broadcasts', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<BroadcastStats>('/broadcasts/stats');
      return data;
    },
  });
}

export function useCreateBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (broadcastData: CreateBroadcastData) => {
      const { data } = await api.post<Broadcast>('/broadcasts', broadcastData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });
}

export function useStartBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/broadcasts/${id}/start`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });
}

export function useCancelBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/broadcasts/${id}/cancel`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });
}

export function useDeleteBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/broadcasts/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });
}
