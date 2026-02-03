import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { User } from '@whatsapp-crm/shared';

interface UsersParams {
  page?: number;
  limit?: number;
  search?: string;
}

interface UsersResponse {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'agent' | 'viewer';
}

interface UpdateUserData {
  name?: string;
  role?: 'admin' | 'agent' | 'viewer';
  isActive?: boolean;
}

export function useUsers(params: UsersParams = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const { data } = await api.get<UsersResponse>('/users', params);
      return data;
    },
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async () => {
      const { data } = await api.get<User>(`/users/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: CreateUserData) => {
      const { data } = await api.post<User>('/users', userData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateUserData & { id: string }) => {
      const { data } = await api.patch<User>(`/users/${id}`, updateData);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.setQueryData(['users', data.id], data);
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      const { data } = await api.post(`/users/${id}/reset-password`, { newPassword });
      return data;
    },
  });
}

// Get all active users who can be assigned to conversations
export function useAgents() {
  return useQuery({
    queryKey: ['users', 'agents'],
    queryFn: async () => {
      const { data } = await api.get<UsersResponse>('/users', {
        params: { limit: 100 },
      });
      return data.data.filter((u) => u.isActive);
    },
  });
}
