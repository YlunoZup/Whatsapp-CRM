import { useAuthStore } from '@/stores/auth-store';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

// Custom error class to preserve API response structure
export class ApiError extends Error {
  response: { data: unknown; status: number };

  constructor(message: string, data: unknown, status: number) {
    super(message);
    this.name = 'ApiError';
    this.response = { data, status };
  }
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeader(): Record<string, string> {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async refreshToken(): Promise<boolean> {
    const { refreshToken, setAuth, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        logout();
        return false;
      }

      const data = await response.json();
      setAuth({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return true;
    } catch {
      logout();
      return false;
    }
  }

  private async handleTokenRefresh(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      return this.refreshPromise!;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.refreshToken().finally(() => {
      this.isRefreshing = false;
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  async request<T>(endpoint: string, options: ApiOptions = {}, isRetry = false): Promise<{ data: T }> {
    const { method = 'GET', body, headers = {}, skipAuth = false } = options;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(skipAuth ? {} : this.getAuthHeader()),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && !skipAuth && !isRetry) {
      // Try to refresh the token
      const refreshed = await this.handleTokenRefresh();
      if (refreshed) {
        // Retry the original request with new token
        return this.request<T>(endpoint, options, true);
      }
      throw new ApiError('Session expired. Please login again.', { message: 'Session expired' }, 401);
    }

    if (response.status === 401) {
      useAuthStore.getState().logout();
      throw new ApiError('Unauthorized', { message: 'Unauthorized' }, 401);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new ApiError(errorData.message || 'Request failed', errorData, response.status);
    }

    const data = await response.json();
    return { data };
  }

  get<T>(endpoint: string, params?: Record<string, unknown> | object): Promise<{ data: T }> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryString}`;
      }
    }
    return this.request<T>(url);
  }

  post<T>(endpoint: string, body?: unknown, options?: { headers?: Record<string, string> }): Promise<{ data: T }> {
    return this.request<T>(endpoint, { method: 'POST', body: body ?? {}, headers: options?.headers });
  }

  put<T>(endpoint: string, body?: unknown, options?: { headers?: Record<string, string> }): Promise<{ data: T }> {
    return this.request<T>(endpoint, { method: 'PUT', body: body ?? {}, headers: options?.headers });
  }

  delete<T>(endpoint: string): Promise<{ data: T }> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  patch<T>(endpoint: string, body?: unknown, options?: { headers?: Record<string, string> }): Promise<{ data: T }> {
    return this.request<T>(endpoint, { method: 'PATCH', body: body ?? {}, headers: options?.headers });
  }
}

export type { ApiClient };
export const api = new ApiClient(API_BASE);

// Auth API - these endpoints don't require authentication
export const authApi = {
  login: (email: string, password: string) =>
    api.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string; role: string; tenantId: string };
    }>('/auth/login', { method: 'POST', body: { email, password }, skipAuth: true }),

  register: (data: { email: string; password: string; name: string; tenantName: string }) =>
    api.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string; role: string; tenantId: string };
    }>('/auth/register', { method: 'POST', body: data, skipAuth: true }),

  refresh: (refreshToken: string) =>
    api.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string; role: string; tenantId: string };
    }>('/auth/refresh', { method: 'POST', body: { refreshToken }, skipAuth: true }),
};

// Conversations API
export const conversationsApi = {
  getAll: (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return api.get<{ data: unknown[]; pagination: unknown }>(`/conversations?${searchParams}`);
  },
  getOne: (id: string) => api.get<unknown>(`/conversations/${id}`),
  close: (id: string) => api.post<unknown>(`/conversations/${id}/close`, {}),
  reopen: (id: string) => api.post<unknown>(`/conversations/${id}/reopen`, {}),
  assign: (id: string, userId: string | null) =>
    api.post<unknown>(`/conversations/${id}/assign`, { userId }),
  markRead: (id: string) => api.post<unknown>(`/conversations/${id}/read`, {}),
};

// Messages API
export const messagesApi = {
  getByConversation: (conversationId: string, params?: { cursor?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return api.get<{ data: unknown[]; pagination: unknown }>(
      `/conversations/${conversationId}/messages?${searchParams}`
    );
  },
  send: (data: {
    sessionId: string;
    to: string;
    type: string;
    content?: string;
    mediaUrl?: string;
  }) => api.post<{ jobId: string; status: string }>('/messages/send', data),
};

// Sessions API
export const sessionsApi = {
  getAll: () => api.get<unknown[]>('/sessions'),
  getOne: (id: string) => api.get<unknown>(`/sessions/${id}`),
  create: (data: { name: string; webhookUrl?: string }) => api.post<unknown>('/sessions', data),
  update: (id: string, data: { name?: string; webhookUrl?: string }) =>
    api.put<unknown>(`/sessions/${id}`, data),
  delete: (id: string) => api.delete<unknown>(`/sessions/${id}`),
  connect: (id: string) => api.post<unknown>(`/sessions/${id}/connect`, {}),
  disconnect: (id: string) => api.post<unknown>(`/sessions/${id}/disconnect`, {}),
  getQr: (id: string) => api.get<{ qrCode: string }>(`/sessions/${id}/qr`),
};

// Contacts API
export const contactsApi = {
  getAll: (params?: { search?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return api.get<{ data: unknown[]; pagination: unknown }>(`/contacts?${searchParams}`);
  },
  getOne: (id: string) => api.get<unknown>(`/contacts/${id}`),
  create: (data: { phone: string; name?: string; email?: string }) =>
    api.post<unknown>('/contacts', data),
  update: (id: string, data: { name?: string; email?: string }) =>
    api.put<unknown>(`/contacts/${id}`, data),
  delete: (id: string) => api.delete<unknown>(`/contacts/${id}`),
};

// Webhooks API
export const webhooksApi = {
  getEndpoints: () => api.get<unknown[]>('/webhooks/endpoints'),
  createEndpoint: (data: { name: string; url: string; events: string[] }) =>
    api.post<unknown>('/webhooks/endpoints', data),
  updateEndpoint: (id: string, data: { name?: string; url?: string; events?: string[]; isActive?: boolean }) =>
    api.put<unknown>(`/webhooks/endpoints/${id}`, data),
  deleteEndpoint: (id: string) => api.delete<unknown>(`/webhooks/endpoints/${id}`),
  getEndpointLogs: (id: string) => api.get<{ data: unknown[]; pagination: unknown }>(`/webhooks/endpoints/${id}/logs`),
};

// API Keys API
export const apiKeysApi = {
  getAll: () => api.get<unknown[]>('/api-keys'),
  create: (data: { name: string; permissions?: string[] }) =>
    api.post<{ id: string; name: string; key: string }>('/api-keys', data),
  delete: (id: string) => api.delete<unknown>(`/api-keys/${id}`),
};
