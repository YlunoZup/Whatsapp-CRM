import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, Users, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';
import { useDebounce } from '@/hooks/use-debounce';

interface SearchResult {
  conversations: Array<{
    id: string;
    contact: { id: string; name: string; phone: string };
    lastMessage?: { content: string; createdAt: string };
  }>;
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string;
  }>;
  messages: Array<{
    id: string;
    content: string;
    conversationId: string;
    contactName: string;
    createdAt: string;
  }>;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const { data: results, isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return null;
      const { data } = await api.get<SearchResult>('/search', { q: debouncedQuery });
      return data;
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  const handleSelect = useCallback(
    (type: 'conversation' | 'contact' | 'message', id: string, conversationId?: string) => {
      handleClose();
      if (type === 'conversation') {
        navigate(`/conversations/${id}`);
      } else if (type === 'contact') {
        navigate(`/contacts?highlight=${id}`);
      } else if (type === 'message' && conversationId) {
        navigate(`/conversations/${conversationId}?message=${id}`);
      }
    },
    [navigate, handleClose]
  );

  const hasResults =
    results &&
    (results.conversations.length > 0 ||
      results.contacts.length > 0 ||
      results.messages.length > 0);

  const noResults = debouncedQuery.length >= 2 && !isLoading && !hasResults;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors ${isOpen ? 'relative z-[75]' : ''}`}
        aria-label="Open search"
      >
        <Search className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={handleClose}
          />

          {/* Dropdown */}
          <div
            ref={dropdownRef}
            className="fixed right-4 top-16 w-96 bg-card rounded-xl shadow-2xl border border-border/50 z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {/* Search input */}
            <div className="flex items-center gap-2 p-3 border-b border-border/50">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 text-sm bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground"
              />
              {isLoading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />}
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {query.length < 2 && (
                <div className="p-6 text-center text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-xs">Type to search conversations, contacts & messages</p>
                </div>
              )}

              {noResults && (
                <div className="p-6 text-center text-muted-foreground">
                  <p className="text-xs">No results found for "{debouncedQuery}"</p>
                </div>
              )}

              {hasResults && (
                <div>
                  {/* Conversations */}
                  {results.conversations.length > 0 && (
                    <div className="p-1.5">
                      <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Conversations
                      </p>
                      {results.conversations.slice(0, 3).map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => handleSelect('conversation', conv.id)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                        >
                          <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{conv.contact.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.lastMessage?.content || conv.contact.phone}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Contacts */}
                  {results.contacts.length > 0 && (
                    <div className="p-1.5 border-t border-border/50">
                      <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Contacts
                      </p>
                      {results.contacts.slice(0, 3).map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => handleSelect('contact', contact.id)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                        >
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{contact.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Messages */}
                  {results.messages.length > 0 && (
                    <div className="p-1.5 border-t border-border/50">
                      <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Messages
                      </p>
                      {results.messages.slice(0, 3).map((message) => (
                        <button
                          key={message.id}
                          onClick={() => handleSelect('message', message.id, message.conversationId)}
                          className="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                        >
                          <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center mt-0.5">
                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm truncate">{message.contactName}</p>
                              <p className="text-[10px] text-muted-foreground flex-shrink-0">
                                {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{message.content}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-border/50 bg-muted/30">
              <p className="text-[10px] text-muted-foreground text-center">
                Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">ESC</kbd> to close
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
