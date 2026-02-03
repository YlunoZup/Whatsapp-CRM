import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

interface RedisOptions {
  host: string;
  port: number;
  password?: string;
  tls?: boolean;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly subscribers: Map<string, Redis> = new Map();

  constructor(@Inject('REDIS_OPTIONS') options: RedisOptions) {
    this.client = new Redis({
      host: options.host,
      port: options.port,
      password: options.password,
      maxRetriesPerRequest: null,
      tls: options.tls ? {} : undefined,
    });
  }

  async onModuleDestroy() {
    // Close all subscriber connections
    for (const [channel, subscriber] of this.subscribers) {
      try {
        await subscriber.quit();
        this.logger.debug(`Closed subscriber for channel: ${channel}`);
      } catch (error) {
        this.logger.error(`Error closing subscriber for channel ${channel}:`, error);
      }
    }
    this.subscribers.clear();

    // Close main client
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.client.hdel(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  /**
   * Subscribe to a Redis channel
   * Returns an unsubscribe function to properly clean up the connection
   */
  async subscribe(channel: string, callback: (message: string) => void): Promise<() => Promise<void>> {
    // Check if already subscribed to this channel
    if (this.subscribers.has(channel)) {
      this.logger.warn(`Already subscribed to channel: ${channel}`);
      // Return a no-op unsubscribe
      return async () => {};
    }

    const subscriber = this.client.duplicate();
    await subscriber.subscribe(channel);

    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        callback(message);
      }
    });

    // Store the subscriber so it can be cleaned up
    this.subscribers.set(channel, subscriber);
    this.logger.debug(`Subscribed to channel: ${channel}`);

    // Return unsubscribe function
    return async () => {
      try {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
        this.subscribers.delete(channel);
        this.logger.debug(`Unsubscribed from channel: ${channel}`);
      } catch (error) {
        this.logger.error(`Error unsubscribing from channel ${channel}:`, error);
      }
    };
  }
}
