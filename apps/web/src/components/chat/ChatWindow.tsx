import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ContactInfoPanel } from './ContactInfoPanel';
import { TypingIndicator } from './TypingIndicator';
import { ForwardMessageModal } from './ForwardMessageModal';
import { SessionConflictDialog } from './SessionConflictDialog';
import { useConversationMessages, useSendMessage, isSessionConflictError, SessionConflict } from '../../hooks/use-conversations';
import { useConversationSocket } from '../../hooks/use-socket';
import { cn } from '@/lib/utils';
import { MessageSquare, AlertCircle, X } from 'lucide-react';
import type { Conversation, Contact, Message } from '@whatsapp-crm/shared';

function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground bg-card/80 backdrop-blur-sm rounded-full shadow-sm border border-border/30">
        {date}
      </div>
    </div>
  );
}

interface ChatWindowProps {
  conversation: Conversation;
  onClose?: () => void;
}

export function ChatWindow({ conversation, onClose }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);

  const [sessionConflict, setSessionConflict] = useState<SessionConflict | null>(null);
  const [pendingMessage, setPendingMessage] = useState<{ content: string; type: string; mediaUrl?: string } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const { data: messagesData, isLoading } = useConversationMessages(conversation.id);
  const sendMessage = useSendMessage();
  const { sendTyping } = useConversationSocket(conversation.id);

  const messages = messagesData?.data || [];

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return messages.filter(
      (msg) => msg.content?.toLowerCase().includes(query)
    );
  }, [messages, searchQuery]);

  const scrollToSearchResult = useCallback((index: number) => {
    if (searchResults.length === 0) return;
    const message = searchResults[index];
    if (!message) return;

    const messageElement = document.getElementById(`message-${message.id}`);
    if (messageElement && messagesContainerRef.current) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 2000);
    }
  }, [searchResults]);

  const handleSearchNext = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    scrollToSearchResult(nextIndex);
  }, [currentSearchIndex, searchResults.length, scrollToSearchResult]);

  const handleSearchPrev = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    scrollToSearchResult(prevIndex);
  }, [currentSearchIndex, searchResults.length, scrollToSearchResult]);

  const handleSearchToggle = useCallback(() => {
    setIsSearchOpen((prev) => {
      if (prev) {
        setSearchQuery('');
        setCurrentSearchIndex(0);
      }
      return !prev;
    });
  }, []);

  useEffect(() => {
    setCurrentSearchIndex(0);
    if (searchResults.length > 0) {
      scrollToSearchResult(0);
    }
  }, [searchQuery, searchResults.length, scrollToSearchResult]);

  const messagesWithDates = useMemo(() => {
    const result: Array<{ type: 'date'; date: string } | { type: 'message'; message: Message }> = [];
    let lastDate = '';

    for (const message of messages) {
      const messageDate = new Date(message.createdAt).toDateString();
      if (messageDate !== lastDate) {
        result.push({ type: 'date', date: formatDateSeparator(new Date(message.createdAt)) });
        lastDate = messageDate;
      }
      result.push({ type: 'message', message });
    }

    return result;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = (content: string, type = 'text', mediaUrl?: string, forceOverride = false) => {
    // Clear previous error when attempting to send
    setSendError(null);

    sendMessage.mutate(
      {
        conversationId: conversation.id,
        content,
        type: type as any,
        mediaUrl,
        forceSessionOverride: forceOverride,
      },
      {
        onError: (error) => {
          if (isSessionConflictError(error)) {
            setPendingMessage({ content, type, mediaUrl });
            setSessionConflict(error.response.data.conflict);
          } else {
            console.error('Failed to send message:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
            setSendError(errorMessage);
          }
        },
        onSuccess: () => {
          setSendError(null);
        },
      }
    );
  };

  const handleSessionConflictConfirm = () => {
    if (pendingMessage) {
      handleSend(pendingMessage.content, pendingMessage.type, pendingMessage.mediaUrl, true);
      setPendingMessage(null);
      setSessionConflict(null);
    }
  };

  const handleSessionConflictCancel = () => {
    setPendingMessage(null);
    setSessionConflict(null);
  };

  const handleForward = (targetIds: string[], targetType: 'conversation' | 'contact') => {
    if (!forwardMessage) return;

    targetIds.forEach((targetId) => {
      sendMessage.mutate({
        conversationId: targetId,
        content: forwardMessage.content || '',
        type: forwardMessage.type as any,
        mediaUrl: forwardMessage.mediaUrl,
      });
    });

    setForwardMessage(null);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        {/* Header */}
        <div className="flex-shrink-0">
          <ChatHeader
          conversation={conversation}
          onInfoClick={() => setShowContactInfo(!showContactInfo)}
          onClose={onClose}
          isSearchOpen={isSearchOpen}
          onSearchToggle={handleSearchToggle}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchResultsCount={searchResults.length}
          currentSearchIndex={currentSearchIndex}
          onSearchPrev={handleSearchPrev}
          onSearchNext={handleSearchNext}
        />
        </div>

        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          className={cn(
            'flex-1 min-h-0 overflow-y-auto py-4',
            'bg-secondary/30 dark:bg-background'
          )}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="w-10 h-10 text-primary/50" />
                </div>
                <p className="font-medium text-foreground">No messages yet</p>
                <p className="text-sm mt-1">Start the conversation!</p>
              </div>
            </div>
          ) : (
            <>
              {messagesWithDates.map((item, index) =>
                item.type === 'date' ? (
                  <DateSeparator key={`date-${index}`} date={item.date} />
                ) : (
                  <MessageBubble
                    key={item.message.id}
                    message={item.message}
                    searchQuery={searchQuery}
                    id={`message-${item.message.id}`}
                    onForward={setForwardMessage}
                  />
                )
              )}
              <TypingIndicator conversationId={conversation.id} className="px-4 py-2" />
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Send error message */}
        {sendError && (
          <div className="flex-shrink-0 mx-4 mb-2">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-500 flex-1">{sendError}</p>
              <button
                onClick={() => setSendError(null)}
                className="p-1 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Message input */}
        <div className="flex-shrink-0">
          <MessageInput
            onSend={handleSend}
            onTyping={sendTyping}
            disabled={sendMessage.isPending}
          />
        </div>
      </div>

      {/* Contact info panel */}
      {showContactInfo && conversation.contact && (
        <ContactInfoPanel
          contact={conversation.contact as Contact}
          onClose={() => setShowContactInfo(false)}
        />
      )}

      {/* Forward message modal */}
      {forwardMessage && (
        <ForwardMessageModal
          message={forwardMessage}
          isOpen={!!forwardMessage}
          onClose={() => setForwardMessage(null)}
          onForward={handleForward}
        />
      )}

      {/* Session conflict dialog */}
      {sessionConflict && (
        <SessionConflictDialog
          isOpen={!!sessionConflict}
          onClose={handleSessionConflictCancel}
          onConfirm={handleSessionConflictConfirm}
          conflict={sessionConflict}
          isLoading={sendMessage.isPending}
        />
      )}
    </div>
  );
}
