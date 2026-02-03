import React, { useState, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { SlidersHorizontal, Check, CheckCheck, Search, MessageSquare, Circle, Phone, ThumbsUp, ThumbsDown, Trophy, XCircle } from 'lucide-react';
import { useConversations } from '../../hooks/use-conversations';
import { useChatStore } from '../../stores/chat-store';
import { ConversationFiltersBar, type ConversationFilters } from './ConversationFilters';
import { cn } from '@/lib/utils';
import type { Conversation } from '@whatsapp-crm/shared';

// Lead status configuration
const LEAD_STATUSES = {
  new: { label: 'New', color: '#6366f1', icon: Circle },
  contacted: { label: 'Contacted', color: '#0ea5e9', icon: Phone },
  interested: { label: 'Interested', color: '#22c55e', icon: ThumbsUp },
  not_interested: { label: 'Not Interested', color: '#f97316', icon: ThumbsDown },
  closed_won: { label: 'Won', color: '#10b981', icon: Trophy },
  closed_lost: { label: 'Lost', color: '#ef4444', icon: XCircle },
} as const;

type LeadStatus = keyof typeof LEAD_STATUSES;

// Muted, monochromatic avatar colors - subtle variations of neutral/slate tones
const avatarColors = [
  'bg-slate-600',
  'bg-slate-700',
  'bg-zinc-600',
  'bg-zinc-700',
  'bg-neutral-600',
  'bg-neutral-700',
  'bg-stone-600',
  'bg-gray-600',
];

function getAvatarColor(id: string): string {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function formatMessageTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  // Less than a minute ago
  if (diffMins < 1) {
    return 'Just now';
  }

  // Less than an hour ago
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  // Today - show time if within last few hours, otherwise show hours ago
  if (isToday(date)) {
    if (diffHours < 6) {
      return `${diffHours}h ago`;
    }
    return format(date, 'h:mm a');
  }

  if (isYesterday(date)) {
    return 'Yesterday';
  }

  // Within the last week
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) {
    return format(date, 'EEEE'); // Day name like "Monday"
  }

  return format(date, 'MM/dd/yyyy');
}

interface ConversationListProps {
  onSelectConversation: (conversation: Conversation) => void;
}

const defaultFilters: ConversationFilters = {
  status: null,
  sessionId: null,
  assignedTo: null,
  sortBy: 'lastMessage',
};

export function ConversationList({ onSelectConversation }: ConversationListProps) {
  const selectedConversation = useChatStore((state) => state.selectedConversation);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [search, setSearch] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<ConversationFilters>(defaultFilters);

  const { data, isLoading, error } = useConversations({
    status: (advancedFilters.status || (filter !== 'all' ? filter : undefined)) as 'open' | 'closed' | undefined,
    sessionId: advancedFilters.sessionId || undefined,
    assignedTo: advancedFilters.assignedTo === 'unassigned' ? '' : (advancedFilters.assignedTo || undefined),
  });

  const conversations = useMemo(() => {
    if (!data?.data) return [];

    let filtered = data.data;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.contact?.name?.toLowerCase().includes(searchLower) ||
          c.contact?.phone?.includes(search)
      );
    }

    if (advancedFilters.sortBy === 'unread') {
      filtered = [...filtered].sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0));
    } else if (advancedFilters.sortBy === 'oldest') {
      filtered = [...filtered].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    return filtered;
  }, [data?.data, search, advancedFilters.sortBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-card">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 dark:text-red-400 bg-card">
        Failed to load conversations
      </div>
    );
  }

  const hasActiveFilters = advancedFilters.status || advancedFilters.sessionId || advancedFilters.assignedTo;

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      {/* Search */}
      <div className="flex-shrink-0 p-4 border-b border-border/50">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border rounded-xl',
                'text-foreground placeholder:text-muted-foreground/60',
                'transition-all duration-200 ease-out',
                'focus:outline-none focus:bg-background focus:border-primary/50 focus:ring-4 focus:ring-primary/10'
              )}
            />
          </div>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={cn(
              'p-2.5 rounded-xl transition-all duration-200',
              showAdvancedFilters || hasActiveFilters
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            title="Advanced filters"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Advanced filters */}
      {showAdvancedFilters && (
        <ConversationFiltersBar
          filters={advancedFilters}
          onChange={setAdvancedFilters}
        />
      )}

      {/* Filter tabs */}
      <div className="flex-shrink-0 flex border-b border-border/50">
        {(['all', 'open', 'closed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setAdvancedFilters({ ...advancedFilters, status: f === 'all' ? null : f });
            }}
            className={cn(
              'flex-1 py-3 text-sm font-medium capitalize transition-all duration-200',
              filter === f
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
            <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
            <p>No conversations found</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedConversation?.id === conversation.id}
              onClick={() => onSelectConversation(conversation)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const lastMessage = conversation.messages?.[0];
  const contact = conversation.contact;
  // Show the contact's assigned session if available, otherwise fall back to conversation session
  const assignedSession = contact?.assignedSession || conversation.session;
  const avatarColor = getAvatarColor(conversation.id);
  const isOutgoing = lastMessage?.direction === 'outbound';
  const hasUnread = conversation.unreadCount && conversation.unreadCount > 0;

  // Get lead status from contact
  const leadStatus = ((contact as any)?.status || 'new') as LeadStatus;
  const statusConfig = LEAD_STATUSES[leadStatus] || LEAD_STATUSES.new;
  const StatusIcon = statusConfig.icon;

  const MessageStatusIcon = () => {
    if (!isOutgoing || !lastMessage) return null;
    const status = lastMessage.status;
    if (status === 'read') {
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    } else if (status === 'delivered') {
      return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
    } else if (status === 'sent') {
      return <Check className="w-4 h-4 text-muted-foreground" />;
    }
    return null;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center px-4 py-3 cursor-pointer transition-all duration-200',
        isSelected
          ? 'bg-primary/10'
          : 'hover:bg-accent/50'
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          'text-white text-lg font-medium',
          avatarColor
        )}>
          {contact?.name?.[0]?.toUpperCase() || contact?.phone?.[0] || '?'}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 ml-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'text-[15px] truncate',
              hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground'
            )}>
              {contact?.name || contact?.phone || 'Unknown'}
            </span>
            {assignedSession?.name && (
              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground truncate max-w-[60px]" title={`Assigned to: ${assignedSession.name}${assignedSession.phoneNumber ? ` (${assignedSession.phoneNumber})` : ''}`}>
                {assignedSession.name}
              </span>
            )}
          </div>
          <span className={cn(
            'text-xs flex-shrink-0 ml-2',
            hasUnread ? 'text-primary font-medium' : 'text-muted-foreground'
          )}>
            {(conversation.lastMessageAt || conversation.createdAt) &&
              formatMessageTime(new Date(conversation.lastMessageAt || conversation.createdAt))}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <MessageStatusIcon />
            <p className={cn(
              'text-sm truncate',
              hasUnread ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {lastMessage?.type === 'image' ? '📷 Photo' :
               lastMessage?.type === 'video' ? '🎥 Video' :
               lastMessage?.type === 'audio' ? '🎵 Audio' :
               lastMessage?.type === 'document' ? '📄 Document' :
               lastMessage?.content || 'No messages yet'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            {/* Lead status indicator */}
            <span
              className="inline-flex items-center justify-center gap-1 text-[10px] leading-none px-1.5 py-1 rounded-md font-medium"
              style={{
                backgroundColor: `${statusConfig.color}15`,
                color: statusConfig.color,
              }}
              title={`Lead: ${statusConfig.label}`}
            >
              <StatusIcon className="w-2.5 h-2.5 flex-shrink-0" />
              {leadStatus !== 'new' && <span>{statusConfig.label}</span>}
            </span>
            {/* Conversation status indicator */}
            <span className={cn(
              'inline-flex items-center justify-center text-[10px] leading-none px-1.5 py-1 rounded-md font-medium capitalize',
              conversation.status === 'open'
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            )}>
              {conversation.status}
            </span>
            {hasUnread && (
              <span className="bg-primary text-primary-foreground text-[11px] font-semibold min-w-[20px] h-[20px] flex items-center justify-center rounded-full px-1.5">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
