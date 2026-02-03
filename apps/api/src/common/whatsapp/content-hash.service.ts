import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * ContentHashService provides content-based deduplication for messages.
 *
 * Problem: Messages can have:
 * - Different WhatsApp message IDs but identical content
 * - Same content sent by same person within seconds
 * - Deduplication only on whatsappMessageId is insufficient
 *
 * Solution: Use SHA256 hash of message content + timestamp + sender
 * as an additional deduplication layer.
 */
@Injectable()
export class ContentHashService {
  /**
   * Generate hash for a message for deduplication.
   * Combines: content + type + sender JID + approximate timestamp (within 5s window)
   */
  generateHash(
    content: string,
    messageType: string,
    senderJid: string,
    timestamp: number,
  ): string {
    // Round timestamp to 5-second windows for slight flexibility
    const timeWindow = Math.floor(timestamp / 5000) * 5000;

    const input = `${content}|${messageType}|${senderJid}|${timeWindow}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Generate a simpler hash for exact deduplication (no time window).
   */
  generateExactHash(content: string, messageType: string, senderJid: string): string {
    const input = `${content}|${messageType}|${senderJid}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Validate timestamp is reasonable (not too old, not in future).
   * Returns true if valid, false otherwise.
   */
  isValidTimestamp(timestamp: number, maxAgeHours: number = 24): boolean {
    const now = Date.now() / 1000; // Convert to seconds
    const maxAge = maxAgeHours * 60 * 60;

    // Too old
    if (now - timestamp > maxAge) {
      return false;
    }

    // In future (>1 minute tolerance for clock skew)
    if (timestamp - now > 60) {
      return false;
    }

    return true;
  }

  /**
   * Extract hashable content from message object.
   */
  extractContent(messageObject: any): string | null {
    // Text messages
    if (messageObject.conversation) {
      return messageObject.conversation;
    }

    if (messageObject.extendedTextMessage?.text) {
      return messageObject.extendedTextMessage.text;
    }

    // Media messages - use caption if available, otherwise indicate type
    if (messageObject.imageMessage?.caption) {
      return messageObject.imageMessage.caption;
    }

    if (messageObject.videoMessage?.caption) {
      return messageObject.videoMessage.caption;
    }

    if (messageObject.audioMessage) {
      return '[audio-message]';
    }

    if (messageObject.documentMessage?.fileName) {
      return messageObject.documentMessage.fileName;
    }

    if (messageObject.stickerMessage) {
      return '[sticker-message]';
    }

    // No extractable content
    return null;
  }

  /**
   * Extract message type from message object.
   */
  extractType(
    messageObject: any,
  ): 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' {
    if (messageObject.conversation || messageObject.extendedTextMessage) {
      return 'text';
    }

    if (messageObject.imageMessage) {
      return 'image';
    }

    if (messageObject.videoMessage) {
      return 'video';
    }

    if (messageObject.audioMessage) {
      return 'audio';
    }

    if (messageObject.documentMessage) {
      return 'document';
    }

    if (messageObject.stickerMessage) {
      return 'sticker';
    }

    return 'text'; // Default fallback
  }
}
