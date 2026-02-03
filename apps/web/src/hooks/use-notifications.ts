import { useEffect, useCallback } from 'react';
import { socketService } from '@/services/socket';
import { useNotificationStore, type NotificationType } from '@/stores/notification-store';

interface SocketNotification {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, unknown>;
}

export function useSocketNotifications() {
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    const handleNotification = (notification: SocketNotification) => {
      addNotification(notification);
    };

    const handleNewMessage = (data: { conversationId: string; contactName: string; preview: string }) => {
      addNotification({
        type: 'info',
        title: `New message from ${data.contactName}`,
        message: data.preview,
        link: `/conversations/${data.conversationId}`,
        data: { conversationId: data.conversationId },
      });
    };

    const handleSessionStatus = (data: { sessionId: string; sessionName: string; status: string }) => {
      const isConnected = data.status === 'connected';
      addNotification({
        type: isConnected ? 'success' : 'warning',
        title: `Session ${isConnected ? 'Connected' : 'Disconnected'}`,
        message: `${data.sessionName} is now ${data.status}`,
        link: '/sessions',
        data: { sessionId: data.sessionId },
      });
    };

    const handleBroadcastComplete = (data: { broadcastId: string; name: string; sent: number; failed: number }) => {
      addNotification({
        type: data.failed > 0 ? 'warning' : 'success',
        title: 'Broadcast Complete',
        message: `"${data.name}" finished: ${data.sent} sent, ${data.failed} failed`,
        link: '/broadcasts',
        data: { broadcastId: data.broadcastId },
      });
    };

    const handleWebhookFailure = (data: { webhookId: string; url: string; error: string }) => {
      addNotification({
        type: 'error',
        title: 'Webhook Failed',
        message: `Failed to deliver to ${data.url}: ${data.error}`,
        link: '/integrations',
        data: { webhookId: data.webhookId },
      });
    };

    // Subscribe to socket events
    socketService.on('notification', handleNotification);
    socketService.on('new-message-notification', handleNewMessage);
    socketService.on('session-status-changed', handleSessionStatus);
    socketService.on('broadcast-complete', handleBroadcastComplete);
    socketService.on('webhook-failed', handleWebhookFailure);

    return () => {
      socketService.off('notification', handleNotification);
      socketService.off('new-message-notification', handleNewMessage);
      socketService.off('session-status-changed', handleSessionStatus);
      socketService.off('broadcast-complete', handleBroadcastComplete);
      socketService.off('webhook-failed', handleWebhookFailure);
    };
  }, [addNotification]);
}

export function useNotify() {
  const addNotification = useNotificationStore((state) => state.addNotification);

  const notify = useCallback(
    (
      type: NotificationType,
      title: string,
      message: string,
      options?: { link?: string; data?: Record<string, unknown> }
    ) => {
      addNotification({
        type,
        title,
        message,
        link: options?.link,
        data: options?.data,
      });
    },
    [addNotification]
  );

  const info = useCallback(
    (title: string, message: string, options?: { link?: string; data?: Record<string, unknown> }) => {
      notify('info', title, message, options);
    },
    [notify]
  );

  const success = useCallback(
    (title: string, message: string, options?: { link?: string; data?: Record<string, unknown> }) => {
      notify('success', title, message, options);
    },
    [notify]
  );

  const warning = useCallback(
    (title: string, message: string, options?: { link?: string; data?: Record<string, unknown> }) => {
      notify('warning', title, message, options);
    },
    [notify]
  );

  const error = useCallback(
    (title: string, message: string, options?: { link?: string; data?: Record<string, unknown> }) => {
      notify('error', title, message, options);
    },
    [notify]
  );

  return { notify, info, success, warning, error };
}
