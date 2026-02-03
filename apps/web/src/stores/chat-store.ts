import { create } from 'zustand';
import type { Message, Conversation, Contact } from '@whatsapp-crm/shared';

interface ChatState {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: Record<string, Message[]>;
  isLoadingMessages: boolean;

  // Conversation actions
  setConversations: (conversations: Conversation[]) => void;
  setSelectedConversation: (conversation: Conversation | null) => void;
  updateConversation: (conversation: Conversation) => void;
  addConversation: (conversation: Conversation) => void;

  // Contact actions (for real-time updates)
  updateContactInConversations: (contactId: string, updates: Partial<Contact>) => void;

  // Message actions
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  setLoadingMessages: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  selectedConversation: null,
  messages: {},
  isLoadingMessages: false,

  // Conversation actions
  setConversations: (conversations) => set({ conversations }),

  setSelectedConversation: (conversation) => set({ selectedConversation: conversation }),

  updateConversation: (conversation) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversation.id ? { ...conv, ...conversation } : conv
      ),
      selectedConversation:
        state.selectedConversation?.id === conversation.id
          ? { ...state.selectedConversation, ...conversation }
          : state.selectedConversation,
    })),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),

  // Update contact data in all conversations (for real-time status updates)
  updateContactInConversations: (contactId, updates) =>
    set((state) => {
      const updateContact = (conv: Conversation): Conversation => {
        if (conv.contact?.id === contactId) {
          return {
            ...conv,
            contact: { ...conv.contact, ...updates } as any,
          };
        }
        return conv;
      };

      return {
        conversations: state.conversations.map(updateContact),
        selectedConversation: state.selectedConversation
          ? updateContact(state.selectedConversation)
          : null,
      };
    }),

  // Message actions
  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
    })),

  addMessage: (message) =>
    set((state) => {
      const conversationMessages = state.messages[message.conversationId] || [];

      // Check if message already exists
      if (conversationMessages.some((m) => m.id === message.id)) {
        return state;
      }

      return {
        messages: {
          ...state.messages,
          [message.conversationId]: [...conversationMessages, message],
        },
      };
    }),

  updateMessage: (conversationId, messageId, updates) =>
    set((state) => {
      const conversationMessages = state.messages[conversationId] || [];

      return {
        messages: {
          ...state.messages,
          [conversationId]: conversationMessages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        },
      };
    }),

  setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
}));
