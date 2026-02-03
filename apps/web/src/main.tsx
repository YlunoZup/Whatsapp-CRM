import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Global mutation error handler
const mutationCache = new MutationCache({
  onError: (error: unknown) => {
    // Extract error message
    let message = 'An unexpected error occurred';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error !== null) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      message = err.response?.data?.message || err.message || message;
    }

    // Show browser notification for critical errors (fallback if toast not available)
    // The toast system handles most cases, but this catches any edge cases
    console.error('[Mutation Error]', message);
  },
});

const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
    mutations: {
      retry: 0, // Don't retry mutations by default
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
