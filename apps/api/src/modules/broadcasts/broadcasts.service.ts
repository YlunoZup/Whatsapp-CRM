import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueueService } from '../../common/queue/queue.service';
import { CreateBroadcastDto } from './broadcast.dto';

interface PaginationOptions {
  page?: number;
  limit?: number;
  status?: string;
}

@Injectable()
export class BroadcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async findAll(tenantId: string, options: PaginationOptions = {}) {
    const { status } = options;
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (status) {
      where.status = status;
    }

    const [broadcasts, total] = await Promise.all([
      this.prisma.broadcast.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { recipients: true },
          },
        },
      }),
      this.prisma.broadcast.count({ where }),
    ]);

    return {
      data: broadcasts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, tenantId },
      include: {
        recipients: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { recipients: true },
        },
      },
    });

    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }

    return broadcast;
  }

  async create(tenantId: string, dto: CreateBroadcastDto) {
    // Verify session exists and belongs to tenant
    const session = await this.prisma.whatsappSession.findFirst({
      where: { id: dto.sessionId, tenantId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Verify contacts exist and belong to tenant
    const contacts = await this.prisma.contact.findMany({
      where: {
        id: { in: dto.contactIds },
        tenantId,
      },
    });

    if (contacts.length === 0) {
      throw new BadRequestException('No valid contacts found');
    }

    // Create broadcast
    const broadcast = await this.prisma.broadcast.create({
      data: {
        tenantId,
        sessionId: dto.sessionId,
        name: dto.name,
        content: dto.content,
        type: dto.type,
        mediaUrl: dto.mediaUrl,
        totalCount: contacts.length,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: dto.scheduledAt ? 'scheduled' : 'pending',
      },
    });

    // Create recipients
    await this.prisma.broadcastRecipient.createMany({
      data: contacts.map((contact) => ({
        broadcastId: broadcast.id,
        contactId: contact.id,
        phone: contact.phone,
        status: 'pending',
      })),
    });

    // If not scheduled, start processing immediately
    if (!dto.scheduledAt) {
      await this.startBroadcast(broadcast.id, tenantId);
    }

    return broadcast;
  }

  async startBroadcast(id: string, tenantId: string) {
    // First verify the broadcast exists
    const broadcast = await this.findOne(id, tenantId);

    // Use atomic updateMany to prevent TOCTOU race condition
    // Only one request can successfully transition from pending/scheduled to processing
    const result = await this.prisma.broadcast.updateMany({
      where: {
        id,
        tenantId,
        status: { in: ['pending', 'scheduled'] }, // Only update if still startable
      },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('Broadcast cannot be started (already processing, completed, or cancelled)');
    }

    // Get all pending recipients
    const recipients = await this.prisma.broadcastRecipient.findMany({
      where: {
        broadcastId: id,
        status: 'pending',
      },
    });

    // Queue messages for each recipient with staggered delays to prevent WhatsApp ban
    // Human messaging patterns: 30-90 second delays between messages
    const MIN_DELAY_SECONDS = 30;
    const MAX_DELAY_SECONDS = 90;
    let cumulativeDelay = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      // Add random delay between MIN and MAX seconds for each recipient
      // First message has no delay, subsequent messages are staggered
      if (i > 0) {
        const randomDelay = MIN_DELAY_SECONDS + Math.floor(Math.random() * (MAX_DELAY_SECONDS - MIN_DELAY_SECONDS));
        cumulativeDelay += randomDelay * 1000; // Convert to milliseconds
      }

      await this.queueService.addMessageJob(
        {
          sessionId: broadcast.sessionId,
          to: recipient.phone,
          message: broadcast.content,
          type: broadcast.type as 'text' | 'image' | 'video' | 'document',
          mediaUrl: broadcast.mediaUrl || undefined,
          metadata: {
            broadcastId: broadcast.id,
            recipientId: recipient.id,
          },
        },
        cumulativeDelay,
      );
    }

    return { status: 'processing', totalRecipients: recipients.length };
  }

  async cancel(id: string, tenantId: string) {
    const broadcast = await this.findOne(id, tenantId);

    if (broadcast.status === 'completed' || broadcast.status === 'cancelled') {
      throw new BadRequestException('Broadcast cannot be cancelled');
    }

    await this.prisma.broadcast.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    return { success: true };
  }

  async updateRecipientStatus(
    recipientId: string,
    status: string,
    error?: string,
  ) {
    // Get the current recipient to check previous status (avoid double counting)
    const currentRecipient = await this.prisma.broadcastRecipient.findUnique({
      where: { id: recipientId },
      select: { status: true, broadcastId: true },
    });

    if (!currentRecipient) {
      throw new NotFoundException('Broadcast recipient not found');
    }

    const previousStatus = currentRecipient.status;

    // Update recipient status
    const recipient = await this.prisma.broadcastRecipient.update({
      where: { id: recipientId },
      data: {
        status,
        error,
        sentAt: status === 'sent' ? new Date() : undefined,
      },
    });

    // Update broadcast counts ONLY on first transition to terminal state
    // This prevents double-counting when status goes sent -> delivered -> read
    const isFirstSuccessTransition =
      previousStatus === 'pending' &&
      (status === 'sent' || status === 'delivered' || status === 'read');

    const isFirstFailTransition =
      previousStatus === 'pending' &&
      status === 'failed';

    if (isFirstSuccessTransition || isFirstFailTransition) {
      const updateData: Record<string, unknown> = {};

      if (isFirstSuccessTransition) {
        updateData.sentCount = { increment: 1 };
      } else if (isFirstFailTransition) {
        updateData.failedCount = { increment: 1 };
      }

      await this.prisma.broadcast.update({
        where: { id: recipient.broadcastId },
        data: updateData,
      });
    }

    // Check if broadcast is complete (use actual DB counts to handle race conditions)
    const [sentCount, failedCount, totalCount] = await Promise.all([
      this.prisma.broadcastRecipient.count({
        where: { broadcastId: recipient.broadcastId, status: { in: ['sent', 'delivered', 'read'] } },
      }),
      this.prisma.broadcastRecipient.count({
        where: { broadcastId: recipient.broadcastId, status: 'failed' },
      }),
      this.prisma.broadcastRecipient.count({
        where: { broadcastId: recipient.broadcastId },
      }),
    ]);

    if (sentCount + failedCount >= totalCount) {
      // Use updateMany with a condition to prevent race conditions
      await this.prisma.broadcast.updateMany({
        where: {
          id: recipient.broadcastId,
          status: 'processing', // Only update if still processing
        },
        data: {
          status: 'completed',
          completedAt: new Date(),
          // Update final counts from actual DB values
          sentCount,
          failedCount,
        },
      });
    }

    return recipient;
  }

  async delete(id: string, tenantId: string) {
    const broadcast = await this.findOne(id, tenantId);

    if (broadcast.status === 'processing') {
      throw new BadRequestException('Cannot delete a broadcast that is currently processing');
    }

    await this.prisma.broadcast.delete({
      where: { id },
    });

    return { success: true };
  }

  async getStats(tenantId: string) {
    const [total, completed, processing, scheduled] = await Promise.all([
      this.prisma.broadcast.count({ where: { tenantId } }),
      this.prisma.broadcast.count({ where: { tenantId, status: 'completed' } }),
      this.prisma.broadcast.count({ where: { tenantId, status: 'processing' } }),
      this.prisma.broadcast.count({ where: { tenantId, status: 'scheduled' } }),
    ]);

    const recentBroadcasts = await this.prisma.broadcast.findMany({
      where: { tenantId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        totalCount: true,
        sentCount: true,
        failedCount: true,
        createdAt: true,
      },
    });

    return {
      total,
      completed,
      processing,
      scheduled,
      recentBroadcasts,
    };
  }
}
