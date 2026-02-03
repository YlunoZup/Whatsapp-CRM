import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, X } from 'lucide-react';
import { logger } from '@/lib/logger';
import {
  useSessions,
  useConnectSession,
  useDisconnectSession,
  useDeleteSession,
} from '../hooks/use-sessions';
import { useBodyScrollLock } from '../hooks/use-body-scroll-lock';
import { SessionCard, QRCodeModal, CreateSessionModal, SessionLogsModal } from '../components/sessions';
import { subscribeToSessionStatus } from '../services/socket';
import type { WhatsappSession } from '@whatsapp-crm/shared';

export function SessionsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [qrSession, setQrSession] = useState<WhatsappSession | null>(null);
  const [logsSession, setLogsSession] = useState<WhatsappSession | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<WhatsappSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  const { data: sessions = [], isLoading, refetch } = useSessions();

  // Lock body scroll when delete modal is open
  useBodyScrollLock(!!deleteConfirm);

  // Subscribe to real-time session status updates
  useEffect(() => {
    const unsubscribe = subscribeToSessionStatus((data) => {
      logger.log('[SessionsPage] Real-time status update:', data.sessionId, data.status);
      // Invalidate queries to get fresh data
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['sessions', data.sessionId] });

      // If session connected and we're showing QR for this session, close it
      if (data.status === 'connected' && qrSession?.id === data.sessionId) {
        // Modal will auto-close, but let's also clear connecting state
        setConnecting(null);
      }
    });

    return () => unsubscribe();
  }, [queryClient, qrSession?.id]);
  const connectSession = useConnectSession();
  const disconnectSession = useDisconnectSession();
  const deleteSession = useDeleteSession();

  const handleConnect = async (session: WhatsappSession) => {
    setError(null);
    setConnecting(session.id);
    try {
      await connectSession.mutateAsync(session.id);
      // Refetch to get updated session data
      const { data: updatedSessions } = await refetch();
      // Find the updated session from refetch results
      const updatedSession = updatedSessions?.find((s) => s.id === session.id);
      setQrSession(updatedSession || session);
    } catch (err: any) {
      const message = err?.message || 'Failed to connect. Check if Evolution API is configured.';
      setError(`Connection failed for "${session.name}": ${message}`);
      logger.error('Failed to connect:', err);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (session: WhatsappSession) => {
    setError(null);
    try {
      await disconnectSession.mutateAsync(session.id);
    } catch (err: any) {
      const message = err?.message || 'Failed to disconnect';
      setError(`Disconnect failed for "${session.name}": ${message}`);
      logger.error('Failed to disconnect:', err);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      setError(null);
      try {
        await deleteSession.mutateAsync(deleteConfirm.id);
        setDeleteConfirm(null);
      } catch (err: any) {
        const message = err?.message || 'Failed to delete';
        setError(`Delete failed: ${message}`);
        logger.error('Failed to delete:', err);
      }
    }
  };

  const handleSessionCreated = async (sessionId: string) => {
    // Refetch sessions to get the new one
    const { data: updatedSessions } = await refetch();
    // Find the created session from the refetch results (not the stale closure)
    const session = updatedSessions?.find((s) => s.id === sessionId);
    if (session) {
      handleConnect(session);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">WhatsApp Sessions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your connected WhatsApp accounts
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Session
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-destructive font-medium">Connection Error</p>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-destructive/60 hover:text-destructive"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Sessions Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg shadow-sm border border-border p-4 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-muted rounded-full" />
                  <div>
                    <div className="h-4 bg-muted rounded w-24 mb-2" />
                    <div className="h-3 bg-muted rounded w-32" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-card rounded-lg shadow-sm border border-border p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No sessions yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Connect your WhatsApp account to start sending and receiving messages through the CRM
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Connect WhatsApp
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isConnecting={connecting === session.id}
              onConnect={() => handleConnect(session)}
              onDisconnect={() => handleDisconnect(session)}
              onDelete={() => setDeleteConfirm(session)}
              onShowQR={() => setQrSession(session)}
              onShowLogs={() => setLogsSession(session)}
            />
          ))}
        </div>
      )}

      {/* Status legend */}
      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="text-sm font-medium text-foreground mb-3">Session Status Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Connected - Ready to send/receive messages</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">Connecting - Establishing connection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">QR Pending - Scan QR code to connect</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">Disconnected - Click connect to start</span>
          </div>
        </div>
      </div>

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleSessionCreated}
      />

      {/* QR Code Modal */}
      {qrSession && (
        <QRCodeModal
          sessionId={qrSession.id}
          sessionName={qrSession.name}
          isOpen={!!qrSession}
          onClose={() => setQrSession(null)}
        />
      )}

      {/* Session Logs Modal */}
      {logsSession && (
        <SessionLogsModal
          sessionId={logsSession.id}
          sessionName={logsSession.name}
          isOpen={!!logsSession}
          onClose={() => setLogsSession(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-sm mx-4 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Session</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This will
              disconnect the WhatsApp account and remove all session data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSession.isPending}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteSession.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
