import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, CheckCircle, RotateCcw, X, Search, ChevronUp, ChevronDown, Circle, Phone, ThumbsUp, ThumbsDown, Trophy, XCircle, ChevronDownIcon } from 'lucide-react';
import type { Conversation, Contact } from '@whatsapp-crm/shared';
import { AssignmentDropdown } from './AssignmentDropdown';
import { SessionDropdown } from './SessionDropdown';
import { useCloseConversation, useReopenConversation } from '../../hooks/use-conversations';
import { useUpdateContactStatus } from '../../hooks/use-contacts';
import { cn } from '@/lib/utils';

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

interface ChatHeaderProps {
  conversation: Conversation;
  onInfoClick: () => void;
  onClose?: () => void;
  isSearchOpen?: boolean;
  onSearchToggle?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchResultsCount?: number;
  currentSearchIndex?: number;
  onSearchPrev?: () => void;
  onSearchNext?: () => void;
}

// Muted, monochromatic avatar colors - subtle neutral tones
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
  const hash = (id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

export function ChatHeader({
  conversation,
  onInfoClick,
  onClose,
  isSearchOpen,
  onSearchToggle,
  searchQuery = '',
  onSearchChange,
  searchResultsCount = 0,
  currentSearchIndex = 0,
  onSearchPrev,
  onSearchNext,
}: ChatHeaderProps) {
  const contact = conversation.contact as Contact | undefined;
  const [showMenu, setShowMenu] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const updateStatus = useUpdateContactStatus();

  // Get current lead status
  const currentStatus = ((contact as any)?.status || 'new') as LeadStatus;
  const statusConfig = LEAD_STATUSES[currentStatus] || LEAD_STATUSES.new;
  const StatusIcon = statusConfig.icon;

  // Focus search input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeConversation = useCloseConversation();
  const reopenConversation = useReopenConversation();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusText = () => {
    // Check contact's online status first
    const contactData = contact as any;
    if (contactData?.isOnline) {
      return 'Online';
    }
    if (contactData?.lastSeenAt) {
      const lastSeen = new Date(contactData.lastSeenAt);
      const now = new Date();
      const diffMs = now.getTime() - lastSeen.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Last seen just now';
      if (diffMins < 60) return `Last seen ${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `Last seen ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays === 1) return 'Last seen yesterday';
      return `Last seen ${diffDays} days ago`;
    }
    // Fall back to session status
    if (conversation.session?.name) {
      return conversation.session.name;
    }
    return 'Offline';
  };

  const avatarColor = getAvatarColor(contact?.id || conversation.id);

  return (
    <div className="flex flex-col">
      {/* Header with glass effect */}
      <div className="flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center space-x-3">
          {/* Back button (mobile) */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors md:hidden"
              aria-label="Go back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* Gradient Avatar */}
          <button onClick={onInfoClick} className="flex-shrink-0 group" aria-label="View contact info">
            <div className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center',
              'text-white font-medium text-lg',
              'transition-transform duration-200 group-hover:scale-105',
              avatarColor
            )}>
              {contact?.name?.[0]?.toUpperCase() || contact?.phone?.[0] || '?'}
            </div>
          </button>

          {/* Contact info */}
          <button onClick={onInfoClick} className="text-left hover:opacity-80 transition-opacity">
            <h3 className="font-semibold text-[15px] text-foreground leading-tight">
              {contact?.name || contact?.phone || 'Unknown'}
            </h3>
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              {contact?.phone && contact?.name && (
                <span className="font-mono">{contact.phone}</span>
              )}
              {contact?.phone && contact?.name && <span className="text-border">•</span>}
              <span>{getStatusText()}</span>
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Lead Status Dropdown */}
          {contact && (
            <div className="relative" ref={statusDropdownRef}>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={updateStatus.isPending}
                className={cn(
                  'inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] leading-none font-medium rounded-full transition-all',
                  updateStatus.isPending && 'opacity-50 cursor-not-allowed'
                )}
                style={{
                  backgroundColor: `${statusConfig.color}15`,
                  color: statusConfig.color,
                }}
                title="Change lead status"
              >
                <StatusIcon className="w-3 h-3 flex-shrink-0" />
                <span className="hidden sm:inline">{statusConfig.label}</span>
                <ChevronDownIcon className="w-3 h-3 flex-shrink-0" />
              </button>

              {showStatusDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-card/95 backdrop-blur-xl rounded-xl shadow-premium border border-border/50 z-50 py-2 animate-fade-up">
                  <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">Lead Status</p>
                  {Object.entries(LEAD_STATUSES).map(([key, config]) => {
                    const Icon = config.icon;
                    const isActive = key === currentStatus;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          if (contact?.id) {
                            updateStatus.mutate({ id: contact.id, status: key });
                          }
                          setShowStatusDropdown(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-sm transition-all',
                          isActive ? 'bg-accent' : 'hover:bg-accent/50'
                        )}
                      >
                        <Icon className="w-4 h-4" style={{ color: config.color }} />
                        <span className={isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Conversation status badge - visible on all screen sizes */}
          <span
            className={cn(
              'inline-flex items-center justify-center px-2 py-1 text-[10px] leading-none font-medium rounded-full',
              conversation.status === 'open'
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {conversation.status === 'open' ? 'Open' : 'Closed'}
          </span>

          {/* Session dropdown - visible on larger screens */}
          {contact && (
            <div className="hidden sm:block">
              <SessionDropdown
                contactId={contact.id}
                currentSession={contact.assignedSession || null}
              />
            </div>
          )}

          {/* Assignment dropdown - visible on larger screens */}
          <div className="hidden md:block">
            <AssignmentDropdown
              conversationId={conversation.id}
              currentAssignee={conversation.assignedUser as { id: string; name: string; avatarUrl?: string } | null}
            />
          </div>

          {/* Search in chat - hidden on mobile, accessed via menu */}
          <button
            onClick={onSearchToggle}
            className={cn(
              'hidden sm:flex w-9 h-9 items-center justify-center rounded-xl transition-all duration-200',
              isSearchOpen
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            aria-label="Search in chat"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* More options menu - contains mobile-specific options */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all duration-200"
              aria-label="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-card/95 backdrop-blur-xl rounded-xl shadow-premium border border-border/50 z-50 py-2 animate-fade-up">
                {/* Mobile-only: Session selection */}
                {contact && (
                  <div className="sm:hidden px-3 pb-2 mb-2 border-b border-border/50">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Session</p>
                    <SessionDropdown
                      contactId={contact.id}
                      currentSession={contact.assignedSession || null}
                      variant="compact"
                    />
                  </div>
                )}

                {/* Mobile-only: Assignment */}
                <div className="md:hidden px-3 pb-2 mb-2 border-b border-border/50">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Assigned to</p>
                  <AssignmentDropdown
                    conversationId={conversation.id}
                    currentAssignee={conversation.assignedUser as { id: string; name: string; avatarUrl?: string } | null}
                    variant="compact"
                  />
                </div>

                {/* Mobile-only: Search */}
                <button
                  onClick={() => {
                    onSearchToggle?.();
                    setShowMenu(false);
                  }}
                  className="sm:hidden w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <Search className="w-4 h-4 text-muted-foreground" />
                  Search in chat
                </button>

                {/* Close/Reopen conversation */}
                {conversation.status === 'open' ? (
                  <button
                    onClick={() => {
                      closeConversation.mutate(conversation.id);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 text-primary" />
                    Close conversation
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      reopenConversation.mutate(conversation.id);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-primary" />
                    Reopen conversation
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search bar */}
      {isSearchOpen && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-card/60 backdrop-blur-sm border-b border-border/50">
          <div className="flex-1 flex items-center gap-2 bg-secondary/50 border border-border rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    onSearchPrev?.();
                  } else {
                    onSearchNext?.();
                  }
                } else if (e.key === 'Escape') {
                  onSearchToggle?.();
                }
              }}
            />
          </div>
          {searchQuery && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {searchResultsCount > 0
                ? `${currentSearchIndex + 1} of ${searchResultsCount}`
                : 'No results'}
            </span>
          )}
          <div className="flex items-center gap-0.5">
            <button
              onClick={onSearchPrev}
              disabled={searchResultsCount === 0}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous result"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={onSearchNext}
              disabled={searchResultsCount === 0}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next result"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={onSearchToggle}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
