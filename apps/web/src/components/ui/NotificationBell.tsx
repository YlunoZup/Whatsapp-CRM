import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNotificationStore, type Notification, type NotificationType } from '@/stores/notification-store';

const typeStyles: Record<NotificationType, string> = {
  info: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  success: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  warning: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
  error: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
};

const typeIcons: Record<NotificationType, string> = {
  info: '💬',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

function NotificationItem({
  notification,
  onMarkAsRead,
  onRemove,
  onClick,
}: {
  notification: Notification;
  onMarkAsRead: () => void;
  onRemove: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        'p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors',
        !notification.read && 'bg-blue-50/50 dark:bg-blue-950/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{typeIcons[notification.type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm font-medium', !notification.read && 'text-foreground')}>
              {notification.title}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!notification.read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead();
                  }}
                  className="p-1 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 rounded"
                  title="Mark as read"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="p-1 text-muted-foreground hover:text-red-600 rounded"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotificationStore();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors ${isOpen ? 'z-[75]' : ''}`}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-[16px] text-[10px] font-semibold text-white bg-red-500 rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div
            ref={dropdownRef}
            className="fixed right-4 top-16 w-80 bg-card rounded-xl shadow-2xl border border-border/50 z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          >
          <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-red-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsRead(notification.id)}
                  onRemove={() => removeNotification(notification.id)}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))
            )}
          </div>
          </div>
        </>
      )}
    </>
  );
}
