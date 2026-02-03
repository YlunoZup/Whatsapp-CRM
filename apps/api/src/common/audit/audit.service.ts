import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          metadata: entry.metadata || {},
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      // Log to console but don't fail the request
      this.logger.error('Failed to create audit log entry', error);
    }
  }

  async logUserAction(
    tenantId: string,
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action,
      resource,
      resourceId,
      metadata,
    });
  }

  async getAuditLogs(
    tenantId: string,
    options: {
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { userId, action, resource, startDate, endDate, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
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
}

// Audit action constants
export const AuditActions = {
  // Auth
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_CHANGED: 'auth.password_changed',

  // Users
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_ACTIVATED: 'user.activated',
  USER_DEACTIVATED: 'user.deactivated',

  // Contacts
  CONTACT_CREATED: 'contact.created',
  CONTACT_UPDATED: 'contact.updated',
  CONTACT_DELETED: 'contact.deleted',
  CONTACTS_IMPORTED: 'contacts.imported',
  CONTACTS_EXPORTED: 'contacts.exported',

  // Bulk Contact Actions
  CONTACTS_BULK_TAGS_ADDED: 'contacts.bulk.tags_added',
  CONTACTS_BULK_TAGS_REMOVED: 'contacts.bulk.tags_removed',
  CONTACTS_BULK_SESSION_ASSIGNED: 'contacts.bulk.session_assigned',
  CONTACTS_BULK_DELETED: 'contacts.bulk.deleted',
  CONTACTS_BULK_EXPORTED: 'contacts.bulk.exported',
  CONTACTS_BULK_EDITED: 'contacts.bulk.edited',
  CONTACTS_MERGED: 'contacts.merged',

  // Lead Pipeline Status
  CONTACT_STATUS_CHANGED: 'contact.status_changed',
  CONTACTS_BULK_STATUS_CHANGED: 'contacts.bulk.status_changed',

  // Conversations
  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_ASSIGNED: 'conversation.assigned',
  CONVERSATION_CLOSED: 'conversation.closed',
  CONVERSATION_REOPENED: 'conversation.reopened',
  CONVERSATION_DELETED: 'conversation.deleted',

  // Bulk Conversation Actions
  CONVERSATIONS_BULK_UPDATED: 'conversations.bulk.updated',
  CONVERSATIONS_BULK_DELETED: 'conversations.bulk.deleted',

  // Messages
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELETED: 'message.deleted',
  BROADCAST_CREATED: 'broadcast.created',
  BROADCAST_SENT: 'broadcast.sent',
  BROADCAST_CANCELLED: 'broadcast.cancelled',

  // Sessions
  SESSION_CREATED: 'session.created',
  SESSION_CONNECTED: 'session.connected',
  SESSION_DISCONNECTED: 'session.disconnected',
  SESSION_DELETED: 'session.deleted',

  // Tags
  TAG_CREATED: 'tag.created',
  TAG_UPDATED: 'tag.updated',
  TAG_DELETED: 'tag.deleted',

  // Templates
  TEMPLATE_CREATED: 'template.created',
  TEMPLATE_UPDATED: 'template.updated',
  TEMPLATE_DELETED: 'template.deleted',

  // Webhooks
  WEBHOOK_CREATED: 'webhook.created',
  WEBHOOK_UPDATED: 'webhook.updated',
  WEBHOOK_DELETED: 'webhook.deleted',
  API_KEY_CREATED: 'apikey.created',
  API_KEY_DELETED: 'apikey.deleted',

  // Settings
  SETTINGS_UPDATED: 'settings.updated',
} as const;
