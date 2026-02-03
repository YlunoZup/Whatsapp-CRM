import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';

interface CreateApiKeyDto {
  name: string;
  permissions?: string[];
  expiresAt?: Date;
}

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  // API Key Management
  async findAllApiKeys(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApiKey(tenantId: string, dto: CreateApiKeyDto) {
    // Generate a random API key
    const rawKey = `wcrm_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = await bcrypt.hash(rawKey, 10);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyHash,
        permissions: dto.permissions || ['*'],
        expiresAt: dto.expiresAt,
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Return the raw key only once
    return {
      ...apiKey,
      key: rawKey, // Only returned on creation
    };
  }

  async updateApiKey(id: string, tenantId: string, data: { name?: string; permissions?: string[]; expiresAt?: Date | null }) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.permissions !== undefined && { permissions: data.permissions }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async deleteApiKey(id: string, tenantId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({
      where: { id },
    });

    return { success: true };
  }

  // Integration status (for future use with OAuth integrations)
  async getIntegrations(tenantId: string) {
    // Return available integrations and their connection status
    return {
      integrations: [
        {
          type: 'n8n',
          name: 'n8n',
          description: 'Open-source workflow automation',
          status: 'available',
          connectionMethod: 'api_key',
        },
        {
          type: 'zapier',
          name: 'Zapier',
          description: 'Workflow automation platform',
          status: 'available',
          connectionMethod: 'webhook',
        },
        {
          type: 'make',
          name: 'Make (Integromat)',
          description: 'Visual automation platform',
          status: 'available',
          connectionMethod: 'webhook',
        },
        {
          type: 'gohighlevel',
          name: 'GoHighLevel',
          description: 'All-in-one marketing platform',
          status: 'available',
          connectionMethod: 'webhook',
        },
      ],
    };
  }

  async getIntegrationDocs(type: string) {
    const docs: Record<string, object> = {
      n8n: {
        type: 'n8n',
        setup: [
          'Create an API key in the WhatsApp CRM dashboard',
          'In n8n, add a HTTP Request node',
          'Set the URL to your WhatsApp CRM API endpoint',
          'Add header "X-API-Key" with your API key',
          'Configure the request method and body as needed',
        ],
        endpoints: {
          sendMessage: {
            method: 'POST',
            url: '/api/v1/messages/send',
            body: {
              sessionId: 'your-session-id',
              to: '+5511999999999',
              type: 'text',
              content: 'Hello from n8n!',
            },
          },
          getConversations: {
            method: 'GET',
            url: '/api/v1/conversations',
          },
        },
        webhooks: {
          description: 'Create a webhook endpoint in the dashboard to receive events',
          events: [
            'message.received',
            'message.sent',
            'message.delivered',
            'message.read',
            'conversation.created',
            'session.connected',
            'session.disconnected',
          ],
        },
      },
      zapier: {
        type: 'zapier',
        setup: [
          'Create a webhook endpoint in the WhatsApp CRM dashboard',
          'Copy the webhook secret for signature verification',
          'In Zapier, create a new Zap with Webhooks by Zapier trigger',
          'Select "Catch Hook" and paste your webhook URL',
        ],
        webhookEvents: [
          'message.received',
          'message.sent',
          'contact.created',
          'conversation.created',
        ],
      },
      make: {
        type: 'make',
        setup: [
          'Create a webhook endpoint in the WhatsApp CRM dashboard',
          'In Make, add a Webhooks module',
          'Select "Custom webhook" and create a new webhook',
          'Copy the webhook URL to your CRM settings',
        ],
      },
      gohighlevel: {
        type: 'gohighlevel',
        setup: [
          'Create a webhook endpoint in the WhatsApp CRM dashboard',
          'In GoHighLevel, go to Settings > Integrations > Webhooks',
          'Add a new webhook with your CRM webhook URL',
          'Select the events you want to receive',
        ],
        inboundWebhook: {
          description: 'GoHighLevel can send events to your CRM webhook',
          events: ['contact.created', 'opportunity.created', 'task.created'],
        },
      },
    };

    return docs[type] || { error: 'Integration not found' };
  }
}
