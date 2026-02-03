import React, { useState } from 'react';
import { X, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useResetUserPassword } from '../../hooks/use-users';
import type { User } from '@whatsapp-crm/shared';
import { cn } from '@/lib/utils';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export function ResetPasswordModal({ isOpen, onClose, user }: ResetPasswordModalProps) {
  const resetPassword = useResetUserPassword();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!user) return;

    try {
      await resetPassword.mutateAsync({ id: user.id, newPassword: password });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
    onClose();
  };

  if (!isOpen || !user) return null;

  const inputClasses = cn(
    'w-full px-4 py-2.5 rounded-xl transition-all duration-200',
    'bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground',
    'focus:outline-none focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
  );

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
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <KeyRound className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Reset Password</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-green-500 font-medium text-lg">Password Reset!</p>
              <p className="text-sm text-muted-foreground mt-1">The new password has been set.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Set a new password for <span className="font-medium text-foreground">{user.name || user.email}</span>
              </p>

              {error && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="At least 8 characters"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Re-enter password"
                  className={inputClasses}
                />
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        {!success && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/50 bg-secondary/30 rounded-b-2xl">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={resetPassword.isPending}
              className={cn(
                'px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200',
                'bg-primary text-primary-foreground shadow-sm',
                'hover:bg-primary/90 hover:shadow-md',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
