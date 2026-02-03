import React from 'react';
import { AlertTriangle, Phone, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionConflict } from '../../hooks/use-conversations';

interface SessionConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  conflict: SessionConflict;
  isLoading?: boolean;
}

export function SessionConflictDialog({
  isOpen,
  onClose,
  onConfirm,
  conflict,
  isLoading = false,
}: SessionConflictDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-card rounded-2xl shadow-premium-lg border border-border/50 w-full max-w-md overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">Session Conflict</h3>
            <p className="text-sm text-muted-foreground">This contact is assigned to another number</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{conflict.contact?.name || conflict.contact?.phone || 'This contact'}</span> is currently
            assigned to be messaged only from:
          </p>

          {/* Current Session */}
          <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl border border-border/50">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Phone className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {conflict.currentSession?.name || 'Unknown Session'}
              </p>
              <p className="text-sm text-muted-foreground">
                {conflict.currentSession?.phoneNumber || 'No phone number'}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">You are trying to message from:</p>

          {/* Requested Session */}
          <div className="flex items-center gap-3 p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Phone className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {conflict.requestedSession?.name || 'Unknown Session'}
              </p>
              <p className="text-sm text-muted-foreground">
                {conflict.requestedSession?.phoneNumber || 'No phone number'}
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              <span className="font-semibold">Warning:</span> Changing the assigned session means the contact will receive
              messages from a different number. This may cause confusion and affect your conversation history.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-border/50 bg-secondary/30 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all',
              'bg-amber-500 text-white shadow-sm',
              'hover:bg-amber-600 hover:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </span>
            ) : (
              'Change Session & Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
