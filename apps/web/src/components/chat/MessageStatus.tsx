import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageStatusProps {
  status: string;
  className?: string;
  showLabel?: boolean;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-muted-foreground',
    label: 'Sending',
  },
  sent: {
    icon: Check,
    color: 'text-muted-foreground',
    label: 'Sent',
  },
  delivered: {
    icon: CheckCheck,
    color: 'text-muted-foreground',
    label: 'Delivered',
  },
  read: {
    icon: CheckCheck,
    color: 'text-blue-500 dark:text-blue-400',
    label: 'Read',
  },
  failed: {
    icon: AlertCircle,
    color: 'text-destructive',
    label: 'Failed',
  },
  received: {
    icon: Check,
    color: 'text-muted-foreground',
    label: 'Received',
  },
};

export function MessageStatus({ status, className, showLabel }: MessageStatusProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className={cn('inline-flex items-center gap-1', config.color, className)}
      title={config.label}
    >
      <Icon className="w-3.5 h-3.5" />
      {showLabel && <span className="text-xs">{config.label}</span>}
    </span>
  );
}

// Read receipt indicator with animation
export function ReadReceipt({ status }: { status: string }) {
  if (status === 'read') {
    return (
      <span className="inline-flex text-blue-500 dark:text-blue-400" title="Read">
        <CheckCheck className="w-4 h-4" />
      </span>
    );
  }

  if (status === 'delivered') {
    return (
      <span className="inline-flex text-muted-foreground" title="Delivered">
        <CheckCheck className="w-4 h-4" />
      </span>
    );
  }

  if (status === 'sent') {
    return (
      <span className="inline-flex text-muted-foreground" title="Sent">
        <Check className="w-4 h-4" />
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span className="inline-flex text-muted-foreground animate-pulse" title="Sending">
        <Clock className="w-4 h-4" />
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-flex text-destructive" title="Failed to send">
        <AlertCircle className="w-4 h-4" />
      </span>
    );
  }

  return null;
}

// Detailed status with timestamp
export function DetailedMessageStatus({
  status,
  timestamp,
  readAt,
  deliveredAt,
}: {
  status: string;
  timestamp: string;
  readAt?: string | null;
  deliveredAt?: string | null;
}) {
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <div className="flex items-center gap-2">
        <MessageStatus status="sent" />
        <span>Sent at {new Date(timestamp).toLocaleTimeString()}</span>
      </div>
      {deliveredAt && (
        <div className="flex items-center gap-2">
          <MessageStatus status="delivered" />
          <span>Delivered at {new Date(deliveredAt).toLocaleTimeString()}</span>
        </div>
      )}
      {readAt && (
        <div className="flex items-center gap-2">
          <MessageStatus status="read" />
          <span>Read at {new Date(readAt).toLocaleTimeString()}</span>
        </div>
      )}
      {status === 'failed' && (
        <div className="flex items-center gap-2">
          <MessageStatus status="failed" />
          <span>Failed to send</span>
        </div>
      )}
    </div>
  );
}
