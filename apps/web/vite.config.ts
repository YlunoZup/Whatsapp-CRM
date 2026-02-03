import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['lucide-react', 'date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 3004,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
