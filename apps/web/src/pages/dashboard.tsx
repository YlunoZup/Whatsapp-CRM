import { useNavigate } from 'react-router-dom';
import { useDashboardStats, useMessageTrends, useRecentActivity } from '../hooks/use-dashboard';
import { useSessions } from '../hooks/use-sessions';
import { useConversations } from '../hooks/use-conversations';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquare,
  Users,
  Radio,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowUpRight,
  Send,
  Inbox,
  Zap,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: sessions } = useSessions();
  const { data: conversationsData } = useConversations({ limit: 4 });
  const { data: messageTrends } = useMessageTrends(7);
  const { data: recentActivity } = useRecentActivity(5);

  const conversations = conversationsData?.data || [];
  const connectedSessions = sessions?.filter((s) => s.status === 'connected').length || 0;
  const totalSessions = sessions?.length || 0;

  // Calculate message trend
  const getTrendPercentage = () => {
    if (!messageTrends || messageTrends.length < 2) return 0;
    const recent = messageTrends.slice(-3).reduce((sum, d) => sum + d.inbound + d.outbound, 0);
    const previous = messageTrends.slice(0, 3).reduce((sum, d) => sum + d.inbound + d.outbound, 0);
    if (previous === 0) return 0;
    return Math.round(((recent - previous) / previous) * 100);
  };

  const trendPercentage = getTrendPercentage();

  // Mini sparkline data
  const sparklineData = messageTrends?.map((d) => d.inbound + d.outbound) || [];
  const maxSparkline = Math.max(...sparklineData, 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
        {/* Bento Grid Container */}
        <div className="grid grid-cols-12 gap-3 lg:gap-4">

          {/* Hero Stats Section - spans full width */}
          <div className="col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {/* Total Conversations - Hero Metric */}
            <div className={cn(
              "group relative col-span-1 bg-gradient-to-br from-primary/5 via-card to-card",
              "rounded-2xl border border-primary/10 p-5 lg:p-6",
              "hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5",
              "transition-all duration-300"
            )}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Conversations
                  </p>
                  <p className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                    {statsLoading ? '—' : stats?.totalConversations || 0}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs text-primary font-medium">
                      {stats?.openConversations || 0} open
                    </span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Messages Today - With Sparkline */}
            <div className={cn(
              "group relative col-span-1 bg-card rounded-2xl border border-border/50 p-5 lg:p-6",
              "hover:border-border hover:shadow-lg transition-all duration-300"
            )}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Today
                  </p>
                  <p className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                    {statsLoading ? '—' : stats?.messagesToday || 0}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {trendPercentage !== 0 && (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 text-xs font-medium",
                        trendPercentage > 0 ? "text-emerald-500" : "text-orange-500"
                      )}>
                        {trendPercentage > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(trendPercentage)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Send className="w-5 h-5" />
                </div>
              </div>
              {/* Mini Sparkline */}
              <div className="absolute bottom-3 right-3 flex items-end gap-0.5 h-8 opacity-40">
                {sparklineData.slice(-7).map((val, i) => (
                  <div
                    key={i}
                    className="w-1 bg-primary/60 rounded-full transition-all"
                    style={{ height: `${(val / maxSparkline) * 100}%`, minHeight: '2px' }}
                  />
                ))}
              </div>
            </div>

            {/* Active Contacts */}
            <div className={cn(
              "group relative col-span-1 bg-card rounded-2xl border border-border/50 p-5 lg:p-6",
              "hover:border-border hover:shadow-lg transition-all duration-300"
            )}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Contacts
                  </p>
                  <p className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                    {statsLoading ? '—' : stats?.totalContacts || 0}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs text-muted-foreground">total saved</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                  <Users className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Response Rate */}
            <div className={cn(
              "group relative col-span-1 bg-card rounded-2xl border border-border/50 p-5 lg:p-6",
              "hover:border-border hover:shadow-lg transition-all duration-300"
            )}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Response
                  </p>
                  <p className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                    {statsLoading ? '—' : `${stats?.responseRate || 0}%`}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs text-muted-foreground">reply rate</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-500">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              {/* Progress ring */}
              <div className="absolute bottom-3 right-3 w-10 h-10 opacity-30">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
                  <circle
                    cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                    className="text-violet-500"
                    strokeDasharray={`${(stats?.responseRate || 0) * 0.94} 94`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Main Content Row */}
          {/* Recent Conversations - Large Card */}
          <div className="col-span-12 lg:col-span-7 xl:col-span-8">
            <div className={cn(
              "h-full bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50",
              "overflow-hidden"
            )}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Inbox className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Recent Conversations</h3>
                    <p className="text-xs text-muted-foreground">{conversations.length} active chats</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/conversations')}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium",
                    "text-primary hover:text-primary/80 hover:bg-primary/5 rounded-lg",
                    "transition-colors"
                  )}
                >
                  View all
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Conversations List */}
              <div className="divide-y divide-border/30">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="p-4 rounded-2xl bg-primary/5 mb-4">
                      <MessageSquare className="w-8 h-8 text-primary/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">No conversations yet</p>
                    <button
                      onClick={() => navigate('/contacts')}
                      className="mt-3 text-xs text-primary hover:underline"
                    >
                      Start messaging contacts
                    </button>
                  </div>
                ) : (
                  conversations.map((conv, idx) => (
                    <button
                      key={conv.id}
                      onClick={() => navigate(`/conversations?id=${conv.id}`)}
                      className={cn(
                        "w-full flex items-center gap-4 px-5 py-3.5",
                        "hover:bg-accent/30 transition-colors text-left group"
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "relative flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center",
                        "text-white font-semibold text-sm",
                        idx % 4 === 0 ? "bg-slate-600" :
                        idx % 4 === 1 ? "bg-zinc-600" :
                        idx % 4 === 2 ? "bg-neutral-600" : "bg-stone-600"
                      )}>
                        {conv.contact?.name?.[0]?.toUpperCase() || conv.contact?.phone?.[0] || '?'}
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-[10px] font-bold text-white rounded-full flex items-center justify-center">
                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">
                            {conv.contact?.name || conv.contact?.phone || 'Unknown'}
                          </p>
                          {conv.status === 'open' && (
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {conv.messages?.[0]?.content || 'No messages'}
                        </p>
                      </div>

                      {/* Meta */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">
                          {(conv.lastMessageAt || conv.createdAt) &&
                            formatDistanceToNow(new Date(conv.lastMessageAt || conv.createdAt), { addSuffix: false })}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Sessions + Quick Actions */}
          <div className="col-span-12 lg:col-span-5 xl:col-span-4 space-y-3 lg:space-y-4">
            {/* Sessions Status - Compact */}
            <div className={cn(
              "bg-gradient-to-br from-[#00A884]/5 via-card to-card",
              "rounded-2xl border border-[#00A884]/10 p-5",
              "hover:border-[#00A884]/20 transition-all duration-300"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#00A884]/10">
                    <Radio className="w-4 h-4 text-[#00A884]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Sessions</h3>
                    <p className="text-xs text-muted-foreground">{connectedSessions} of {totalSessions} active</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/sessions')}
                  className="text-xs font-medium text-[#00A884] hover:text-[#008069] transition-colors"
                >
                  Manage
                </button>
              </div>

              {/* Sessions Grid */}
              {totalSessions === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground mb-3">No sessions configured</p>
                  <button
                    onClick={() => navigate('/sessions')}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium",
                      "bg-[#00A884] hover:bg-[#008069] text-white rounded-lg transition-colors"
                    )}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Add Session
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions?.slice(0, 3).map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl",
                        "bg-background/50 border border-border/30"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          session.status === 'connected' ? "bg-[#00A884]" :
                          session.status === 'connecting' ? "bg-amber-500 animate-pulse" : "bg-muted-foreground/50"
                        )} />
                        <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                          {session.name}
                        </span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium uppercase tracking-wider",
                        session.status === 'connected' ? "text-[#00A884]" :
                        session.status === 'connecting' ? "text-amber-500" : "text-muted-foreground"
                      )}>
                        {session.status === 'connected' ? 'Online' : session.status}
                      </span>
                    </div>
                  ))}
                  {(sessions?.length || 0) > 3 && (
                    <p className="text-center text-[10px] text-muted-foreground pt-1">
                      +{sessions!.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions - Grid */}
            <div className="bg-card rounded-2xl border border-border/50 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 px-1">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Users, label: 'New Contact', path: '/contacts', color: 'text-blue-500 bg-blue-500/10' },
                  { icon: MessageSquare, label: 'View Chats', path: '/conversations', color: 'text-primary bg-primary/10' },
                  { icon: Send, label: 'Broadcast', path: '/broadcasts', color: 'text-violet-500 bg-violet-500/10' },
                  { icon: Radio, label: 'Sessions', path: '/sessions', color: 'text-[#00A884] bg-[#00A884]/10' },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className={cn(
                      "group flex items-center gap-2.5 p-3 rounded-xl",
                      "bg-secondary/30 hover:bg-accent border border-transparent hover:border-border/50",
                      "transition-all duration-200"
                    )}
                  >
                    <div className={cn("p-1.5 rounded-lg", action.color)}>
                      <action.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Feed - Compact */}
            <div className="bg-card rounded-2xl border border-border/50 p-4">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold text-foreground">Activity</h3>
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                {!recentActivity || recentActivity.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  recentActivity.slice(0, 4).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/30 transition-colors"
                    >
                      <div className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center",
                        activity.direction === 'inbound'
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-blue-500/10 text-blue-500"
                      )}>
                        {activity.direction === 'inbound' ? (
                          <Inbox className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {activity.contact?.name || activity.contact?.phone}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {activity.content?.slice(0, 30) || 'Message'}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: false })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Open Conversations Alert - Full Width */}
          {stats && stats.openConversations > 0 && (
            <div className="col-span-12">
              <div className={cn(
                "relative overflow-hidden rounded-2xl",
                "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent",
                "border border-primary/20 p-4 lg:p-5"
              )}>
                {/* Decorative blur */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/15 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">
                        {stats.openConversations} conversation{stats.openConversations > 1 ? 's' : ''} need attention
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Waiting for your response
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/conversations?status=open')}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2",
                      "bg-primary text-primary-foreground text-sm font-medium rounded-xl",
                      "hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20",
                      "transition-all duration-200 active:scale-[0.98]"
                    )}
                  >
                    View Open
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
