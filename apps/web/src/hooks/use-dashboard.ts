import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface DashboardStats {
  totalConversations: number;
  openConversations: number;
  totalContacts: number;
  totalMessages: number;
  messagesToday: number;
  activeSessions: number;
  totalSessions: number;
  responseRate: number;
}

interface ConversationTrend {
  date: string;
  count: number;
}

interface MessageTrend {
  date: string;
  inbound: number;
  outbound: number;
}

interface TopContact {
  id: string;
  name: string | null;
  phone: string;
  conversationCount: number;
}

interface RecentActivity {
  id: string;
  type: string;
  direction: string;
  content: string | null;
  createdAt: string;
  contact: {
    id: string;
    name: string | null;
    phone: string;
  };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<DashboardStats>('/dashboard/stats');
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useConversationTrends(days = 7) {
  return useQuery({
    queryKey: ['dashboard', 'conversation-trends', days],
    queryFn: async () => {
      const { data } = await api.get<ConversationTrend[]>('/dashboard/conversation-trends', { days });
      return data;
    },
  });
}

export function useMessageTrends(days = 7) {
  return useQuery({
    queryKey: ['dashboard', 'message-trends', days],
    queryFn: async () => {
      const { data } = await api.get<MessageTrend[]>('/dashboard/message-trends', { days });
      return data;
    },
  });
}

export function useTopContacts(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'top-contacts', limit],
    queryFn: async () => {
      const { data } = await api.get<TopContact[]>('/dashboard/top-contacts', { limit });
      return data;
    },
  });
}

export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity', limit],
    queryFn: async () => {
      const { data } = await api.get<RecentActivity[]>('/dashboard/recent-activity', { limit });
      return data;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });
}
