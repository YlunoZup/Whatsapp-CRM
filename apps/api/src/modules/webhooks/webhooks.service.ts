import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueueService } from '../../common/queue/queue.service';

interface CreateEndpointDto {
  name: string;
  url: string;
  events: string[];
  secret?: string;
}

interface UpdateEndpointDto {
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  isActive?: boolean;
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  // Outgoing webhook endpoint management
  async findAllEndpoints(tenantId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        lastTriggeredAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneEndpoint(id: string, tenantId: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
    });

    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    return endpoint;
  }

  async verifyWebhookLogOwnership(logId: string, tenantId: string): Promise<void> {
    const log = await this.prisma.webhookLog.findFirst({
      where: { id: logId },
      include: {
        endpoint: {
          select: { tenantId: true },
        },
      },
    });

    if (!log) {
      throw new NotFoundException('Webhook log not found');
    }

    if (log.endpoint?.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied to this webhook log');
    }
  }

  async createEndpoint(tenantId: string, dto: CreateEndpointDto) {
    const secret = dto.secret || crypto.randomBytes(32).toString('hex');

    return this.prisma.webhookEndpoint.create({
      data: {
        tenantId,
        name: dto.name,
        url: dto.url,
        events: dto.events,
        secret,
        isActive: true,
      },
    });
  }

  async updateEndpoint(id: string, tenantId: string, dto: UpdateEndpointDto) {
    await this.findOneEndpoint(id, tenantId);

    return this.prisma.webhookEndpoint.update({
      where: { id },
      data: dto,
    });
  }

  async deleteEndpoint(id: string, tenantId: string) {
    await this.findOneEndpoint(id, tenantId);

    await this.prisma.webhookEndpoint.delete({
      where: { id },
    });

    return { success: true };
  }

  async getEndpointLogs(id: string, tenantId: string, page = 1, limit = 50) {
    await this.findOneEndpoint(id, tenantId);

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.webhookLog.findMany({
        where: { endpointId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.webhookLog.count({ where: { endpointId: id } }),
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

  // Trigger webhooks for an event
  async triggerWebhooks(tenantId: string, event: string, payload: Record<string, unknown>) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        isActive: true,
        events: { has: event },
      },
    });

    for (const endpoint of endpoints) {
      await this.queueService.addWebhookJob({
        endpointId: endpoint.id,
        url: endpoint.url,
        event,
        payload,
        secret: endpoint.secret || undefined,
      });
    }

    return { triggered: endpoints.length };
  }

  // Deliver a webhook (called by worker)
  async deliverWebhook(
    endpointId: string,
    url: string,
    event: string,
    payload: Record<string, unknown>,
    secret?: string,
  ) {
    const timestamp = Date.now().toString();
    const body = JSON.stringify(payload);

    // Create signature
    const signature = secret
      ? crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
      : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      'X-Webhook-Timestamp': timestamp,
    };

    if (signature) {
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    let responseStatus: number;
    let responseBody: string;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      responseStatus = response.status;
      responseBody = await response.text();
    } catch (error) {
      responseStatus = 0;
      responseBody = error instanceof Error ? error.message : 'Unknown error';
    }

    // Log the delivery
    await this.prisma.webhookLog.create({
      data: {
        endpointId,
        event,
        payload: payload as any,
        responseStatus,
        responseBody: responseBody.substring(0, 1000), // Limit stored response
        attempts: 1,
      },
    });

    // Update last triggered
    await this.prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { lastTriggeredAt: new Date() },
    });

    return { success: responseStatus >= 200 && responseStatus < 300 };
  }

  // Generate signature for verification
  generateSignature(payload: string, secret: string, timestamp: string): string {
    return crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  }

  // Verify incoming webhook signature
  verifySignature(payload: string, signature: string, secret: string, timestamp: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret, timestamp);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expectedSignature}`),
    );
  }
}
