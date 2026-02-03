import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogsParams {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export function useAuditLogs(params: AuditLogsParams = {}) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      const { data } = await api.get<AuditLogsResponse>('/audit-logs', params);
      return data;
    },
  });
}

export function useAuditActions() {
  return useQuery({
    queryKey: ['audit-actions'],
    queryFn: async () => {
      const { data } = await api.get<Record<string, string[]>>('/audit-logs/actions');
      return data;
    },
    staleTime: Infinity, // Actions don't change often
  });
}

export function useAuditResources() {
  return useQuery({
    queryKey: ['audit-resources'],
    queryFn: async () => {
      const { data } = await api.get<string[]>('/audit-logs/resources');
      return data;
    },
    staleTime: Infinity, // Resources don't change often
  });
}
