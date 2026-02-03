import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * LidMappingService manages the mapping between WhatsApp's Local IDs (@lid format)
 * and actual phone numbers (@s.whatsapp.net format).
 *
 * Problem: WhatsApp uses temporary @lid format internally. Messages come with:
 * - remoteJid: @lid format (temporary, changes per device)
 * - remoteJidAlt: @s.whatsapp.net format (actual phone number)
 *
 * The old system stored these only in-memory, causing:
 * - Loss of all mappings on server restart
 * - Failed contact matching for repeat messages
 * - Creation of duplicate contacts
 *
 * Solution: Persist mappings to database with:
 * - Per-session isolation
 * - TTL-based cleanup (24 hours)
 * - In-memory cache for performance
 */
@Injectable()
export class LidMappingService {
  private readonly logger = new Logger(LidMappingService.name);

  // In-memory cache for performance
  private readonly cache = new Map<string, Map<string, string>>();
  private readonly MAX_CACHE_SIZE_PER_SESSION = 10000;

  constructor(private prisma: PrismaService) {}

  /**
   * Store a LID to phone number mapping.
   * Updates in both database and in-memory cache.
   */
  async store(sessionId: string, lid: string, phoneJid: string): Promise<void> {
    try {
      // Store in database
      await this.prisma.lidMapping.upsert({
        where: {
          sessionId_lid: { sessionId, lid },
        },
        update: {
          phoneJid,
          updatedAt: new Date(),
        },
        create: {
          sessionId,
          lid,
          phoneJid,
        },
      });

      // Update in-memory cache
      if (!this.cache.has(sessionId)) {
        this.cache.set(sessionId, new Map());
      }
      const sessionCache = this.cache.get(sessionId)!;

      // Check if at capacity and evict oldest if needed
      if (
        sessionCache.size >= this.MAX_CACHE_SIZE_PER_SESSION &&
        !sessionCache.has(lid)
      ) {
        const firstKey = sessionCache.keys().next().value;
        sessionCache.delete(firstKey);
        this.logger.debug(
          `Evicted old LID mapping ${firstKey} for session ${sessionId}`,
        );
      }

      sessionCache.set(lid, phoneJid);

      this.logger.debug(`Stored LID mapping: ${lid} → ${phoneJid}`);
    } catch (err) {
      this.logger.error(`Error storing LID mapping: ${err}`);
    }
  }

  /**
   * Synchronous get from in-memory cache only.
   * Used during high-frequency message processing for performance.
   */
  getSync(sessionId: string, lid: string): string | null {
    return this.cache.get(sessionId)?.get(lid) ?? null;
  }

  /**
   * Asynchronous get that checks cache first, then database.
   * Used when initialization is needed.
   */
  async get(sessionId: string, lid: string): Promise<string | null> {
    // Check in-memory cache first
    const syncResult = this.getSync(sessionId, lid);
    if (syncResult) {
      return syncResult;
    }

    // Check database
    try {
      const mapping = await this.prisma.lidMapping.findUnique({
        where: {
          sessionId_lid: { sessionId, lid },
        },
      });

      if (mapping) {
        // Add to cache for future lookups
        if (!this.cache.has(sessionId)) {
          this.cache.set(sessionId, new Map());
        }
        this.cache.get(sessionId)!.set(lid, mapping.phoneJid);

        return mapping.phoneJid;
      }

      return null;
    } catch (err) {
      this.logger.error(`Error retrieving LID mapping: ${err}`);
      return null;
    }
  }

  /**
   * Bulk get mappings for a session.
   */
  async getBatch(sessionId: string, lids: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    for (const lid of lids) {
      const phoneJid = await this.get(sessionId, lid);
      if (phoneJid) {
        result.set(lid, phoneJid);
      }
    }

    return result;
  }

  /**
   * Load all mappings for a session into cache on startup.
   */
  async loadSessionCache(sessionId: string): Promise<void> {
    try {
      const mappings = await this.prisma.lidMapping.findMany({
        where: { sessionId },
      });

      const sessionCache = new Map<string, string>();
      for (const mapping of mappings) {
        sessionCache.set(mapping.lid, mapping.phoneJid);
      }

      this.cache.set(sessionId, sessionCache);
      this.logger.log(
        `Loaded ${mappings.length} LID mappings for session ${sessionId}`,
      );
    } catch (err) {
      this.logger.error(`Error loading session cache: ${err}`);
    }
  }

  /**
   * Clear cache for a session (e.g., on logout).
   */
  async clearSessionCache(sessionId: string): Promise<void> {
    this.cache.delete(sessionId);
    this.logger.debug(`Cleared LID cache for session ${sessionId}`);
  }

  /**
   * Delete mappings for a session.
   */
  async clearSession(sessionId: string): Promise<void> {
    try {
      await this.prisma.lidMapping.deleteMany({
        where: { sessionId },
      });
      this.cache.delete(sessionId);

      this.logger.log(`Cleared all LID mappings for session ${sessionId}`);
    } catch (err) {
      this.logger.error(`Error clearing session mappings: ${err}`);
    }
  }

  /**
   * Get statistics about LID mappings.
   */
  async getStats(sessionId?: string) {
    try {
      const where = sessionId ? { sessionId } : {};
      const count = await this.prisma.lidMapping.count({ where });
      const oldestUnused = await this.prisma.lidMapping.findFirst({
        where,
        orderBy: { updatedAt: 'asc' },
        select: { lid: true, updatedAt: true },
      });

      return {
        totalMappings: count,
        oldestMappingAge: oldestUnused
          ? Date.now() - oldestUnused.updatedAt.getTime()
          : null,
        cacheSize: sessionId
          ? this.cache.get(sessionId)?.size ?? 0
          : Array.from(this.cache.values()).reduce((sum, m) => sum + m.size, 0),
      };
    } catch (err) {
      this.logger.error(`Error getting LID stats: ${err}`);
      return null;
    }
  }

  /**
   * Cleanup old LID mappings (run periodically).
   * Removes mappings older than 7 days that haven't been updated.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldMappings(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const result = await this.prisma.lidMapping.deleteMany({
        where: {
          updatedAt: { lt: cutoffDate },
        },
      });

      this.logger.log(`Cleaned up ${result.count} old LID mappings`);
    } catch (err) {
      this.logger.error(`Error cleaning up old LID mappings: ${err}`);
    }
  }
}
