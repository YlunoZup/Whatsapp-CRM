import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { QueueService } from '../../common/queue/queue.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class ScheduledMessagesProcessor implements OnModuleInit {
  private readonly logger = new Logger(ScheduledMessagesProcessor.name);
  private readonly lockKey = 'scheduled-messages:processing-lock';
  private readonly lockTTL = 120; // 2 minutes - longer than typical processing time

  constructor(
    private readonly scheduledMessagesService: ScheduledMessagesService,
    private readonly queueService: QueueService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    this.logger.log('Scheduled messages processor initialized');
  }

  /**
   * Acquire a distributed lock to prevent concurrent processing across instances
   * Returns true if lock was acquired, false if another instance holds the lock
   */
  private async acquireLock(): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      // SET with NX (only if not exists) and EX (with expiry) is atomic
      const result = await client.set(this.lockKey, Date.now().toString(), 'EX', this.lockTTL, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error('Failed to acquire distributed lock:', error);
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.redis.del(this.lockKey);
    } catch (error) {
      this.logger.error('Failed to release distributed lock:', error);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledMessages() {
    // Acquire distributed lock - prevents concurrent processing across clustered instances
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      this.logger.debug('Another instance is processing scheduled messages, skipping...');
      return;
    }

    try {
      const messages = await this.scheduledMessagesService.getReadyToSend();

      if (messages.length === 0) {
        return;
      }

      this.logger.log(`Processing ${messages.length} scheduled messages`);

      for (const message of messages) {
        try {
          // Queue the message for sending
          await this.queueService.addMessageJob({
            sessionId: message.sessionId,
            to: message.contactPhone,
            message: message.content,
            type: message.type as 'text' | 'image' | 'video' | 'audio' | 'document',
            mediaUrl: message.mediaUrl || undefined,
            metadata: {
              scheduledMessageId: message.id,
              tenantId: message.tenantId,
            },
          });

          // Mark as sent (will be updated again when actually delivered)
          await this.scheduledMessagesService.markAsSent(message.id);

          this.logger.log(`Queued scheduled message ${message.id} for delivery`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Failed to queue scheduled message ${message.id}: ${errorMessage}`);
          await this.scheduledMessagesService.markAsFailed(message.id, errorMessage);
        }
      }
    } catch (error) {
      this.logger.error('Error processing scheduled messages:', error);
    } finally {
      await this.releaseLock();
    }
  }

  // Manual trigger for testing
  async triggerProcessing() {
    this.logger.log('Manual processing triggered');
    await this.processScheduledMessages();
  }
}
