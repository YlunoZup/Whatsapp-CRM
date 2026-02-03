import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export interface CacheResult<T> {
  value: T | null;
  hit: boolean;
  error?: Error;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL = 300; // 5 minutes
  private readonly keyPrefix = 'crm:cache:';

  constructor(private readonly redis: RedisService) {}

  private buildKey(key: string, prefix?: string): string {
    return `${this.keyPrefix}${prefix ? `${prefix}:` : ''}${key}`;
  }

  /**
   * Get with result object that distinguishes between miss and error
   */
  async getWithResult<T>(key: string, options: CacheOptions = {}): Promise<CacheResult<T>> {
    try {
      const cacheKey = this.buildKey(key, options.prefix);
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return { value: JSON.parse(cached) as T, hit: true };
      }
      return { value: null, hit: false };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Cache get error for key ${key}:`, error);
      return { value: null, hit: false, error: err };
    }
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const result = await this.getWithResult<T>(key, options);
    return result.value;
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options.prefix);
      const ttl = options.ttl || this.defaultTTL;
      await this.redis.set(cacheKey, JSON.stringify(value), ttl);
      return true;
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options.prefix);
      await this.redis.del(cacheKey);
      return true;
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const client = this.redis.getClient();
      const keys = await client.keys(`${this.keyPrefix}${pattern}`);

      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.debug(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Cache deletePattern error for pattern ${pattern}:`, error);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const cached = await this.get<T>(key, options);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  // Tenant-specific cache helpers
  async getTenantCache<T>(tenantId: string, key: string, options: CacheOptions = {}): Promise<T | null> {
    return this.get<T>(`tenant:${tenantId}:${key}`, options);
  }

  async setTenantCache<T>(tenantId: string, key: string, value: T, options: CacheOptions = {}): Promise<void> {
    await this.set(`tenant:${tenantId}:${key}`, value, options);
  }

  async deleteTenantCache(tenantId: string, key: string): Promise<void> {
    await this.delete(`tenant:${tenantId}:${key}`);
  }

  async invalidateTenantCache(tenantId: string): Promise<void> {
    await this.deletePattern(`tenant:${tenantId}:*`);
  }

  // Dashboard stats cache (short TTL)
  async getDashboardStats(tenantId: string): Promise<unknown | null> {
    return this.getTenantCache(tenantId, 'dashboard:stats', { ttl: 60 });
  }

  async setDashboardStats(tenantId: string, stats: unknown): Promise<void> {
    return this.setTenantCache(tenantId, 'dashboard:stats', stats, { ttl: 60 });
  }

  // Contacts cache
  async getContactsPage(tenantId: string, page: number, limit: number, search?: string): Promise<unknown | null> {
    const key = `contacts:page:${page}:limit:${limit}${search ? `:search:${search}` : ''}`;
    return this.getTenantCache(tenantId, key, { ttl: 120 });
  }

  async setContactsPage(tenantId: string, page: number, limit: number, data: unknown, search?: string): Promise<void> {
    const key = `contacts:page:${page}:limit:${limit}${search ? `:search:${search}` : ''}`;
    return this.setTenantCache(tenantId, key, data, { ttl: 120 });
  }

  async invalidateContacts(tenantId: string): Promise<void> {
    await this.deletePattern(`tenant:${tenantId}:contacts:*`);
  }

  // Conversations cache
  async getConversationsPage(tenantId: string, page: number, status?: string): Promise<unknown | null> {
    const key = `conversations:page:${page}${status ? `:status:${status}` : ''}`;
    return this.getTenantCache(tenantId, key, { ttl: 30 });
  }

  async setConversationsPage(tenantId: string, page: number, data: unknown, status?: string): Promise<void> {
    const key = `conversations:page:${page}${status ? `:status:${status}` : ''}`;
    return this.setTenantCache(tenantId, key, data, { ttl: 30 });
  }

  async invalidateConversations(tenantId: string): Promise<void> {
    await this.deletePattern(`tenant:${tenantId}:conversations:*`);
  }

  // User cache
  async getUser(userId: string): Promise<unknown | null> {
    return this.get(`user:${userId}`, { ttl: 300 });
  }

  async setUser(userId: string, user: unknown): Promise<void> {
    await this.set(`user:${userId}`, user, { ttl: 300 });
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.delete(`user:${userId}`);
  }

  // Session cache (WhatsApp sessions)
  async getSession(sessionId: string): Promise<unknown | null> {
    return this.get(`session:${sessionId}`, { ttl: 60 });
  }

  async setSession(sessionId: string, session: unknown): Promise<void> {
    await this.set(`session:${sessionId}`, session, { ttl: 60 });
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await this.delete(`session:${sessionId}`);
  }
}
