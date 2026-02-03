import React, { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, RefreshCw, CheckCircle2, Clock, Loader2, Smartphone } from 'lucide-react';
import { useSessionQrCode, useSession, useConnectSession } from '../../hooks/use-sessions';
import { subscribeToSessionStatus, subscribeToQrCodeUpdate } from '../../services/socket';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface QRCodeModalProps {
  sessionId: string;
  sessionName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeModal({ sessionId, sessionName, isOpen, onClose }: QRCodeModalProps) {
  const queryClient = useQueryClient();
  const { data: session, refetch: refetchSession } = useSession(sessionId);
  const isConnected = session?.status === 'connected';

  // Only fetch QR code if not connected
  const { data: qrData, isLoading, error, refetch, isError } = useSessionQrCode(
    isConnected ? '' : sessionId
  );
  const connectSession = useConnectSession();

  const [countdown, setCountdown] = useState(60);
  const [isExpired, setIsExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null);
  const [realtimeQrCode, setRealtimeQrCode] = useState<string | null>(null);

  // Subscribe to real-time session status changes
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    const unsubscribeStatus = subscribeToSessionStatus((data) => {
      if (data.sessionId === sessionId) {
        logger.log('[QRModal] Real-time status update:', data.status);
        setRealtimeStatus(data.status);

        // Invalidate queries to sync with server state
        queryClient.invalidateQueries({ queryKey: ['sessions', sessionId] });
        queryClient.invalidateQueries({ queryKey: ['sessions'] });

        // If connected, also refetch to ensure we have latest data
        if (data.status === 'connected') {
          refetchSession();
        }

        // If we got a new QR code with the status update, use it directly
        if (data.qrCode) {
          setRealtimeQrCode(data.qrCode);
          setIsExpired(false);
          setCountdown(60);
        }
      }
    });

    // Subscribe to QR code updates
    const unsubscribeQr = subscribeToQrCodeUpdate((data) => {
      if (data.sessionId === sessionId) {
        logger.log('[QRModal] Real-time QR code update');
        setRealtimeQrCode(data.qrCode);
        setIsExpired(false);
        // Calculate new countdown from expiry
        const expiresAt = new Date(data.expiresAt).getTime();
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        setCountdown(remaining);
        // Invalidate QR query to stay in sync
        queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'qr'] });
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeQr();
      setRealtimeStatus(null);
      setRealtimeQrCode(null);
    };
  }, [isOpen, sessionId, queryClient, refetchSession]);

  // Determine effective connection status (prefer real-time over query)
  const effectiveStatus = realtimeStatus || session?.status;
  const effectivelyConnected = effectiveStatus === 'connected';

  // Countdown timer effect
  useEffect(() => {
    if (!qrData || !isOpen) return;

    const expiresAt = new Date(qrData.expiresAt).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setCountdown(remaining);
      setIsExpired(remaining <= 0);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [qrData, isOpen]);

  // Auto-refresh when expired
  useEffect(() => {
    if (isExpired && !isRefreshing && !effectivelyConnected) {
      handleRefresh();
    }
  }, [isExpired, isRefreshing, effectivelyConnected]);

  // Refetch QR code when modal opens
  useEffect(() => {
    if (isOpen && sessionId) {
      refetch();
    }
  }, [isOpen, sessionId, refetch]);

  // Auto-close when connected (with longer delay so user sees the success)
  useEffect(() => {
    if (effectivelyConnected) {
      const timeout = setTimeout(() => {
        onClose();
      }, 2000); // Give user 2 seconds to see the success state
      return () => clearTimeout(timeout);
    }
  }, [effectivelyConnected, onClose]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await connectSession.mutateAsync(sessionId);
      await refetch();
      setIsExpired(false);
    } catch (err) {
      logger.error('Failed to refresh QR:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [sessionId, connectSession, refetch, isRefreshing]);

  if (!isOpen) return null;

  const isConnecting = effectiveStatus === 'connecting';
  const showLoading = isLoading || isRefreshing;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-premium-lg border border-border/50 w-full max-w-sm animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Link Device</h2>
              <p className="text-xs text-muted-foreground">{sessionName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Status */}
          {effectivelyConnected ? (
            <div className="flex items-center justify-center gap-2 py-3 mb-4 text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">Connected successfully!</span>
            </div>
          ) : isConnecting ? (
            <div className="flex items-center justify-center gap-2 py-3 mb-4 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-medium">Connecting...</span>
            </div>
          ) : isExpired ? (
            <div className="flex items-center justify-center gap-2 py-3 mb-4 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-xl">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Expired - refreshing...</span>
            </div>
          ) : null}

          {/* QR Code */}
          <div className="flex justify-center mb-4">
            {effectivelyConnected ? (
              <div className="w-52 h-52 flex items-center justify-center bg-green-500/10 rounded-2xl">
                <CheckCircle2 className="w-20 h-20 text-green-500" />
              </div>
            ) : showLoading ? (
              <div className="w-52 h-52 flex items-center justify-center bg-muted rounded-2xl">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              </div>
            ) : isError && !qrData ? (
              <div className="w-52 h-52 flex items-center justify-center bg-red-500/10 rounded-2xl text-center px-4">
                <p className="text-sm text-red-500">Failed to load QR code</p>
              </div>
            ) : (realtimeQrCode || qrData?.qrCode) ? (
              <div className={cn(
                'bg-white p-3 rounded-xl shadow-sm',
                isExpired && 'opacity-30'
              )}>
                <img
                  src={realtimeQrCode || qrData?.qrCode}
                  alt="QR Code"
                  className="w-44 h-44"
                />
              </div>
            ) : (
              <div className="w-52 h-52 flex items-center justify-center bg-muted rounded-2xl">
                <p className="text-sm text-muted-foreground">Waiting...</p>
              </div>
            )}
          </div>

          {/* Timer */}
          {(realtimeQrCode || qrData) && !effectivelyConnected && !showLoading && !isExpired && (
            <div className="flex items-center justify-center gap-2 mb-4 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Expires in {countdown}s</span>
            </div>
          )}

          {/* Instructions */}
          {!effectivelyConnected && (
            <div className="bg-secondary/50 rounded-xl p-4 mb-4 space-y-2">
              <p className="text-sm font-medium text-foreground mb-2">How to connect:</p>
              <ol className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex gap-2">
                  <span className="text-primary font-medium">1.</span>
                  Open WhatsApp on your phone
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-medium">2.</span>
                  Go to Settings → Linked Devices
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-medium">3.</span>
                  Scan this QR code
                </li>
              </ol>
            </div>
          )}

          {/* Refresh button */}
          {!effectivelyConnected && (
            <button
              onClick={handleRefresh}
              disabled={showLoading}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium',
                'border border-border text-muted-foreground',
                'hover:bg-accent hover:text-foreground transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {showLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{showLoading ? 'Refreshing...' : 'Refresh QR Code'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
