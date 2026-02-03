import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  ConnectionState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  delay,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs';
import * as QRCode from 'qrcode';
import pino from 'pino';
import { MessageBufferService } from './message-buffer.service';
import { LidMappingService } from './lid-mapping.service';
import { ContentHashService } from './content-hash.service';

export interface WhatsAppConnection {
  socket: WASocket | null;
  qrCode: string | null;
  status: 'disconnected' | 'connecting' | 'qr_pending' | 'connected';
  phoneNumber?: string;
}

export interface IncomingMessage {
  sessionId: string;
  remoteJid: string;
  remoteJidAlt?: string; // Alternate JID - if remoteJid is @lid, this is @s.whatsapp.net and vice versa
  messageId: string;
  fromMe: boolean;
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker';
  content?: string;
  mediaUrl?: string;
  pushName?: string;
  senderPn?: string; // Phone number if available (resolved from LID or remoteJidAlt)
}

// LID to Phone Number mapping
interface LidMapping {
  lid: string;
  pn: string; // Phone number in JID format (e.g., 1234567890@s.whatsapp.net)
}

export interface MessageStatusUpdate {
  sessionId: string;
  messageId: string;
  status: 'sent' | 'delivered' | 'read';
}

export interface IncomingReaction {
  sessionId: string;
  remoteJid: string;
  messageId: string; // The message being reacted to
  emoji: string; // The reaction emoji (empty string means reaction removed)
  fromMe: boolean; // Was the reaction from us or the contact?
  reactedMessageFromMe: boolean; // Was the message being reacted to from us?
  timestamp: number;
}

export interface PresenceUpdate {
  sessionId: string;
  remoteJid: string;
  presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';
  lastSeen?: number; // Unix timestamp of last seen
}

type ConnectionCallback = (sessionId: string, status: string, qrCode?: string, phoneNumber?: string) => void;
type MessageCallback = (message: IncomingMessage) => void;
type MessageStatusCallback = (update: MessageStatusUpdate) => void;
type ReactionCallback = (reaction: IncomingReaction) => void;
type PresenceCallback = (presence: PresenceUpdate) => void;

@Injectable()
export class WhatsAppService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private connections: Map<string, WhatsAppConnection> = new Map();
  private connectionCallbacks: ConnectionCallback[] = [];
  private messageCallbacks: MessageCallback[] = [];
  private messageStatusCallbacks: MessageStatusCallback[] = [];
  private reactionCallbacks: ReactionCallback[] = [];
  private presenceCallbacks: PresenceCallback[] = [];
  private readonly authDir: string;

  // LID to Phone Number mapping store (per session)
  private lidMappings: Map<string, Map<string, string>> = new Map(); // sessionId -> (lid -> phoneJid)

  // Rate limiting to prevent bulk messaging detection
  private messageTimestamps: Map<string, number[]> = new Map(); // sessionId -> timestamps
  private presenceTimestamps: Map<string, number> = new Map(); // sessionId -> last presence update time
  private reconnectAttempts: Map<string, number> = new Map(); // sessionId -> consecutive reconnect attempts
  private readonly MAX_MESSAGES_PER_MINUTE = 5; // Very conservative - real users send ~2-3/min
  private readonly MAX_MESSAGES_PER_HOUR = 60; // Reduced from 100 - safer for bulk operations
  private readonly MIN_DELAY_BETWEEN_MESSAGES = 5000; // 5 seconds minimum (was 3s - too fast)
  private readonly MAX_DELAY_JITTER = 3000; // Random 0-3s added to every delay
  private readonly MIN_PRESENCE_INTERVAL = 30000; // Only allow presence updates every 30s per session
  private readonly MAX_RECONNECT_ATTEMPTS = 10; // Max reconnect tries before giving up
  private readonly RECONNECT_BASE_DELAY = 5000; // 5 second base delay for reconnect

  constructor(
    private messageBuffer: MessageBufferService,
    private lidMapping: LidMappingService,
    private contentHash: ContentHashService,
  ) {
    this.authDir = path.join(process.cwd(), '.whatsapp-sessions');
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  /**
   * Add random jitter to delays to appear more human-like
   * This is CRITICAL for avoiding WhatsApp ban detection
   */
  private addJitter(baseDelay: number): number {
    const jitter = Math.floor(Math.random() * this.MAX_DELAY_JITTER);
    return baseDelay + jitter;
  }

  /**
   * Calculate exponential backoff delay for reconnection
   */
  private getReconnectDelay(sessionId: string): number {
    const attempts = this.reconnectAttempts.get(sessionId) || 0;
    // Exponential backoff: 5s, 10s, 20s, 40s, 80s... capped at 5 minutes
    const exponentialDelay = Math.min(
      this.RECONNECT_BASE_DELAY * Math.pow(2, attempts),
      5 * 60 * 1000, // Max 5 minutes
    );
    // Add jitter (0-30% of delay) to prevent synchronized reconnects
    const jitter = Math.floor(Math.random() * exponentialDelay * 0.3);
    return exponentialDelay + jitter;
  }

  /**
   * Check if presence update is allowed (rate limited to prevent spam)
   */
  private canSendPresenceUpdate(sessionId: string): boolean {
    const lastPresence = this.presenceTimestamps.get(sessionId) || 0;
    const now = Date.now();
    if (now - lastPresence < this.MIN_PRESENCE_INTERVAL) {
      return false;
    }
    this.presenceTimestamps.set(sessionId, now);
    return true;
  }

  /**
   * Check rate limits before sending a message
   * Returns delay in ms to wait (with jitter), or 0 if can send immediately
   */
  private checkRateLimit(sessionId: string): number {
    const now = Date.now();
    const timestamps = this.messageTimestamps.get(sessionId) || [];

    // Clean old timestamps (older than 1 hour)
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentTimestamps = timestamps.filter(t => t > oneHourAgo);

    // Check hourly limit
    if (recentTimestamps.length >= this.MAX_MESSAGES_PER_HOUR) {
      const oldestInHour = recentTimestamps[0];
      const baseDelay = oldestInHour + 60 * 60 * 1000 - now + 1000;
      return this.addJitter(baseDelay);
    }

    // Check per-minute limit
    const oneMinuteAgo = now - 60 * 1000;
    const lastMinuteTimestamps = recentTimestamps.filter(t => t > oneMinuteAgo);
    if (lastMinuteTimestamps.length >= this.MAX_MESSAGES_PER_MINUTE) {
      const oldestInMinute = lastMinuteTimestamps[0];
      const baseDelay = oldestInMinute + 60 * 1000 - now + 1000;
      return this.addJitter(baseDelay);
    }

    // Check minimum delay between messages (with jitter for human-like behavior)
    if (recentTimestamps.length > 0) {
      const lastMessage = recentTimestamps[recentTimestamps.length - 1];
      const timeSinceLast = now - lastMessage;
      if (timeSinceLast < this.MIN_DELAY_BETWEEN_MESSAGES) {
        const baseDelay = this.MIN_DELAY_BETWEEN_MESSAGES - timeSinceLast;
        return this.addJitter(baseDelay);
      }
    }

    // Even if no rate limit hit, add small random delay for human-like behavior
    return Math.floor(Math.random() * 1000); // 0-1 second random delay
  }

  /**
   * Record a message timestamp for rate limiting
   */
  private recordMessageSent(sessionId: string): void {
    const now = Date.now();
    const timestamps = this.messageTimestamps.get(sessionId) || [];
    timestamps.push(now);

    // Keep only last hour of timestamps
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentTimestamps = timestamps.filter(t => t > oneHourAgo);
    this.messageTimestamps.set(sessionId, recentTimestamps);
  }

  onModuleDestroy() {
    // Clean up all connections on shutdown
    for (const [sessionId, conn] of this.connections) {
      if (conn.socket) {
        conn.socket.end(undefined);
      }
    }
    this.connections.clear();
  }

  onConnectionChange(callback: ConnectionCallback) {
    this.connectionCallbacks.push(callback);
  }

  onMessage(callback: MessageCallback) {
    this.messageCallbacks.push(callback);
  }

  onMessageStatus(callback: MessageStatusCallback) {
    this.messageStatusCallbacks.push(callback);
  }

  onReaction(callback: ReactionCallback) {
    this.reactionCallbacks.push(callback);
  }

  onPresence(callback: PresenceCallback) {
    this.presenceCallbacks.push(callback);
  }

  private notifyConnectionChange(sessionId: string, status: string, qrCode?: string, phoneNumber?: string) {
    for (const callback of this.connectionCallbacks) {
      try {
        callback(sessionId, status, qrCode, phoneNumber);
      } catch (err) {
        this.logger.error(`Callback error: ${err}`);
      }
    }
  }

  private async notifyMessage(message: IncomingMessage) {
    for (const callback of this.messageCallbacks) {
      try {
        await callback(message);
      } catch (err) {
        this.logger.error(`Message callback error: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private async notifyMessageStatus(update: MessageStatusUpdate) {
    for (const callback of this.messageStatusCallbacks) {
      try {
        await callback(update);
      } catch (err) {
        this.logger.error(`Message status callback error: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private async notifyReaction(reaction: IncomingReaction) {
    for (const callback of this.reactionCallbacks) {
      try {
        await callback(reaction);
      } catch (err) {
        this.logger.error(`Reaction callback error: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private async notifyPresence(presence: PresenceUpdate) {
    for (const callback of this.presenceCallbacks) {
      try {
        await callback(presence);
      } catch (err) {
        this.logger.error(`Presence callback error: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  async connect(sessionId: string): Promise<{ qrCode?: string; status: string }> {
    this.logger.log(`Connecting session: ${sessionId}`);

    // If already connected, return current status
    const existing = this.connections.get(sessionId);
    if (existing?.status === 'connected') {
      return { status: 'connected' };
    }

    // Clean up existing connection if any
    if (existing?.socket) {
      existing.socket.end(undefined);
    }

    const sessionDir = path.join(this.authDir, sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const connection: WhatsAppConnection = {
      socket: null,
      qrCode: null,
      status: 'connecting',
    };
    this.connections.set(sessionId, connection);

    return new Promise(async (resolve, reject) => {
      const pinoLogger = pino({ level: 'silent' });

      // Fetch latest WhatsApp Web version to stay up-to-date and avoid detection
      let version: [number, number, number] | undefined;
      try {
        const { version: latestVersion } = await fetchLatestBaileysVersion();
        version = latestVersion;
        this.logger.log(`Using WhatsApp Web version: ${version.join('.')}`);
      } catch (err) {
        this.logger.warn('Could not fetch latest version, using default');
      }

      const socket = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pinoLogger),
        },
        version,
        printQRInTerminal: false,
        logger: pinoLogger,
        // Use exact WhatsApp Web browser signature to avoid detection
        browser: ['Windows', 'Chrome', '125.0.6422.112'],
        // Sync full history like WhatsApp Web does
        syncFullHistory: true,
        // Connection settings to mimic WhatsApp Web
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        // Mark as online like regular WhatsApp Web
        markOnlineOnConnect: true,
        // Generate high-quality link previews like WhatsApp Web
        generateHighQualityLinkPreview: true,
        // Receive notifications for messages like WhatsApp Web
        getMessage: async (key) => {
          // CRITICAL FIX: Return undefined when message not found
          // Returning { conversation: '' } caused blank messages to appear
          // during session initialization (WhatsApp sends ~6 retry/poll requests)
          // Returning undefined tells Baileys there's no cached message,
          // so it won't create fake empty messages
          return undefined;
        },
      });

      connection.socket = socket;

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection: connState, lastDisconnect, qr } = update;

        if (qr) {
          // Generate QR code as data URL
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, {
              width: 256,
              margin: 2,
              color: { dark: '#000000', light: '#FFFFFF' },
            });
            connection.qrCode = qrDataUrl;
            connection.status = 'qr_pending';
            this.notifyConnectionChange(sessionId, 'qr_pending', qrDataUrl);
            resolve({ qrCode: qrDataUrl, status: 'qr_pending' });
          } catch (err) {
            this.logger.error(`QR generation error: ${err}`);
          }
        }

        if (connState === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.log(`Connection closed for ${sessionId}, status: ${statusCode}, reconnect: ${shouldReconnect}`);

          connection.status = 'disconnected';
          connection.qrCode = null;
          this.notifyConnectionChange(sessionId, 'disconnected');

          if (shouldReconnect) {
            // Increment reconnect attempts
            const attempts = (this.reconnectAttempts.get(sessionId) || 0) + 1;
            this.reconnectAttempts.set(sessionId, attempts);

            if (attempts > this.MAX_RECONNECT_ATTEMPTS) {
              this.logger.error(`Max reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}) exceeded for session ${sessionId}. Giving up.`);
              this.reconnectAttempts.delete(sessionId);
              this.notifyConnectionChange(sessionId, 'disconnected');
            } else {
              // Auto-reconnect with exponential backoff + jitter
              const reconnectDelay = this.getReconnectDelay(sessionId);
              this.logger.log(`Reconnecting session ${sessionId} in ${reconnectDelay}ms (attempt ${attempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
              setTimeout(() => {
                this.connect(sessionId).catch(err => {
                  this.logger.error(`Reconnect failed for ${sessionId}: ${err.message}`);
                });
              }, reconnectDelay);
            }
          } else {
            // Logged out - clear auth state and reset reconnect counter
            this.reconnectAttempts.delete(sessionId);
            this.clearSession(sessionId);
          }
        } else if (connState === 'open') {
          // Reset reconnect attempts on successful connection
          this.reconnectAttempts.delete(sessionId);

          this.logger.log(`Connected: ${sessionId}`);
          const phoneNumber = socket.user?.id?.split(':')[0] || socket.user?.id;
          connection.status = 'connected';
          connection.phoneNumber = phoneNumber;
          connection.qrCode = null;
          this.notifyConnectionChange(sessionId, 'connected', undefined, phoneNumber);

          // Load LID mappings from database into cache for this session
          try {
            await this.lidMapping.loadSessionCache(sessionId);
            this.logger.log(`Loaded LID mappings for session ${sessionId}`);
          } catch (err) {
            this.logger.warn(`Could not load LID mappings: ${err}`);
          }

          // Set presence to "available" like WhatsApp Web does on connect
          try {
            await socket.sendPresenceUpdate('available');
            this.logger.log(`Set presence to available for ${sessionId}`);
          } catch (err) {
            this.logger.debug(`Could not set initial presence: ${err}`);
          }

          resolve({ status: 'connected' });
        }
      });

      // Handle incoming messages (both real-time and history sync)
      socket.ev.on('messages.upsert', async (m) => {
        const { messages, type } = m;

        // Process both 'notify' (real-time) and 'append' (history sync) messages
        // 'notify' = new real-time messages
        // 'append' = historical messages from sync (e.g., messages received while disconnected)
        const isHistorySync = type === 'append';

        if (type !== 'notify' && type !== 'append') {
          this.logger.debug(`Skipping messages.upsert with type: ${type}`);
          return;
        }

        if (isHistorySync) {
          this.logger.log(`Processing ${messages.length} historical messages (type: append) for session ${sessionId}`);
        }

        for (const msg of messages) {
          try {
            // Skip status broadcasts
            if (msg.key.remoteJid === 'status@broadcast') {
              continue;
            }

            // Skip protocol messages (no actual content)
            if (!msg.message) {
              continue;
            }

            const remoteJid = msg.key.remoteJid || '';
            // CRITICAL: remoteJidAlt provides the alternate identifier
            // If remoteJid is @lid, remoteJidAlt is @s.whatsapp.net (phone) and vice versa
            const remoteJidAlt = (msg.key as any).remoteJidAlt || '';
            const messageId = msg.key.id || '';
            const fromMe = msg.key.fromMe || false;
            const timestamp = msg.messageTimestamp as number || Math.floor(Date.now() / 1000);
            const pushName = msg.pushName || '';

            // Check if this is a reaction message
            if (msg.message?.reactionMessage) {
              const reaction = msg.message.reactionMessage;
              const reactedMsgKey = reaction.key;

              if (reactedMsgKey?.id) {
                this.logger.log(
                  `Incoming reaction - Session: ${sessionId}, From: ${remoteJid}, ` +
                  `Emoji: "${reaction.text || '[removed]'}", ` +
                  `ReactedTo: ${reactedMsgKey.id}, ReactedMsgFromMe: ${reactedMsgKey.fromMe}`,
                );

                await this.notifyReaction({
                  sessionId,
                  remoteJid,
                  messageId: reactedMsgKey.id,
                  emoji: reaction.text || '', // Empty string means reaction removed
                  fromMe,
                  reactedMessageFromMe: reactedMsgKey.fromMe || false,
                  timestamp,
                });
              }
              continue; // Don't process reactions as regular messages
            }

            // Determine message type and content
            let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' = 'text';
            let content = '';
            let mediaUrl: string | undefined;
            let hasValidContent = false;

            if (msg.message?.conversation) {
              messageType = 'text';
              content = msg.message.conversation;
              hasValidContent = content.trim().length > 0;
            } else if (msg.message?.extendedTextMessage?.text) {
              messageType = 'text';
              content = msg.message.extendedTextMessage.text;
              hasValidContent = content.trim().length > 0;
            } else if (msg.message?.imageMessage) {
              messageType = 'image';
              content = msg.message.imageMessage.caption || '';
              hasValidContent = true; // Images are valid even without caption
            } else if (msg.message?.videoMessage) {
              messageType = 'video';
              content = msg.message.videoMessage.caption || '';
              hasValidContent = true; // Videos are valid even without caption
            } else if (msg.message?.audioMessage) {
              messageType = 'audio';
              hasValidContent = true; // Audio messages are always valid
            } else if (msg.message?.documentMessage) {
              messageType = 'document';
              content = msg.message.documentMessage.fileName || 'Document';
              hasValidContent = true; // Documents are valid
            } else if (msg.message?.stickerMessage) {
              messageType = 'sticker';
              hasValidContent = true; // Stickers are valid
            }

            // CRITICAL FIX: Skip messages without valid content
            // This prevents blank/empty messages from being processed
            // (e.g., from poll retries, protocol messages, or corrupted sync data)
            if (!hasValidContent) {
              this.logger.debug(`Skipping message ${messageId} - no valid content (type: ${messageType}, isHistorySync: ${isHistorySync})`);
              continue;
            }

            // Resolve phone number from LID using multiple sources
            let senderPn: string | undefined;
            const isLidFormat = remoteJid.includes('@lid');

            if (isLidFormat) {
              // Priority 1: Use remoteJidAlt if available (most reliable - directly from WhatsApp)
              if (remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
                senderPn = remoteJidAlt;
                // Store this mapping for future use
                this.storeLidMapping(sessionId, remoteJid, remoteJidAlt);
                this.logger.log(`Got phone from remoteJidAlt: ${remoteJid} -> ${remoteJidAlt}`);
              } else {
                // Priority 2: Check our stored mapping
                senderPn = this.getPhoneFromLid(sessionId, remoteJid);
                if (senderPn) {
                  this.logger.log(`Resolved LID from stored mapping: ${remoteJid} -> ${senderPn}`);
                }
              }
            }

            this.logger.log(`${isHistorySync ? '[HISTORY]' : '[REALTIME]'} Message - Session: ${sessionId}, From: ${remoteJid}, Alt: ${remoteJidAlt || 'none'}, Type: ${messageType}, FromMe: ${fromMe}, SenderPn: ${senderPn || 'unknown'}`);

            await this.notifyMessage({
              sessionId,
              remoteJid,
              remoteJidAlt: remoteJidAlt || undefined,
              messageId,
              fromMe,
              timestamp,
              type: messageType,
              content,
              mediaUrl,
              pushName,
              senderPn,
            });
          } catch (err) {
            this.logger.error(`Error processing message: ${err}`);
          }
        }
      });

      // Handle message status updates (delivered, read receipts)
      socket.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
          try {
            const messageId = update.key.id;
            if (!messageId) continue;

            // Skip if not our outgoing message
            if (!update.key.fromMe) continue;

            let status: 'sent' | 'delivered' | 'read' | null = null;

            // Baileys status codes: 0=ERROR, 1=PENDING, 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ, 5=PLAYED
            const baileysStatus = update.update?.status;
            if (baileysStatus === 4 || baileysStatus === 5) {
              // 4 = READ, 5 = PLAYED (for voice messages)
              status = 'read';
            } else if (baileysStatus === 3) {
              // 3 = DELIVERY_ACK (delivered)
              status = 'delivered';
            } else if (baileysStatus === 2) {
              // 2 = SERVER_ACK (sent)
              status = 'sent';
            }

            if (status) {
              this.logger.log(`Message status update - ID: ${messageId}, Status: ${status}`);
              await this.notifyMessageStatus({
                sessionId,
                messageId,
                status,
              });
            }
          } catch (err) {
            this.logger.error(`Error processing message status update: ${err}`);
          }
        }
      });

      // Handle LID (Local ID) to Phone Number mapping updates
      // This is critical for matching incoming messages from @lid format to actual contacts

      // Direct LID mapping updates from Baileys
      socket.ev.on('lid-mapping.update' as any, async (mappings: any[]) => {
        try {
          for (const mapping of mappings) {
            if (mapping.lid && mapping.pn) {
              this.storeLidMapping(sessionId, mapping.lid, mapping.pn);
              this.logger.log(`LID mapping from event: ${mapping.lid} -> ${mapping.pn}`);
            }
          }
        } catch (err) {
          this.logger.error(`Error processing lid-mapping update: ${err}`);
        }
      });

      // Contacts upsert - captures both lid and phoneNumber fields
      socket.ev.on('contacts.upsert', async (contacts: any[]) => {
        try {
          for (const contact of contacts) {
            // Contact interface has: id, lid, phoneNumber
            const lid = contact.lid || (contact.id?.includes('@lid') ? contact.id : null);
            const pn = contact.phoneNumber || (contact.id?.includes('@s.whatsapp.net') ? contact.id : null);

            if (lid && pn) {
              this.storeLidMapping(sessionId, lid, pn);
              this.logger.log(`LID mapping from contacts.upsert: ${lid} -> ${pn}`);
            }
          }
        } catch (err) {
          this.logger.error(`Error processing contacts upsert: ${err}`);
        }
      });

      socket.ev.on('messaging-history.set' as any, async (data: any) => {
        try {
          // Extract LID mappings from contacts in history sync
          if (data?.contacts) {
            for (const contact of data.contacts) {
              if (contact.id && contact.lid) {
                this.storeLidMapping(sessionId, contact.lid, contact.id);
              }
              // Also check for phoneNumber field
              if (contact.lid && contact.phoneNumber) {
                this.storeLidMapping(sessionId, contact.lid, contact.phoneNumber);
              }
            }
          }

          // CRITICAL: Process historical messages from full history sync
          // This captures messages that were received while the session was disconnected
          if (data?.messages && Array.isArray(data.messages)) {
            this.logger.log(`Processing ${data.messages.length} messages from messaging-history.set for session ${sessionId}`);

            for (const msg of data.messages) {
              try {
                // Skip status broadcasts
                if (msg.key?.remoteJid === 'status@broadcast') {
                  continue;
                }

                // Skip if no message content
                if (!msg.message) {
                  continue;
                }

                const remoteJid = msg.key?.remoteJid || '';
                const remoteJidAlt = (msg.key as any)?.remoteJidAlt || '';
                const messageId = msg.key?.id || '';
                const fromMe = msg.key?.fromMe || false;
                const timestamp = msg.messageTimestamp as number || Math.floor(Date.now() / 1000);
                const pushName = msg.pushName || '';

                // Process reaction messages in history sync (previously skipped)
                if (msg.message?.reactionMessage) {
                  const reaction = msg.message.reactionMessage;
                  const reactedMsgKey = reaction.key;

                  if (reactedMsgKey?.id) {
                    this.logger.log(
                      `[HISTORY] Incoming reaction - Session: ${sessionId}, From: ${remoteJid}, ` +
                      `Emoji: "${reaction.text || '[removed]'}", ` +
                      `ReactedTo: ${reactedMsgKey.id}, ReactedMsgFromMe: ${reactedMsgKey.fromMe}`,
                    );

                    await this.notifyReaction({
                      sessionId,
                      remoteJid,
                      messageId: reactedMsgKey.id,
                      emoji: reaction.text || '',
                      fromMe,
                      reactedMessageFromMe: reactedMsgKey.fromMe || false,
                      timestamp,
                    });
                  }
                  continue; // Don't process reactions as regular messages
                }

                // Determine message type and content
                let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' = 'text';
                let content = '';
                let hasValidContent = false;

                if (msg.message?.conversation) {
                  messageType = 'text';
                  content = msg.message.conversation;
                  hasValidContent = content.trim().length > 0;
                } else if (msg.message?.extendedTextMessage?.text) {
                  messageType = 'text';
                  content = msg.message.extendedTextMessage.text;
                  hasValidContent = content.trim().length > 0;
                } else if (msg.message?.imageMessage) {
                  messageType = 'image';
                  content = msg.message.imageMessage.caption || '';
                  hasValidContent = true;
                } else if (msg.message?.videoMessage) {
                  messageType = 'video';
                  content = msg.message.videoMessage.caption || '';
                  hasValidContent = true;
                } else if (msg.message?.audioMessage) {
                  messageType = 'audio';
                  hasValidContent = true;
                } else if (msg.message?.documentMessage) {
                  messageType = 'document';
                  content = msg.message.documentMessage.fileName || 'Document';
                  hasValidContent = true;
                } else if (msg.message?.stickerMessage) {
                  messageType = 'sticker';
                  hasValidContent = true;
                }

                // Skip messages without valid content
                if (!hasValidContent) {
                  continue;
                }

                // Resolve phone number from LID
                let senderPn: string | undefined;
                const isLidFormat = remoteJid.includes('@lid');

                if (isLidFormat) {
                  if (remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
                    senderPn = remoteJidAlt;
                    this.storeLidMapping(sessionId, remoteJid, remoteJidAlt);
                  } else {
                    senderPn = this.getPhoneFromLid(sessionId, remoteJid);
                  }
                }

                this.logger.log(`[HISTORY-SET] Message - Session: ${sessionId}, From: ${remoteJid}, Type: ${messageType}, FromMe: ${fromMe}`);

                await this.notifyMessage({
                  sessionId,
                  remoteJid,
                  remoteJidAlt: remoteJidAlt || undefined,
                  messageId,
                  fromMe,
                  timestamp,
                  type: messageType,
                  content,
                  mediaUrl: undefined,
                  pushName,
                  senderPn,
                });
              } catch (msgErr) {
                this.logger.error(`Error processing history message: ${msgErr}`);
              }
            }
          }

          // Also process messages from conversations if present (different history sync format)
          if (data?.chats && Array.isArray(data.chats)) {
            for (const chat of data.chats) {
              if (chat.messages && Array.isArray(chat.messages)) {
                this.logger.log(`Processing ${chat.messages.length} messages from chat ${chat.id} in history sync`);

                for (const msg of chat.messages) {
                  try {
                    if (!msg.message || msg.key?.remoteJid === 'status@broadcast') {
                      continue;
                    }

                    const remoteJid = msg.key?.remoteJid || chat.id || '';
                    const remoteJidAlt = (msg.key as any)?.remoteJidAlt || '';
                    const messageId = msg.key?.id || '';
                    const fromMe = msg.key?.fromMe || false;
                    const timestamp = msg.messageTimestamp as number || Math.floor(Date.now() / 1000);
                    const pushName = msg.pushName || '';

                    if (msg.message?.reactionMessage) {
                      continue;
                    }

                    let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' = 'text';
                    let content = '';
                    let hasValidContent = false;

                    if (msg.message?.conversation) {
                      content = msg.message.conversation;
                      hasValidContent = content.trim().length > 0;
                    } else if (msg.message?.extendedTextMessage?.text) {
                      content = msg.message.extendedTextMessage.text;
                      hasValidContent = content.trim().length > 0;
                    } else if (msg.message?.imageMessage) {
                      messageType = 'image';
                      content = msg.message.imageMessage.caption || '';
                      hasValidContent = true;
                    } else if (msg.message?.videoMessage) {
                      messageType = 'video';
                      content = msg.message.videoMessage.caption || '';
                      hasValidContent = true;
                    } else if (msg.message?.audioMessage) {
                      messageType = 'audio';
                      hasValidContent = true;
                    } else if (msg.message?.documentMessage) {
                      messageType = 'document';
                      content = msg.message.documentMessage.fileName || 'Document';
                      hasValidContent = true;
                    } else if (msg.message?.stickerMessage) {
                      messageType = 'sticker';
                      hasValidContent = true;
                    }

                    if (!hasValidContent) {
                      continue;
                    }

                    let senderPn: string | undefined;
                    const isLidFormat = remoteJid.includes('@lid');

                    if (isLidFormat) {
                      if (remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
                        senderPn = remoteJidAlt;
                        this.storeLidMapping(sessionId, remoteJid, remoteJidAlt);
                      } else {
                        senderPn = this.getPhoneFromLid(sessionId, remoteJid);
                      }
                    }

                    await this.notifyMessage({
                      sessionId,
                      remoteJid,
                      remoteJidAlt: remoteJidAlt || undefined,
                      messageId,
                      fromMe,
                      timestamp,
                      type: messageType,
                      content,
                      mediaUrl: undefined,
                      pushName,
                      senderPn,
                    });
                  } catch (msgErr) {
                    this.logger.error(`Error processing chat history message: ${msgErr}`);
                  }
                }
              }
            }
          }
        } catch (err) {
          this.logger.error(`Error processing messaging history: ${err}`);
        }
      });

      // Also try to get LID mapping from contacts.update events
      socket.ev.on('contacts.update', async (updates: any[]) => {
        try {
          for (const update of updates) {
            // If we have both id (phone JID) and lid, store the mapping
            if (update.id && update.id.includes('@s.whatsapp.net')) {
              const lid = update.lid || update.id?.replace('@s.whatsapp.net', '@lid');
              if (lid) {
                this.storeLidMapping(sessionId, lid, update.id);
              }
            }
            // Also check phoneNumber field
            if (update.lid && update.phoneNumber) {
              this.storeLidMapping(sessionId, update.lid, update.phoneNumber);
            }
          }
        } catch (err) {
          this.logger.error(`Error processing contacts update: ${err}`);
        }
      });

      // Handle presence updates (online/offline status, last seen)
      socket.ev.on('presence.update', async (presenceData: any) => {
        try {
          const jid = presenceData.id;
          if (!jid || jid === 'status@broadcast') return;

          // presenceData.presences is a map of participant -> presence info
          const presences = presenceData.presences || {};
          for (const [participant, info] of Object.entries(presences)) {
            const presenceInfo = info as any;
            const lastKnownPresence = presenceInfo.lastKnownPresence;
            const lastSeen = presenceInfo.lastSeen;

            if (lastKnownPresence) {
              this.logger.debug(`Presence update - JID: ${jid}, Presence: ${lastKnownPresence}, LastSeen: ${lastSeen || 'N/A'}`);

              await this.notifyPresence({
                sessionId,
                remoteJid: jid,
                presence: lastKnownPresence,
                lastSeen: lastSeen,
              });
            }
          }
        } catch (err) {
          this.logger.error(`Error processing presence update: ${err}`);
        }
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        if (connection.status === 'connecting') {
          reject(new Error('Connection timeout'));
        }
      }, 60000);
    });
  }

  async disconnect(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (connection?.socket) {
      await connection.socket.logout();
      connection.socket.end(undefined);
      connection.status = 'disconnected';
      connection.qrCode = null;
      this.notifyConnectionChange(sessionId, 'disconnected');
    }
    this.clearSession(sessionId);
  }

  getConnection(sessionId: string): WhatsAppConnection | undefined {
    return this.connections.get(sessionId);
  }

  getQrCode(sessionId: string): string | null {
    return this.connections.get(sessionId)?.qrCode || null;
  }

  getStatus(sessionId: string): string {
    return this.connections.get(sessionId)?.status || 'disconnected';
  }

  /**
   * Get the actual connection status from the in-memory connection map
   * Used to check the real state vs database state (which may be stale)
   * @param sessionId - The session ID to check
   * @returns The live connection status or 'disconnected' if not in memory
   */
  getConnectionStatus(sessionId: string): 'disconnected' | 'connecting' | 'qr_pending' | 'connected' {
    return this.connections.get(sessionId)?.status || 'disconnected';
  }

  private async clearSession(sessionId: string) {
    const sessionDir = path.join(this.authDir, sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    this.connections.delete(sessionId);

    // Clean up session-related data to prevent memory leaks
    await this.lidMapping.clearSession(sessionId);
    this.messageTimestamps.delete(sessionId);
    this.presenceTimestamps.delete(sessionId);
    this.reconnectAttempts.delete(sessionId);
  }

  async sendMessage(sessionId: string, to: string, message: string, options?: { skipPresence?: boolean }): Promise<any> {
    const connection = this.connections.get(sessionId);
    if (!connection?.socket || connection.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    // Check rate limits to avoid bulk messaging detection
    const waitTime = this.checkRateLimit(sessionId);
    if (waitTime > 0) {
      this.logger.log(`Rate limit: waiting ${waitTime}ms before sending message`);
      await delay(waitTime);
    }

    // Add human-like behavior to avoid detection
    // CRITICAL: Rate limit presence updates to avoid WhatsApp flagging as bot
    // Only send presence if:
    // 1. Not explicitly skipped (for broadcasts)
    // 2. Enough time has passed since last presence update (30s minimum)
    const shouldSendPresence = !options?.skipPresence && this.canSendPresenceUpdate(sessionId);

    if (shouldSendPresence) {
      try {
        // Simulate typing indicator like real WhatsApp Web
        await connection.socket.presenceSubscribe(jid);
        await delay(300 + Math.random() * 200); // Small random delay

        // Show "composing" (typing) status
        await connection.socket.sendPresenceUpdate('composing', jid);

        // Wait for a realistic typing duration based on message length
        // Average typing speed: ~200-300ms per character, with some randomness
        const typingDuration = Math.min(
          Math.max(1000, message.length * 50 + Math.random() * 500),
          5000 // Cap at 5 seconds
        );
        await delay(typingDuration);

        // Stop typing indicator
        await connection.socket.sendPresenceUpdate('paused', jid);
        await delay(100 + Math.random() * 100);

      } catch (err) {
        // Presence updates are not critical, continue with sending
        this.logger.debug(`Presence update failed (non-critical): ${err}`);
      }
    }

    // Record the message for rate limiting
    this.recordMessageSent(sessionId);

    // Send the actual message
    return connection.socket.sendMessage(jid, { text: message });
  }

  /**
   * Send a reaction to a message on WhatsApp
   * @param sessionId - The session to use
   * @param remoteJid - The chat JID (recipient)
   * @param messageId - The WhatsApp message ID to react to
   * @param emoji - The emoji reaction (or empty string to remove reaction)
   * @param fromMe - Whether the message being reacted to was sent by us (outbound)
   */
  async sendReaction(sessionId: string, remoteJid: string, messageId: string, emoji: string, fromMe: boolean = false): Promise<any> {
    const connection = this.connections.get(sessionId);
    if (!connection?.socket || connection.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;

    this.logger.log(`Sending reaction ${emoji || '(remove)'} to message ${messageId}, fromMe: ${fromMe}`);

    return connection.socket.sendMessage(jid, {
      react: {
        text: emoji,
        key: {
          remoteJid: jid,
          id: messageId,
          fromMe: fromMe, // Required to properly react to outbound messages
        },
      },
    });
  }

  /**
   * Send read receipt for messages in a chat
   * @param sessionId - The session to use
   * @param remoteJid - The chat JID
   * @param messageIds - Array of message IDs to mark as read
   */
  async sendReadReceipt(sessionId: string, remoteJid: string, messageIds: string[]): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (!connection?.socket || connection.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;

    try {
      await connection.socket.readMessages([{
        remoteJid: jid,
        id: messageIds[0], // Baileys marks all messages up to this one as read
        participant: undefined,
      }]);
      this.logger.log(`Sent read receipt for ${messageIds.length} messages in ${jid}`);
    } catch (error) {
      this.logger.error(`Failed to send read receipt: ${error}`);
      throw error;
    }
  }

  /**
   * Check if a phone number exists on WhatsApp and get its JID
   * @param sessionId - The session to use for checking
   * @param phoneNumber - Phone number to check (digits only, with country code)
   * @returns Object with exists flag and jid if found
   */
  async checkNumberOnWhatsApp(sessionId: string, phoneNumber: string): Promise<{ exists: boolean; jid?: string }> {
    const connection = this.connections.get(sessionId);
    if (!connection?.socket || connection.status !== 'connected') {
      throw new Error('Session not connected');
    }

    try {
      // Normalize phone number - remove non-digits
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      const jid = `${normalizedPhone}@s.whatsapp.net`;

      // Use Baileys onWhatsApp method to check if number exists
      const result = await connection.socket.onWhatsApp(jid);

      if (result && result.length > 0 && result[0].exists) {
        return {
          exists: true,
          jid: result[0].jid,
        };
      }

      return { exists: false };
    } catch (error) {
      this.logger.error(`Error checking WhatsApp number: ${error}`);
      return { exists: false };
    }
  }

  /**
   * Get all connected session IDs
   */
  getConnectedSessions(): string[] {
    const connected: string[] = [];
    for (const [sessionId, conn] of this.connections) {
      if (conn.status === 'connected') {
        connected.push(sessionId);
      }
    }
    return connected;
  }

  /**
   * Store a LID to Phone Number mapping for a session.
   * Now uses persistent database storage with in-memory cache.
   * Database persistence is fire-and-forget for performance.
   * @param sessionId - The session ID
   * @param lid - The LID (e.g., 12345@lid)
   * @param phoneJid - The phone JID (e.g., 1234567890@s.whatsapp.net)
   */
  storeLidMapping(sessionId: string, lid: string, phoneJid: string): void {
    // Fire-and-forget database persistence while immediate cache update
    this.lidMapping.store(sessionId, lid, phoneJid).catch((err) => {
      this.logger.error(`Failed to persist LID mapping: ${err}`);
    });
  }

  /**
   * Get phone JID from LID for a session (synchronous from cache).
   * For high-frequency lookups during message processing.
   * @param sessionId - The session ID
   * @param lid - The LID to look up
   * @returns The phone JID if found, null otherwise
   */
  getPhoneFromLid(sessionId: string, lid: string): string | null {
    return this.lidMapping.getSync(sessionId, lid);
  }

  /**
   * Get phone JID from LID with fallback to database (asynchronous).
   * Used for initial lookup or cache miss scenarios.
   */
  async getPhoneFromLidAsync(sessionId: string, lid: string): Promise<string | null> {
    return this.lidMapping.get(sessionId, lid);
  }

  /**
   * Store LID mapping from phone number (reverse lookup via onWhatsApp)
   * This can be used when we know a phone number to pre-populate the LID mapping
   * @param sessionId - The session ID
   * @param phoneNumber - Phone number to look up
   */
  async storeLidMappingForPhone(sessionId: string, phoneNumber: string): Promise<void> {
    try {
      const result = await this.checkNumberOnWhatsApp(sessionId, phoneNumber);
      if (result.exists && result.jid) {
        // The JID returned might be in @lid format or @s.whatsapp.net format
        // If it's @lid, we should store the mapping
        const normalizedPhone = phoneNumber.replace(/\D/g, '');
        const phoneJid = `${normalizedPhone}@s.whatsapp.net`;

        if (result.jid.includes('@lid')) {
          this.storeLidMapping(sessionId, result.jid, phoneJid);
        }
      }
    } catch (error) {
      this.logger.error(`Error storing LID mapping for phone: ${error}`);
    }
  }
}
