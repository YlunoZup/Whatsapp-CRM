import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useConversations } from '../../hooks/use-conversations';
import { cn } from '@/lib/utils';
import { MessageSquare, ArrowRight } from 'lucide-react';

interface RecentConversationsProps {
  onViewConversation?: (conversationId: string) => void;
}

export function RecentConversations({ onViewConversation }: RecentConversationsProps) {
  const { data, isLoading } = useConversations({ limit: 5 });

  // Muted, monochromatic avatar colors - subtle neutral tones
  const getAvatarColor = (id: string) => {
    const colors = [
      'bg-slate-600',
      'bg-slate-700',
      'bg-zinc-600',
      'bg-zinc-700',
      'bg-neutral-600',
      'bg-neutral-700',
      'bg-stone-600',
      'bg-gray-600',
    ];
    const hash = (id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 shadow-premium p-6">
        <h3 className="text-lg font-semibold text-foreground mb-5">Recent Conversations</h3>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center space-x-4">
              <div className="w-12 h-12 bg-muted rounded-xl" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded-lg w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded-lg w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const conversations = data?.data || [];

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-premium p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-foreground">Recent Conversations</h3>
        <a
          href="/conversations"
          className="group inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
        >
          View all
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">No conversations yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map((conversation) => {
            const avatarColor = getAvatarColor(conversation.id);
            return (
              <button
                key={conversation.id}
                onClick={() => onViewConversation?.(conversation.id)}
                className={cn(
                  'w-full flex items-center gap-4 p-3 -mx-1 rounded-xl',
                  'hover:bg-accent/50 transition-all duration-200 text-left group'
                )}
              >
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  'text-white font-medium text-base',
                  'transition-transform duration-200 group-hover:scale-105',
                  avatarColor
                )}>
                  {conversation.contact?.name?.[0]?.toUpperCase() ||
                    conversation.contact?.phone?.[0] ||
                    '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {conversation.contact?.name || conversation.contact?.phone || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.messages?.[0]?.content || 'No messages'}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={cn(
                    'text-xs',
                    conversation.unreadCount > 0
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground'
                  )}>
                    {(conversation.lastMessageAt || conversation.createdAt) &&
                      formatDistanceToNow(new Date(conversation.lastMessageAt || conversation.createdAt), {
                        addSuffix: true,
                      })}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-semibold text-white bg-primary rounded-full mt-1">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
