import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConversationList, ChatWindow } from '../components/chat';
import { useChatStore } from '../stores/chat-store';
import { useSocket } from '../hooks/use-socket';
import { useConversation } from '../hooks/use-conversations';
import { cn } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';
import type { Conversation } from '@whatsapp-crm/shared';

export function ConversationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationIdFromUrl = searchParams.get('id');

  const selectedConversation = useChatStore((state) => state.selectedConversation);
  const setSelectedConversation = useChatStore((state) => state.setSelectedConversation);
  const [isMobileView, setIsMobileView] = useState(false);

  const { data: conversationFromUrl } = useConversation(conversationIdFromUrl || '');

  useSocket();

  useEffect(() => {
    if (conversationFromUrl && conversationIdFromUrl) {
      setSelectedConversation(conversationFromUrl);
      setSearchParams({}, { replace: true });
    }
  }, [conversationFromUrl, conversationIdFromUrl, setSelectedConversation, setSearchParams]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleCloseChat = () => {
    setSelectedConversation(null);
  };

  // Mobile: show either list or chat
  if (isMobileView) {
    return (
      <div className="h-full flex flex-col bg-background">
        {selectedConversation ? (
          <ChatWindow conversation={selectedConversation} onClose={handleCloseChat} />
        ) : (
          <ConversationList onSelectConversation={handleSelectConversation} />
        )}
      </div>
    );
  }

  // Desktop: show both side by side
  return (
    <div className="h-full flex bg-background overflow-hidden">
      {/* Conversation list - fixed width sidebar */}
      <div className="w-80 xl:w-96 flex-shrink-0 border-r border-border/50 flex flex-col bg-card">
        <ConversationList onSelectConversation={handleSelectConversation} />
      </div>

      {/* Chat area - fills remaining space */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <ChatWindow conversation={selectedConversation} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-background relative overflow-hidden">
            {/* Background decorative element */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
            </div>

            <div className="relative text-center max-w-md px-6">
              {/* Icon */}
              <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-primary/60" />
              </div>

              {/* Text */}
              <h2 className="text-xl font-semibold text-foreground tracking-tight mb-2">
                WhatsApp CRM
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Select a conversation from the list to start chatting. Your messages are synced across all your connected devices.
              </p>

              {/* Decorative dots */}
              <div className="flex items-center justify-center gap-1.5 mt-6">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/20 animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
