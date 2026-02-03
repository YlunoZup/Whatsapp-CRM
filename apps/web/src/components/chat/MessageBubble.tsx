import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Forward, Copy, MoreVertical } from 'lucide-react';
import type { Message } from '@whatsapp-crm/shared';
import { MessageStatus } from './MessageStatus';
import { MessageReactions, QuickReactionBar } from './MessageReactions';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  showReactions?: boolean;
  searchQuery?: string;
  id?: string;
  onForward?: (message: Message) => void;
}

// Helper to highlight search matches in text
function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) {
    return <>{text}</>;
  }

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="bg-yellow-400/50 dark:bg-yellow-500/40 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

export function MessageBubble({ message, showReactions = true, searchQuery, id, onForward }: MessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isOutgoing = message.direction === 'outbound';

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
    setShowMenu(false);
  };

  const handleForward = () => {
    onForward?.(message);
    setShowMenu(false);
  };

  const renderContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <div className="max-w-xs">
            <img
              src={message.mediaUrl || ''}
              alt="Image"
              className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => {
                if (message.mediaUrl) {
                  window.open(message.mediaUrl, '_blank', 'noopener,noreferrer');
                }
              }}
            />
            {message.content && (
              <p className="mt-2 text-sm">
                <HighlightedText text={message.content} query={searchQuery} />
              </p>
            )}
          </div>
        );
      case 'video':
        return (
          <div className="max-w-xs">
            <video
              src={message.mediaUrl || ''}
              controls
              className="rounded-lg max-w-full"
            />
            {message.content && (
              <p className="mt-2 text-sm">
                <HighlightedText text={message.content} query={searchQuery} />
              </p>
            )}
          </div>
        );
      case 'audio':
        return (
          <div className="max-w-xs">
            <audio src={message.mediaUrl || ''} controls className="w-full" />
          </div>
        );
      case 'document':
        return (
          <a
            href={message.mediaUrl || ''}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 p-2.5 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
          >
            <svg className="w-8 h-8 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {message.content || 'Document'}
              </p>
              <p className="text-xs text-muted-foreground">Click to download</p>
            </div>
          </a>
        );
      default:
        return (
          <p className="whitespace-pre-wrap break-words text-foreground">
            <HighlightedText text={message.content || ''} query={searchQuery} />
          </p>
        );
    }
  };

  return (
    <div
      id={id}
      className={cn(
        'flex mb-1.5 px-4 group',
        isOutgoing ? 'justify-end' : 'justify-start'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
    >
      <div className="relative max-w-[70%] sm:max-w-[65%]">
        {/* Quick actions on hover - positioned above the message */}
        {isHovered && (
          <div
            className={cn(
              'absolute -top-8 z-10 flex items-center gap-1 animate-fade-up',
              isOutgoing ? 'right-0' : 'left-0'
            )}
          >
            {showReactions && (
              <QuickReactionBar messageId={message.id} onClose={() => setIsHovered(false)} />
            )}
            <div className="flex items-center gap-0.5 bg-card/95 backdrop-blur-sm rounded-lg shadow-premium border border-border/50 p-0.5">
              <button
                onClick={handleCopy}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                title="Copy"
                aria-label="Copy message"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {onForward && (
                <button
                  onClick={handleForward}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  title="Forward"
                  aria-label="Forward message"
                >
                  <Forward className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'relative rounded-2xl px-3.5 py-2.5 shadow-sm transition-shadow',
            isOutgoing
              ? 'bg-primary/90 text-primary-foreground rounded-br-md'
              : 'bg-card border border-border/30 text-foreground rounded-bl-md'
          )}
        >
          {renderContent()}

          {/* Reactions */}
          {showReactions && (
            <MessageReactions messageId={message.id} compact />
          )}

          {/* Time and status */}
          <div className="flex items-center justify-end gap-1 mt-1.5">
            <span className={cn(
              'text-[11px]',
              isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {message.createdAt && format(new Date(message.createdAt), 'HH:mm')}
            </span>
            {isOutgoing && (
              <MessageStatus status={message.status || 'pending'} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
