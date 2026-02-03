// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  avatarUrl?: string;
  tenantId: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Tenant Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  settings: TenantSettings;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  [key: string]: unknown;
}

// WhatsApp Session Types
export interface WhatsappSession {
  id: string;
  tenantId: string;
  name: string;
  phoneNumber?: string;
  status: SessionStatus;
  qrCode?: string;
  webhookUrl?: string;
  settings: SessionSettings;
  lastConnectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Contact count (from _count in API response)
  _count?: {
    assignedContacts: number;
  };
}

export type SessionStatus = 'connected' | 'disconnected' | 'qr_pending' | 'connecting';

export interface SessionSettings {
  autoReply?: boolean;
  welcomeMessage?: string;
  [key: string]: unknown;
}

// Contact Types
export interface Contact {
  id: string;
  tenantId: string;
  whatsappId?: string;
  phone: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  tags?: Tag[];
  assignedSessionId?: string;
  assignedSession?: {
    id: string;
    name: string;
    phoneNumber?: string | null;
  };
  // Presence tracking
  isOnline?: boolean;
  lastSeenAt?: Date;
  lastPresence?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Tag Types
export interface Tag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: Date;
}

// Conversation Types
export interface Conversation {
  id: string;
  tenantId: string;
  sessionId: string;
  contactId: string;
  status: ConversationStatus;
  assignedTo?: string;
  lastMessageAt?: Date;
  unreadCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  contact?: Contact;
  session?: WhatsappSession;
  assignedUser?: User;
  messages?: Message[];
}

export type ConversationStatus = 'open' | 'closed' | 'pending';

// Message Types
export interface Message {
  id: string;
  conversationId: string;
  whatsappMessageId?: string;
  direction: MessageDirection;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  status: MessageStatus;
  metadata: Record<string, unknown>;
  sequenceNumber?: bigint;
  createdAt: Date;
}

export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

// Webhook Types
export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  isActive: boolean;
  lastTriggeredAt?: Date;
  createdAt: Date;
}

export type WebhookEvent =
  | 'message.received'
  | 'message.sent'
  | 'message.delivered'
  | 'message.read'
  | 'conversation.created'
  | 'conversation.closed'
  | 'contact.created'
  | 'contact.updated'
  | 'session.connected'
  | 'session.disconnected';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
  session?: {
    id: string;
    phone?: string;
  };
}

// API Key Types
export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

// Message Template Types
export interface MessageTemplate {
  id: string;
  tenantId: string;
  name: string;
  content: string;
  variables: string[];
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    cursor: string | null;
  };
}

// Auth Types
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

// Socket Event Types
export interface SocketEvents {
  // Server to Client
  new_message: {
    conversationId: string;
    message: Message;
  };
  message_status_update: {
    conversationId: string;
    messageId: string;
    status: MessageStatus;
  };
  typing_indicator: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  };
  session_status_change: {
    sessionId: string;
    status: SessionStatus;
    phoneNumber?: string;
  };
  conversation_update: {
    conversationId: string;
    unreadCount?: number;
    lastMessageAt?: Date;
    status?: ConversationStatus;
  };
  contact_update: {
    contact: Contact;
  };
  notification: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  };

  // Client to Server
  join_conversation: {
    conversationId: string;
  };
  leave_conversation: {
    conversationId: string;
  };
  typing: {
    conversationId: string;
    isTyping: boolean;
  };
  mark_read: {
    conversationId: string;
  };
}
