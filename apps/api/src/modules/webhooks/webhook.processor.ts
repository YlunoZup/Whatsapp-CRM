import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueueService, WebhookJobData } from '../../common/queue/queue.service';

interface DeliveryResult {
  success: boolean;
  statusCode: number;
  responseBody?: string;
  error?: string;
}

@Injectable()
export class WebhookProcessor implements OnModuleInit {
  private readonly logger = new Logger(WebhookProcessor.name);
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAYS = [1000, 5000, 30000, 120000, 600000]; // 1s, 5s, 30s, 2m, 10m

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit() {
    this.registerWorker();
  }

  private registerWorker() {
    this.queueService.registerWorker<WebhookJobData>(
      'webhook-delivery',
      async (job: Job<WebhookJobData>) => {
        await this.processDelivery(job);
      },
      { concurrency: 5 },
    );

    this.logger.log('Webhook processor initialized');
  }

  private async processDelivery(job: Job<WebhookJobData>) {
    const { endpointId, url, event, payload, secret } = job.data;
    const attemptNumber = job.attemptsMade + 1;

    this.logger.log(
      `Processing webhook delivery - endpoint: ${endpointId}, event: ${event}, attempt: ${attemptNumber}`,
    );

    try {
      const result = await this.deliver(url, event, payload, secret);

      // Log the delivery attempt
      await this.logDelivery(endpointId, event, payload, result, attemptNumber);

      // Update endpoint last triggered
      await this.prisma.webhookEndpoint.update({
        where: { id: endpointId },
        data: { lastTriggeredAt: new Date() },
      });

      if (!result.success) {
        // If delivery failed and we haven't exceeded max retries, throw to trigger retry
        if (attemptNumber < this.MAX_RETRIES) {
          throw new Error(`Webhook delivery failed with status ${result.statusCode}: ${result.error || result.responseBody}`);
        }

        this.logger.warn(
          `Webhook delivery permanently failed after ${attemptNumber} attempts - endpoint: ${endpointId}`,
        );
      } else {
        this.logger.log(`Webhook delivered successfully - endpoint: ${endpointId}, event: ${event}`);
      }
    } catch (error) {
      this.logger.error(
        `Webhook delivery error - endpoint: ${endpointId}, attempt: ${attemptNumber}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private async deliver(
    url: string,
    event: string,
    payload: Record<string, unknown>,
    secret?: string,
  ): Promise<DeliveryResult> {
    const timestamp = Date.now().toString();
    const body = JSON.stringify(payload);

    // Create signature if secret is provided
    const signature = secret
      ? crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
      : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'WhatsApp-CRM-Webhook/1.0',
      'X-Webhook-Event': event,
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Delivery': crypto.randomUUID(),
    };

    if (signature) {
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      const responseBody = await response.text();
      const success = response.status >= 200 && response.status < 300;

      return {
        success,
        statusCode: response.status,
        responseBody: responseBody.substring(0, 1000), // Limit stored response
      };
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout (30s)';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        statusCode: 0,
        error: errorMessage,
      };
    } finally {
      clearTimeout(timeout); // Always cleanup the timeout
    }
  }

  private async logDelivery(
    endpointId: string,
    event: string,
    payload: Record<string, unknown>,
    result: DeliveryResult,
    attempt: number,
  ): Promise<void> {
    try {
      // Check if there's an existing log for this delivery (for retries)
      const existingLog = await this.prisma.webhookLog.findFirst({
        where: {
          endpointId,
          event,
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Within last hour
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingLog && attempt > 1) {
        // Update existing log with retry info
        await this.prisma.webhookLog.update({
          where: { id: existingLog.id },
          data: {
            responseStatus: result.statusCode,
            responseBody: result.error || result.responseBody,
            attempts: attempt,
          },
        });
      } else {
        // Create new log
        await this.prisma.webhookLog.create({
          data: {
            endpointId,
            event,
            payload: payload as any,
            responseStatus: result.statusCode,
            responseBody: result.error || result.responseBody,
            attempts: attempt,
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to log webhook delivery', error);
    }
  }

  // Manual retry method for failed webhooks
  async retryFailedWebhook(logId: string): Promise<void> {
    const log = await this.prisma.webhookLog.findUnique({
      where: { id: logId },
      include: { endpoint: true },
    });

    if (!log || !log.endpoint) {
      throw new Error('Webhook log not found');
    }

    await this.queueService.addWebhookJob({
      endpointId: log.endpointId,
      url: log.endpoint.url,
      event: log.event,
      payload: log.payload as Record<string, unknown>,
      secret: log.endpoint.secret || undefined,
    });
  }
}
