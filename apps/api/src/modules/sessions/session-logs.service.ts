import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

export interface SessionLogEntry {
  sessionId: string;
  level: LogLevel;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SessionLogsService {
  private readonly logger = new Logger(SessionLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a log entry for a session
   */
  async log(entry: SessionLogEntry): Promise<void> {
    try {
      await this.prisma.sessionLog.create({
        data: {
          sessionId: entry.sessionId,
          level: entry.level,
          event: entry.event,
          message: entry.message,
          metadata: (entry.metadata || {}) as any,
        },
      });
    } catch (error) {
      // Don't fail if logging fails, just log to console
      this.logger.error(`Failed to create session log: ${error}`);
    }
  }

  /**
   * Log an info message
   */
  async info(sessionId: string, event: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log({ sessionId, level: 'info', event, message, metadata });
  }

  /**
   * Log a warning message
   */
  async warning(sessionId: string, event: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log({ sessionId, level: 'warning', event, message, metadata });
  }

  /**
   * Log an error message
   */
  async error(sessionId: string, event: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log({ sessionId, level: 'error', event, message, metadata });
  }

  /**
   * Log a debug message
   */
  async debug(sessionId: string, event: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log({ sessionId, level: 'debug', event, message, metadata });
  }

  /**
   * Get logs for a session with pagination
   */
  async getLogs(
    sessionId: string,
    options: {
      level?: LogLevel;
      event?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { level, event, startDate, endDate, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { sessionId };

    if (level) where.level = level;
    if (event) where.event = event;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.sessionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sessionLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get available event types for filtering
   */
  async getEventTypes(sessionId: string): Promise<string[]> {
    const events = await this.prisma.sessionLog.findMany({
      where: { sessionId },
      select: { event: true },
      distinct: ['event'],
    });
    return events.map(e => e.event);
  }

  /**
   * Clear old logs (retention policy)
   */
  async clearOldLogs(sessionId: string, daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.sessionLog.deleteMany({
      where: {
        sessionId,
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Get log statistics for a session
   */
  async getStats(sessionId: string) {
    const [total, byLevel, byEvent] = await Promise.all([
      this.prisma.sessionLog.count({ where: { sessionId } }),
      this.prisma.sessionLog.groupBy({
        by: ['level'],
        where: { sessionId },
        _count: { id: true },
      }),
      this.prisma.sessionLog.groupBy({
        by: ['event'],
        where: { sessionId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    const levelCounts: Record<string, number> = {
      debug: 0,
      info: 0,
      warning: 0,
      error: 0,
    };

    byLevel.forEach(item => {
      levelCounts[item.level] = item._count.id;
    });

    return {
      total,
      byLevel: levelCounts,
      topEvents: byEvent.map(item => ({
        event: item.event,
        count: item._count.id,
      })),
    };
  }
}
