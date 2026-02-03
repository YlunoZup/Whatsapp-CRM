import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAuthStore } from '@/stores/auth-store';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { LoginPage } from '@/pages/auth/login';
import { RegisterPage } from '@/pages/auth/register';

// Lazy load pages for code splitting
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })));
const ConversationsPage = lazy(() => import('@/pages/conversations').then(m => ({ default: m.ConversationsPage })));
const ContactsPage = lazy(() => import('@/pages/contacts').then(m => ({ default: m.ContactsPage })));
const SessionsPage = lazy(() => import('@/pages/sessions').then(m => ({ default: m.SessionsPage })));
const SettingsPage = lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })));
const IntegrationsPage = lazy(() => import('@/pages/integrations').then(m => ({ default: m.IntegrationsPage })));
const BroadcastsPage = lazy(() => import('@/pages/broadcasts').then(m => ({ default: m.BroadcastsPage })));
const UsersPage = lazy(() => import('@/pages/users').then(m => ({ default: m.UsersPage })));
const TemplatesPage = lazy(() => import('@/pages/templates').then(m => ({ default: m.TemplatesPage })));
const AnalyticsPage = lazy(() => import('@/pages/analytics').then(m => ({ default: m.AnalyticsPage })));
const ScheduledMessagesPage = lazy(() => import('@/pages/scheduled-messages').then(m => ({ default: m.ScheduledMessagesPage })));
const AuditLogsPage = lazy(() => import('@/pages/audit-logs').then(m => ({ default: m.AuditLogsPage })));

// Loading spinner for lazy loaded pages
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-whatsapp-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
          <Route path="conversations" element={<Suspense fallback={<PageLoader />}><ConversationsPage /></Suspense>} />
          <Route path="conversations/:id" element={<Suspense fallback={<PageLoader />}><ConversationsPage /></Suspense>} />
          <Route path="contacts" element={<Suspense fallback={<PageLoader />}><ContactsPage /></Suspense>} />
          <Route path="sessions" element={<Suspense fallback={<PageLoader />}><SessionsPage /></Suspense>} />
          <Route path="integrations" element={<Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense>} />
          <Route path="broadcasts" element={<Suspense fallback={<PageLoader />}><BroadcastsPage /></Suspense>} />
          <Route path="users" element={<Suspense fallback={<PageLoader />}><UsersPage /></Suspense>} />
          <Route path="templates" element={<Suspense fallback={<PageLoader />}><TemplatesPage /></Suspense>} />
          <Route path="analytics" element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
          <Route path="scheduled" element={<Suspense fallback={<PageLoader />}><ScheduledMessagesPage /></Suspense>} />
          <Route path="audit-logs" element={<Suspense fallback={<PageLoader />}><AuditLogsPage /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
