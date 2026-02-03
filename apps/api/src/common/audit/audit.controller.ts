import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { RolesGuard, Roles } from '../guards/roles.guard';
import { TenantId } from '../decorators/tenant-id.decorator';
import { AuditService } from './audit.service';
import { parseISO } from 'date-fns';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('admin')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs (admin only)' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAuditLogs(
    @TenantId() tenantId: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const startDate = startDateStr ? parseISO(startDateStr) : undefined;
    const endDate = endDateStr ? parseISO(endDateStr) : undefined;

    return this.auditService.getAuditLogs(tenantId, {
      userId,
      action,
      resource,
      startDate,
      endDate,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('actions')
  @ApiOperation({ summary: 'Get list of available audit actions' })
  getAuditActions() {
    return {
      auth: ['auth.login', 'auth.logout', 'auth.login_failed', 'auth.password_changed'],
      users: ['user.created', 'user.updated', 'user.deleted', 'user.activated', 'user.deactivated'],
      contacts: [
        'contact.created', 'contact.updated', 'contact.deleted',
        'contact.status_changed', 'contacts.imported', 'contacts.exported', 'contacts.merged',
        'contacts.bulk.tags_added', 'contacts.bulk.tags_removed',
        'contacts.bulk.session_assigned', 'contacts.bulk.deleted',
        'contacts.bulk.exported', 'contacts.bulk.edited', 'contacts.bulk.status_changed',
      ],
      conversations: [
        'conversation.created', 'conversation.assigned', 'conversation.closed',
        'conversation.reopened', 'conversation.deleted',
        'conversations.bulk.updated', 'conversations.bulk.deleted',
      ],
      messages: ['message.sent', 'message.deleted', 'broadcast.created', 'broadcast.sent', 'broadcast.cancelled'],
      sessions: ['session.created', 'session.connected', 'session.disconnected', 'session.deleted'],
      tags: ['tag.created', 'tag.updated', 'tag.deleted'],
      templates: ['template.created', 'template.updated', 'template.deleted'],
      webhooks: ['webhook.created', 'webhook.updated', 'webhook.deleted', 'apikey.created', 'apikey.deleted'],
      settings: ['settings.updated'],
    };
  }

  @Get('resources')
  @ApiOperation({ summary: 'Get list of available audit resources' })
  getAuditResources() {
    return [
      'user',
      'contact',
      'conversation',
      'message',
      'broadcast',
      'session',
      'tag',
      'template',
      'webhook',
      'apikey',
      'settings',
    ];
  }
}
