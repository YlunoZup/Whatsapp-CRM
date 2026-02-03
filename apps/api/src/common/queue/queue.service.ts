import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';

interface QueueOptions {
  connection: ConnectionOptions;
}

export interface MessageJobData {
  sessionId: string;
  to: string;
  message: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookJobData {
  endpointId: string;
  url: string;
  event: string;
  payload: Record<string, unknown>;
  secret?: string;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();

  constructor(@Inject('QUEUE_OPTIONS') private readonly options: QueueOptions) {}

  async onModuleDestroy() {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    for (const worker of this.workers.values()) {
      await worker.close();
    }
  }

  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.options.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 24 * 3600, // 24 hours
            count: 1000,
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // 7 days
          },
        },
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name)!;
  }

  async addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: {
      delay?: number;
      priority?: number;
      attempts?: number;
    },
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, {
      delay: options?.delay,
      priority: options?.priority,
      attempts: options?.attempts,
    });
  }

  registerWorker<T>(
    queueName: string,
    processor: (job: Job<T>) => Promise<void>,
    options?: {
      concurrency?: number;
    },
  ): Worker<T> {
    const worker = new Worker<T>(queueName, processor, {
      connection: this.options.connection,
      concurrency: options?.concurrency || 1,
    });

    worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} in queue ${queueName} completed`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} in queue ${queueName} failed: ${err.message}`);
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  // Convenience methods for specific queues
  async addMessageJob(data: MessageJobData, delay?: number): Promise<Job<MessageJobData>> {
    return this.addJob('whatsapp-outbound', 'send-message', data, { delay });
  }

  async addWebhookJob(data: WebhookJobData): Promise<Job<WebhookJobData>> {
    return this.addJob('webhook-delivery', 'deliver', data);
  }
}
