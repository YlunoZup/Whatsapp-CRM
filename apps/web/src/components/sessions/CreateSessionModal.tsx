import React, { useState } from 'react';
import { X, Radio, AlertCircle } from 'lucide-react';
import { useCreateSession } from '../../hooks/use-sessions';
import { cn } from '@/lib/utils';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (sessionId: string) => void;
}

export function CreateSessionModal({ isOpen, onClose, onCreated }: CreateSessionModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const createSession = useCreateSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Session name is required');
      return;
    }

    try {
      const session = await createSession.mutateAsync({ name: name.trim() });
      setName('');
      setError('');
      onClose();
      onCreated?.(session.id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create session');
    }
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-premium-lg border border-border/50 w-full max-w-sm animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Radio className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">New WhatsApp Session</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {error && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Session Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="e.g., Sales Team, Support"
                className={cn(
                  'w-full px-4 py-2.5 rounded-xl transition-all duration-200',
                  'bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
                )}
                autoFocus
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Give your session a descriptive name to identify it easily.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/50 bg-secondary/30 rounded-b-2xl">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSession.isPending}
              className={cn(
                'px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200',
                'bg-primary text-primary-foreground shadow-sm',
                'hover:bg-primary/90 hover:shadow-md',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {createSession.isPending ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
