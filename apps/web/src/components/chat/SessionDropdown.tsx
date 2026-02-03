import { useState, useRef, useEffect } from 'react';
import { Phone, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { useSessions } from '@/hooks/use-sessions';
import { useAssignContactSession, useUnassignContactSession } from '@/hooks/use-contacts';
import { cn } from '@/lib/utils';

interface SessionDropdownProps {
  contactId: string;
  currentSession?: {
    id: string;
    name: string;
    phoneNumber?: string | null;
  } | null;
  onAssigned?: () => void;
  variant?: 'default' | 'compact';
}

export function SessionDropdown({
  contactId,
  currentSession,
  onAssigned,
  variant = 'default',
}: SessionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmChange, setConfirmChange] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: sessions, isLoading } = useSessions();
  const assignMutation = useAssignContactSession();
  const unassignMutation = useUnassignContactSession();

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Filter to only connected sessions
  const connectedSessions = sessions?.filter(s => s.status === 'connected') || [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setConfirmChange(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAssign = async (sessionId: string, force = false) => {
    // If clicking the currently assigned session, do nothing
    if (currentSession?.id === sessionId) {
      setIsOpen(false);
      return;
    }

    // If changing from one session to another, show confirmation
    if (currentSession && !force) {
      setConfirmChange(sessionId);
      return;
    }

    try {
      setError(null);
      // Always use force=true since the backend checks for existing assignment
      await assignMutation.mutateAsync({ contactId, sessionId, force: true });
      setIsOpen(false);
      setConfirmChange(null);
      onAssigned?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign session';
      setError(message);
    }
  };

  const handleUnassign = async () => {
    try {
      setError(null);
      await unassignMutation.mutateAsync(contactId);
      setIsOpen(false);
      onAssigned?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to unassign session';
      setError(message);
    }
  };

  const isPending = assignMutation.isPending || unassignMutation.isPending;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 text-sm rounded-lg transition-colors',
          variant === 'compact' ? 'w-full px-3 py-2' : 'px-3 py-1.5',
          currentSession
            ? 'bg-primary/10 text-primary hover:bg-primary/15'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
        title={currentSession ? `Assigned to: ${currentSession.name}` : 'No session assigned'}
      >
        <Phone className="w-4 h-4" />
        <span className={cn('truncate', variant === 'compact' ? 'flex-1 text-left' : 'max-w-[120px]')}>
          {currentSession?.name || 'No Session'}
        </span>
      </button>

      {isOpen && (
        <div className={cn(
          'bg-card rounded-lg shadow-lg border border-border z-50 overflow-hidden',
          variant === 'compact' ? 'absolute left-0 right-0 mt-1' : 'absolute right-0 mt-1 w-64'
        )}>
          <div className="p-2 border-b border-border bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground uppercase">WhatsApp Session</p>
            {currentSession && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Currently: {currentSession.phoneNumber || currentSession.name}
              </p>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="p-2 bg-destructive/10 border-b border-destructive/20">
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {error}
              </p>
            </div>
          )}

          {/* Confirmation dialog */}
          {confirmChange && (
            <div className="p-3 bg-muted/50 border-b border-border">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-foreground font-medium">
                    Change session?
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This contact will receive messages from a different number.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setConfirmChange(null)}
                      className="px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAssign(confirmChange, true)}
                      disabled={isPending}
                      className="px-2 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded disabled:opacity-50"
                    >
                      {isPending ? 'Changing...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-4 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {/* Unassign option */}
              {currentSession && (
                <button
                  onClick={handleUnassign}
                  disabled={isPending}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 text-muted-foreground disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </div>
                  <span>Remove assignment</span>
                </button>
              )}

              {/* Session list */}
              {connectedSessions.length > 0 ? (
                connectedSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleAssign(session.id)}
                    disabled={isPending}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-50',
                      currentSession?.id === session.id && 'bg-primary/10'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                      currentSession?.id === session.id
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{session.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.phoneNumber || 'No number'}
                      </p>
                    </div>
                    {currentSession?.id === session.id && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No connected sessions
                </div>
              )}

              {/* Show disconnected sessions */}
              {sessions && sessions.filter(s => s.status !== 'connected').length > 0 && (
                <>
                  <div className="px-3 py-2 bg-muted/30 border-t">
                    <p className="text-xs text-muted-foreground">Disconnected</p>
                  </div>
                  {sessions
                    .filter(s => s.status !== 'connected')
                    .map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm opacity-50"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{session.name}</p>
                          <p className="text-xs text-muted-foreground">Disconnected</p>
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
