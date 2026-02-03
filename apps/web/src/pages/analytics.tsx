import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  MessageSquare,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  RefreshCw,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth-store';
import { SimpleSelect } from '@/components/ui/CustomSelect';

interface AnalyticsData {
  overview: {
    totalMessages: number;
    messagesChange: number;
    totalConversations: number;
    conversationsChange: number;
    totalContacts: number;
    contactsChange: number;
    avgResponseTime: number;
    responseTimeChange: number;
  };
  messagesByDay: Array<{
    date: string;
    inbound: number;
    outbound: number;
  }>;
  conversationsByStatus: Array<{
    status: string;
    count: number;
  }>;
  topAgents: Array<{
    id: string;
    name: string;
    messagesHandled: number;
    avgResponseTime: number;
    conversationsClosed: number;
  }>;
  messagesBySession: Array<{
    sessionId: string;
    sessionName: string;
    count: number;
  }>;
}

type DateRange = '7d' | '14d' | '30d' | '90d';

const dateRanges: { label: string; value: DateRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 14 days', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
];

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  format: formatFn,
}: {
  title: string;
  value: number;
  change: number;
  icon: React.ComponentType<{ className?: string }>;
  format?: (val: number) => string;
}) {
  const isPositive = change >= 0;
  const displayValue = formatFn ? formatFn(value) : value.toLocaleString();

  return (
    <div className="bg-card p-6 rounded-lg border shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold mt-1">{displayValue}</p>
        </div>
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
      <div className="flex items-center mt-4 text-sm">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-green-500 dark:text-green-400 mr-1" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400 mr-1" />
        )}
        <span className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          {isPositive ? '+' : ''}{change}%
        </span>
        <span className="text-muted-foreground ml-2">vs previous period</span>
      </div>
    </div>
  );
}

function SimpleBarChart({ data, height = 200 }: { data: { label: string; value: number }[]; height?: number }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
            style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: item.value > 0 ? '4px' : '0' }}
            title={`${item.label}: ${item.value}`}
          />
          <span className="text-xs text-muted-foreground mt-2 truncate w-full text-center">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const days = parseInt(dateRange);
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');

      const { data } = await api.get<AnalyticsData>('/analytics', { startDate, endDate });
      return data;
    },
  });

  const handleExport = async () => {
    try {
      const days = parseInt(dateRange);
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');

      // Use fetch directly since the endpoint returns a file, not JSON
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`/api/v1/analytics/export?startDate=${startDate}&endDate=${endDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${startDate}-${endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Monitor your CRM performance and metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <SimpleSelect
            value={dateRange}
            onChange={(value) => setDateRange(value as DateRange)}
            options={dateRanges.map((range) => ({
              value: range.value,
              label: range.label,
            }))}
            className="w-40"
          />
          <button
            onClick={() => refetch()}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : analytics ? (
        <>
          {/* Overview stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Messages"
              value={analytics.overview.totalMessages}
              change={analytics.overview.messagesChange}
              icon={MessageSquare}
            />
            <StatCard
              title="Conversations"
              value={analytics.overview.totalConversations}
              change={analytics.overview.conversationsChange}
              icon={BarChart3}
            />
            <StatCard
              title="Contacts"
              value={analytics.overview.totalContacts}
              change={analytics.overview.contactsChange}
              icon={Users}
            />
            <StatCard
              title="Avg Response Time"
              value={analytics.overview.avgResponseTime}
              change={analytics.overview.responseTimeChange}
              icon={Calendar}
              format={formatTime}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Messages over time */}
            <div className="bg-card p-6 rounded-lg border shadow-sm">
              <h3 className="font-semibold mb-4">Messages Over Time</h3>
              <SimpleBarChart
                data={analytics.messagesByDay.map((d) => ({
                  label: format(new Date(d.date), 'MMM d'),
                  value: d.inbound + d.outbound,
                }))}
                height={200}
              />
              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-muted-foreground rounded" />
                  <span className="text-muted-foreground">Inbound</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary rounded" />
                  <span className="text-muted-foreground">Outbound</span>
                </div>
              </div>
            </div>

            {/* Conversations by status */}
            <div className="bg-card p-6 rounded-lg border shadow-sm">
              <h3 className="font-semibold mb-4">Conversations by Status</h3>
              <div className="space-y-4">
                {analytics.conversationsByStatus.map((item) => {
                  const total = analytics.conversationsByStatus.reduce((sum, i) => sum + i.count, 0);
                  const percentage = total > 0 ? (item.count / total) * 100 : 0;
                  return (
                    <div key={item.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{item.status}</span>
                        <span className="text-sm text-muted-foreground">{item.count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.status === 'open' ? 'bg-green-500' :
                            item.status === 'pending' ? 'bg-yellow-500' : 'bg-muted-foreground'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Agent performance */}
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h3 className="font-semibold mb-4">Agent Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Agent</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Messages Handled</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Avg Response Time</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Conversations Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topAgents.length > 0 ? (
                    analytics.topAgents.map((agent) => (
                      <tr key={agent.id} className="border-b last:border-0">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{agent.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">{agent.messagesHandled.toLocaleString()}</td>
                        <td className="py-3 text-right">{formatTime(agent.avgResponseTime)}</td>
                        <td className="py-3 text-right">{agent.conversationsClosed}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        No agent data available for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Messages by session */}
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h3 className="font-semibold mb-4">Messages by Session</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analytics.messagesBySession.length > 0 ? (
                analytics.messagesBySession.map((session) => (
                  <div
                    key={session.sessionId}
                    className="p-4 bg-muted/50 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{session.sessionName}</p>
                      <p className="text-sm text-muted-foreground">WhatsApp Session</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold">{session.count.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">messages</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center text-muted-foreground py-8">
                  No session data available
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <p>No analytics data available</p>
        </div>
      )}
    </div>
  );
}
