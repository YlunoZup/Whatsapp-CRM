import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2,
} from 'lucide-react';
import {
  useSessionLogs,
  useSessionLogStats,
  useSessionLogEventTypes,
  useClearSessionLogs,
  type LogLevel,
  type SessionLogsFilters,
} from '../../hooks/use-sessions';

interface SessionLogsModalProps {
  sessionId: string;
  sessionName: string;
  isOpen: boolean;
  onClose: () => void;
}

const LOG_LEVEL_CONFIG: Record<
  LogLevel,
  { icon: typeof Info; color: string; bgColor: string; label: string }
> = {
  debug: {
    icon: Bug,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    label: 'Debug',
  },
  info: {
    icon: Info,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'Info',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    label: 'Warning',
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'Error',
  },
};

export function SessionLogsModal({
  sessionId,
  sessionName,
  isOpen,
  onClose,
}: SessionLogsModalProps) {
  const [filters, setFilters] = useState<SessionLogsFilters>({
    page: 1,
    limit: 50,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { data: logsData, isLoading, refetch, isFetching } = useSessionLogs(sessionId, filters);
  const { data: stats } = useSessionLogStats(sessionId);
  const { data: eventTypes } = useSessionLogEventTypes(sessionId);
  const clearLogs = useClearSessionLogs();

  if (!isOpen) return null;

  const logs = logsData?.data || [];
  const pagination = logsData?.pagination;

  const handleLevelFilter = (level: LogLevel | undefined) => {
    setFilters((prev) => ({ ...prev, level, page: 1 }));
  };

  const handleEventFilter = (event: string | undefined) => {
    setFilters((prev) => ({ ...prev, event, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to clear logs older than 30 days?')) {
      await clearLogs.mutateAsync({ sessionId, daysToKeep: 30 });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal - Dynamic height with reasonable constraints */}
      <div className="relative w-full max-w-3xl max-h-[70vh] bg-card rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Header - Compact */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Session Logs</h2>
            <p className="text-xs text-muted-foreground">{sessionName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleClearLogs}
              disabled={clearLogs.isPending}
              className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Clear old logs"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats - Compact */}
        {stats && (
          <div className="px-3 py-2 border-b border-border bg-accent/30">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs">
                <span className="text-muted-foreground">Total:</span>{' '}
                <span className="font-medium">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                {(Object.keys(LOG_LEVEL_CONFIG) as LogLevel[]).map((level) => {
                  const config = LOG_LEVEL_CONFIG[level];
                  const count = stats.byLevel[level] || 0;
                  const Icon = config.icon;
                  const isActive = filters.level === level;

                  return (
                    <button
                      key={level}
                      onClick={() => handleLevelFilter(isActive ? undefined : level)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        isActive
                          ? `${config.bgColor} ${config.color}`
                          : 'text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{count}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showFilters ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                <Filter className="w-3 h-3" />
                Filters
              </button>
            </div>

            {/* Expanded filters */}
            {showFilters && eventTypes && eventTypes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2">Filter by event:</div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => handleEventFilter(undefined)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      !filters.event
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All
                  </button>
                  {eventTypes.map((event) => (
                    <button
                      key={event}
                      onClick={() => handleEventFilter(filters.event === event ? undefined : event)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        filters.event === event
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {event}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logs list - Scrollable with min/max constraints */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[200px] max-h-[400px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Info className="w-12 h-12 mb-2 opacity-50" />
              <p>No logs found</p>
              {(filters.level || filters.event) && (
                <button
                  onClick={() => setFilters({ page: 1, limit: 50 })}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => {
                const config = LOG_LEVEL_CONFIG[log.level];
                const Icon = config.icon;
                const isExpanded = expandedLogId === log.id;
                const hasMetadata =
                  log.metadata && Object.keys(log.metadata).length > 0;

                return (
                  <div
                    key={log.id}
                    className={`rounded-lg border border-border overflow-hidden transition-colors ${
                      isExpanded ? 'bg-accent/50' : 'bg-card hover:bg-accent/30'
                    }`}
                  >
                    <div
                      className="flex items-start gap-2 p-2 cursor-pointer"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      <div className={`p-1 rounded ${config.bgColor}`}>
                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-medium px-1.5 py-0.5 rounded ${config.bgColor} ${config.color}`}
                          >
                            {log.event}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(log.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-foreground break-words line-clamp-2">
                          {log.message}
                        </p>
                      </div>
                      {hasMetadata && (
                        <div className="text-muted-foreground">
                          <ChevronRight
                            className={`w-4 h-4 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Expanded metadata */}
                    {isExpanded && hasMetadata && (
                      <div className="px-2 pb-2 pt-0">
                        <div className="p-1.5 rounded bg-background border border-border max-h-[150px] overflow-y-auto">
                          <div className="text-[10px] text-muted-foreground mb-0.5">
                            {formatTimestamp(log.createdAt)}
                          </div>
                          <pre className="text-[10px] text-foreground overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination - Compact */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-accent/30">
            <div className="text-xs text-muted-foreground">
              {pagination.page}/{pagination.totalPages} ({pagination.total} logs)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
