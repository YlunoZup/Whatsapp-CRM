import { useState, useMemo } from 'react';
import { Search, X, Send, Check, Forward, Loader2 } from 'lucide-react';
import { useConversations } from '@/hooks/use-conversations';
import { useContacts } from '@/hooks/use-contacts';
import { cn } from '@/lib/utils';
import type { Message, Conversation, Contact } from '@whatsapp-crm/shared';

interface ForwardMessageModalProps {
  message: Message;
  isOpen: boolean;
  onClose: () => void;
  onForward: (targetIds: string[], targetType: 'conversation' | 'contact') => void;
}

export function ForwardMessageModal({
  message,
  isOpen,
  onClose,
  onForward,
}: ForwardMessageModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tab, setTab] = useState<'conversations' | 'contacts'>('conversations');
  const [isForwarding, setIsForwarding] = useState(false);

  const { data: conversationsData } = useConversations({ limit: 50 });
  const { data: contactsData } = useContacts({ limit: 50 });

  const conversations = conversationsData?.data || [];
  const contacts = contactsData?.data || [];

  const filteredConversations = useMemo(() => {
    if (!search) return conversations;
    const searchLower = search.toLowerCase();
    return conversations.filter(
      (c) =>
        c.contact?.name?.toLowerCase().includes(searchLower) ||
        c.contact?.phone?.includes(search)
    );
  }, [conversations, search]);

  const filteredContacts = useMemo(() => {
    if (!search) return contacts;
    const searchLower = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(searchLower) ||
        c.phone?.includes(search)
    );
  }, [contacts, search]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (selectedIds.length === 0) return;
    setIsForwarding(true);
    try {
      onForward(selectedIds, tab === 'conversations' ? 'conversation' : 'contact');
      setSelectedIds([]);
      onClose();
    } finally {
      setIsForwarding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={isForwarding ? undefined : onClose} />
      <div className="relative bg-card rounded-2xl shadow-premium-lg border border-border/50 w-full max-w-md max-h-[80vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Forward className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Forward Message</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message preview */}
        <div className="px-6 py-4 bg-secondary/30 border-b border-border/50">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Message to forward</p>
          <div className="bg-card rounded-xl p-3 text-sm border border-border/50">
            {message.type === 'image' ? (
              <span className="text-muted-foreground italic">[Image]</span>
            ) : message.type === 'video' ? (
              <span className="text-muted-foreground italic">[Video]</span>
            ) : message.type === 'audio' ? (
              <span className="text-muted-foreground italic">[Audio]</span>
            ) : message.type === 'document' ? (
              <span className="text-muted-foreground italic">[Document]</span>
            ) : (
              <span className="line-clamp-2 text-foreground">{message.content}</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50 px-2 bg-secondary/20">
          <button
            onClick={() => {
              setTab('conversations');
              setSelectedIds([]);
            }}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-all',
              tab === 'conversations'
                ? 'text-primary border-b-2 border-primary -mb-[1px]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Conversations
          </button>
          <button
            onClick={() => {
              setTab('contacts');
              setSelectedIds([]);
            }}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-all',
              tab === 'contacts'
                ? 'text-primary border-b-2 border-primary -mb-[1px]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Contacts
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts or conversations..."
              className={cn(
                'w-full pl-10 pr-4 py-2.5 text-sm rounded-xl transition-all',
                'bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
              )}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'conversations' ? (
            filteredConversations.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground">No conversations found</p>
            ) : (
              filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={selectedIds.includes(conversation.id)}
                  onToggle={() => toggleSelection(conversation.id)}
                />
              ))
            )
          ) : filteredContacts.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">No contacts found</p>
          ) : (
            filteredContacts.map((contact) => (
              <ContactItem
                key={contact.id}
                contact={contact}
                isSelected={selectedIds.includes(contact.id)}
                onToggle={() => toggleSelection(contact.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-secondary/30 rounded-b-2xl flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} selected
          </span>
          <button
            onClick={handleForward}
            disabled={selectedIds.length === 0 || isForwarding}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all',
              'bg-primary text-primary-foreground shadow-sm',
              'hover:bg-primary/90 hover:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isForwarding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Forward
          </button>
        </div>
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onToggle,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${
        isSelected ? 'bg-primary/10' : ''
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
        }`}
      >
        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
        {conversation.contact?.name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 text-left">
        <p className="font-medium">{conversation.contact?.name || 'Unknown'}</p>
        <p className="text-sm text-muted-foreground">{conversation.contact?.phone}</p>
      </div>
    </button>
  );
}

function ContactItem({
  contact,
  isSelected,
  onToggle,
}: {
  contact: Contact;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${
        isSelected ? 'bg-primary/10' : ''
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
        }`}
      >
        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
        {contact.name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 text-left">
        <p className="font-medium">{contact.name || 'Unknown'}</p>
        <p className="text-sm text-muted-foreground">{contact.phone}</p>
      </div>
    </button>
  );
}
