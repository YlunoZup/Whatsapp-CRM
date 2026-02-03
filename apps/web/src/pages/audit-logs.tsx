import { useState, useMemo } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import {
  History,
  User,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  FileText,
  Users,
  MessageSquare,
  Radio,
  Tag,
  Settings,
  Key,
  Webhook,
  Clock,
} from 'lucide-react';
import { useAuditLogs, useAuditResources, type AuditLog } from '@/hooks/use-audit-logs';
import { useUsers } from '@/hooks/use-users';
import { SimpleSelect } from '@/components/ui/CustomSelect';
import { cn } from '@/lib/utils';

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  user: <Users className="w-4 h-4" />,
  contact: <User className="w-4 h-4" />,
  conversation: <MessageSquare className="w-4 h-4" />,
  message: <MessageSquare className="w-4 h-4" />,
  broadcast: <Radio className="w-4 h-4" />,
  session: <Radio className="w-4 h-4" />,
  tag: <Tag className="w-4 h-4" />,
  template: <FileText className="w-4 h-4" />,
  webhook: <Webhook className="w-4 h-4" />,
  apikey: <Key className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
  auth: <Key className="w-4 h-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-500/10 text-green-500 border-green-500/20',
  updated: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  deleted: 'bg-red-500/10 text-red-500 border-red-500/20',
  login: 'bg-primary/10 text-primary border-primary/20',
  logout: 'bg-muted text-muted-foreground border-border',
  login_failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  assigned: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  closed: 'bg-muted text-muted-foreground border-border',
  reopened: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  imported: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  exported: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  bulk: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  sent: 'bg-green-500/10 text-green-500 border-green-500/20',
  connected: 'bg-green-500/10 text-green-500 border-green-500/20',
  disconnected: 'bg-red-500/10 text-red-500 border-red-500/20',
};

function getActionColor(action: string): string {
  const actionPart = action.split('.').pop() || '';
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (actionPart.includes(key)) return color;
  }
  return 'bg-muted text-muted-foreground border-border';
}

function formatAction(action: string): string {
  return action
    .split('.')
    .map(part => part.replace(/_/g, ' '))
    .join(' / ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function AuditLogDetails({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l border-border h-full overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Activity Details</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Action */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</label>
            <div className="mt-1">
              <span className={cn(
                'inline-flex px-2.5 py-1 text-sm font-medium rounded-lg border',
                getActionColor(log.action)
              )}>
                {formatAction(log.action)}
              </span>
            </div>
          </div>

          {/* Resource */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resource</label>
            <div className="mt-1 flex items-center gap-2 text-foreground">
              {RESOURCE_ICONS[log.resource] || <FileText className="w-4 h-4" />}
              <span className="capitalize">{log.resource}</span>
              {log.resourceId && (
                <code className="text-xs bg-muted px-2 py-0.5 rounded">{log.resourceId}</code>
              )}
            </div>
          </div>

          {/* User */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User</label>
            <div className="mt-1">
              {log.user ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                    {log.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{log.user.name}</p>
                    <p className="text-sm text-muted-foreground">{log.user.email}</p>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">System</span>
              )}
            </div>
          </div>

          {/* Timestamp */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</label>
            <div className="mt-1 flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-muted-foreground" />
              {format(parseISO(log.createdAt), 'PPpp')}
            </div>
          </div>

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</label>
              <div className="mt-2 bg-muted/50 rounded-lg p-4">
                <pre className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* IP Address */}
          {log.ipAddress && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">IP Address</label>
              <div className="mt-1 text-foreground">
                <code className="text-sm bg-muted px-2 py-0.5 rounded">{log.ipAddress}</code>
              </div>
            </div>
          )}

          {/* User Agent */}
          {log.userAgent && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User Agent</label>
              <div className="mt-1">
                <p className="text-sm text-muted-foreground break-words">{log.userAgent}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [userId, setUserId] = useState('');
  const [resource, setResource] = useState('');
  const [dateRange, setDateRange] = useState('7d');

  const { data: users } = useUsers();
  const { data: resources } = useAuditResources();

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    let start: Date;
    switch (dateRange) {
      case '1d': start = subDays(end, 1); break;
      case '7d': start = subDays(end, 7); break;
      case '30d': start = subDays(end, 30); break;
      case '60d': start = subDays(end, 60); break;
      default: start = subDays(end, 7);
    }
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    };
  }, [dateRange]);

  const { data: auditLogs, isLoading, refetch } = useAuditLogs({
    page,
    limit: 50,
    userId: userId || undefined,
    resource: resource || undefined,
    startDate,
    endDate,
  });

  const clearFilters = () => {
    setUserId('');
    setResource('');
    setDateRange('7d');
    setPage(1);
  };

  const hasActiveFilters = userId || resource || dateRange !== '7d';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
            <History className="w-7 h-7 text-primary" />
            Activity Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Track all actions and changes made in your workspace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
              showFilters || hasActiveFilters
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-card border-border text-foreground hover:bg-accent'
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => refetch()}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4 animate-fade-in">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">User</label>
              <SimpleSelect
                value={userId}
                onChange={(value) => { setUserId(value); setPage(1); }}
                options={[
                  { value: '', label: 'All Users' },
                  ...(users?.data?.map(u => ({ value: u.id, label: u.name })) || []),
                ]}
                placeholder="All Users"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Resource</label>
              <SimpleSelect
                value={resource}
                onChange={(value) => { setResource(value); setPage(1); }}
                options={[
                  { value: '', label: 'All Resources' },
                  ...(resources?.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) })) || []),
                ]}
                placeholder="All Resources"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Date Range</label>
              <SimpleSelect
                value={dateRange}
                onChange={(value) => { setDateRange(value); setPage(1); }}
                options={[
                  { value: '1d', label: 'Last 24 hours' },
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                  { value: '60d', label: 'Last 60 days' },
                ]}
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Activity Log Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : auditLogs?.data.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground">No activity found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters ? 'Try adjusting your filters' : 'Activity will appear here as actions are performed'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Action
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Resource
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    User
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLogs?.data.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 text-xs font-medium rounded border',
                        getActionColor(log.action)
                      )}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        {RESOURCE_ICONS[log.resource] || <FileText className="w-4 h-4" />}
                        <span className="capitalize">{log.resource}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-medium text-white">
                            {log.user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-foreground">{log.user.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {format(parseISO(log.createdAt), 'MMM d, h:mm a')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {auditLogs && auditLogs.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, auditLogs.pagination.total)} of {auditLogs.pagination.total} entries
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-foreground px-2">
                    Page {page} of {auditLogs.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(auditLogs.pagination.totalPages, p + 1))}
                    disabled={page === auditLogs.pagination.totalPages}
                    className="p-2 rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Details Drawer */}
      {selectedLog && (
        <AuditLogDetails log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
