import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * MessageBufferService handles buffering of messages received during disconnection.
 *
 * Problem: When a session is disconnecting, messages that arrive in the 50-500ms window
 * during socket closure are lost because event listeners are detached.
 *
 * Solution: Buffer messages to both Redis (real-time) and database (persistence) during
 * disconnection, then flush them when reconnecting.
 */
@Injectable()
export class MessageBufferService {
  private readonly logger = new Logger(MessageBufferService.name);
  private readonly BUFFER_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly BUFFER_KEY_PREFIX = 'whatsapp:message-buffer:';

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Add a message to the buffer during disconnection.
   * Stores in both Redis (for fast access) and database (for persistence).
   */
  async bufferMessage(sessionId: string, messageData: any): Promise<void> {
    try {
      // Store to database for persistence
      await this.prisma.messageBuffer.create({
        data: {
          sessionId,
          rawData: messageData,
          status: 'pending',
        },
      });

      // Store to Redis for fast retrieval during reconnection
      const bufferKey = `${this.BUFFER_KEY_PREFIX}${sessionId}`;
      const bufferedMessages = await this.redis.get(bufferKey);
      const messages = bufferedMessages ? JSON.parse(bufferedMessages) : [];
      messages.push({
        ...messageData,
        bufferedAt: Date.now(),
      });

      await this.redis.set(bufferKey, JSON.stringify(messages), this.BUFFER_TTL);

      this.logger.debug(`Buffered message for session ${sessionId}`);
    } catch (err) {
      this.logger.error(`Error buffering message for session ${sessionId}: ${err}`);
      // Non-critical failure - logging is sufficient
    }
  }

  /**
   * Retrieve all buffered messages for a session and clear the buffer.
   * Called on reconnection to process all queued messages.
   */
  async flushBuffer(sessionId: string): Promise<any[]> {
    try {
      // Get from database
      const bufferedMessages = await this.prisma.messageBuffer.findMany({
        where: {
          sessionId,
          status: 'pending',
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const messages = bufferedMessages.map((m) => m.rawData);

      this.logger.log(
        `Flushing ${messages.length} buffered messages for session ${sessionId}`,
      );

      return messages;
    } catch (err) {
      this.logger.error(
        `Error flushing message buffer for session ${sessionId}: ${err}`,
      );
      return [];
    }
  }

  /**
   * Mark buffered messages as processed.
   */
  async markAsProcessed(sessionId: string, messageIds: string[]): Promise<void> {
    try {
      await this.prisma.messageBuffer.updateMany({
        where: {
          sessionId,
          id: { in: messageIds },
        },
        data: {
          status: 'completed',
          processedAt: new Date(),
        },
      });

      this.logger.debug(
        `Marked ${messageIds.length} messages as processed for session ${sessionId}`,
      );
    } catch (err) {
      this.logger.error(`Error marking messages as processed: ${err}`);
    }
  }

  /**
   * Mark a buffered message as failed.
   */
  async markAsFailed(sessionId: string, messageId: string, error: string): Promise<void> {
    try {
      await this.prisma.messageBuffer.update({
        where: { id: messageId },
        data: {
          status: 'failed',
          error,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Error marking message ${messageId} as failed: ${err}`);
    }
  }

  /**
   * Clear buffered messages older than the TTL.
   * Run periodically (e.g., via scheduler) to prevent database bloat.
   */
  async cleanupOldBuffers(ageHours: number = 24): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - ageHours * 60 * 60 * 1000);

      const result = await this.prisma.messageBuffer.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          status: { in: ['completed', 'failed'] },
        },
      });

      this.logger.log(`Cleaned up ${result.count} old buffered messages`);
    } catch (err) {
      this.logger.error(`Error cleaning up old message buffers: ${err}`);
    }
  }

  /**
   * Get buffer statistics for monitoring.
   */
  async getBufferStats(sessionId?: string) {
    try {
      const where = sessionId ? { sessionId } : {};

      const stats = await Promise.all([
        this.prisma.messageBuffer.count({ where: { ...where, status: 'pending' } }),
        this.prisma.messageBuffer.count({ where: { ...where, status: 'processing' } }),
        this.prisma.messageBuffer.count({ where: { ...where, status: 'completed' } }),
        this.prisma.messageBuffer.count({ where: { ...where, status: 'failed' } }),
      ]);

      return {
        pending: stats[0],
        processing: stats[1],
        completed: stats[2],
        failed: stats[3],
        total: stats.reduce((a, b) => a + b, 0),
      };
    } catch (err) {
      this.logger.error(`Error getting buffer stats: ${err}`);
      return null;
    }
  }
}
