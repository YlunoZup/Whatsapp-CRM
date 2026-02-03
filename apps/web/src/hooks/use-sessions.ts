import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { WhatsappSession } from '@whatsapp-crm/shared';

interface CreateSessionData {
  name: string;
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await api.get<WhatsappSession[]>('/sessions');
      return data;
    },
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: async () => {
      const { data } = await api.get<WhatsappSession>(`/sessions/${id}`);
      return data;
    },
    enabled: !!id,
    // Refetch more frequently when session might be connecting
    refetchInterval: (query) => {
      const session = query.state.data;
      if (session?.status === 'connecting') {
        return 3000; // 3 seconds
      }
      return false;
    },
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionData: CreateSessionData) => {
      const { data } = await api.post<WhatsappSession>('/sessions', sessionData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useConnectSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{ qrCode: string }>(`/sessions/${id}/connect`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', id] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useDisconnectSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/sessions/${id}/disconnect`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', id] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/sessions/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export interface QrCodeData {
  qrCode: string;
  generatedAt: string;
  expiresAt: string;
  expirySeconds: number;
  remainingSeconds: number;
  isExpired: boolean;
}

export function useSessionQrCode(id: string) {
  return useQuery({
    queryKey: ['sessions', id, 'qr'],
    queryFn: async () => {
      const { data } = await api.get<QrCodeData>(`/sessions/${id}/qr`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 5000, // Check every 5 seconds for fresher expiration data
    staleTime: 3000,
    retry: 1, // Don't retry too much if QR not available
  });
}

// ============================================
// SESSION LOGS
// ============================================

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

export interface SessionLog {
  id: string;
  sessionId: string;
  level: LogLevel;
  event: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SessionLogsResponse {
  data: SessionLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SessionLogStats {
  total: number;
  byLevel: {
    debug: number;
    info: number;
    warning: number;
    error: number;
  };
  topEvents: Array<{
    event: string;
    count: number;
  }>;
}

export interface SessionLogsFilters {
  level?: LogLevel;
  event?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export function useSessionLogs(sessionId: string, filters: SessionLogsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.level) params.set('level', filters.level);
  if (filters.event) params.set('event', filters.event);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const queryString = params.toString();
  const url = `/sessions/${sessionId}/logs${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['sessions', sessionId, 'logs', filters],
    queryFn: async () => {
      const { data } = await api.get<SessionLogsResponse>(url);
      return data;
    },
    enabled: !!sessionId,
    refetchInterval: 10000, // Refresh every 10 seconds for live updates
    staleTime: 5000,
  });
}

export function useSessionLogStats(sessionId: string) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'logs', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<SessionLogStats>(`/sessions/${sessionId}/logs/stats`);
      return data;
    },
    enabled: !!sessionId,
  });
}

export function useSessionLogEventTypes(sessionId: string) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'logs', 'events'],
    queryFn: async () => {
      const { data } = await api.get<string[]>(`/sessions/${sessionId}/logs/events`);
      return data;
    },
    enabled: !!sessionId,
  });
}

export function useClearSessionLogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, daysToKeep }: { sessionId: string; daysToKeep?: number }) => {
      const params = daysToKeep ? `?daysToKeep=${daysToKeep}` : '';
      const { data } = await api.delete<{ deletedCount: number }>(`/sessions/${sessionId}/logs${params}`);
      return data;
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'logs'] });
    },
  });
}

// ============================================
// SESSION HEALTH
// ============================================

export interface SessionHealthMetrics {
  sessionId: string;
  accountAgeDays: number;
  messagesToday: number;
  messagesThisHour: number;
  newContactsToday: number;
  totalOutbound: number;
  totalInbound: number;
  replyRate: number;
  errorCountToday: number;
  warningCountToday: number;
  lastActivityMinutesAgo: number;
  isConnected: boolean;
  healthScore: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'warning' | 'critical';
  factors: {
    accountAge: { score: number; max: number; detail: string };
    messageVolume: { score: number; max: number; detail: string };
    newContacts: { score: number; max: number; detail: string };
    replyRate: { score: number; max: number; detail: string };
    errorRate: { score: number; max: number; detail: string };
  };
  recommendations: string[];
  limits: {
    maxMessagesPerDay: number;
    maxNewContactsPerDay: number;
    maxMessagesPerHour: number;
    recommendedRestHours: number;
  };
}

export function useSessionHealth(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'health'],
    queryFn: async () => {
      const { data } = await api.get<SessionHealthMetrics>(`/sessions/${sessionId}/health`);
      return data;
    },
    enabled: !!sessionId && enabled,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider stale after 30 seconds
  });
}
