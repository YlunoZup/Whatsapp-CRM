import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../stores/auth-store';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  tenantName?: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const { data } = await api.post<AuthResponse>('/auth/login', credentials);
      return data;
    },
    onSuccess: (data) => {
      setAuth({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: async (registerData: RegisterData) => {
      const { data } = await api.post<AuthResponse>('/auth/register', registerData);
      return data;
    },
    onSuccess: (data) => {
      setAuth({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout', {});
    },
    onSuccess: () => {
      logout();
      queryClient.clear();
    },
    onError: () => {
      // Always logout locally even if API call fails
      logout();
      queryClient.clear();
    },
  });
}

export function useProfile() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/auth/profile');
      return data;
    },
    enabled: !!accessToken,
  });
}
