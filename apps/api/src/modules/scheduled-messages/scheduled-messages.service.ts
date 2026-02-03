import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface CreateScheduledMessageDto {
  sessionId: string;
  conversationId?: string;
  contactPhone: string;
  type: string;
  content: string;
  mediaUrl?: string;
  scheduledFor: Date;
}

interface FindAllOptions {
  status?: string;
  sessionId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ScheduledMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, options: FindAllOptions = {}) {
    const { status, sessionId } = options;
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (status) where.status = status;
    if (sessionId) where.sessionId = sessionId;

    const [messages, total] = await Promise.all([
      this.prisma.scheduledMessage.findMany({
        where,
        orderBy: { scheduledFor: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.scheduledMessage.count({ where }),
    ]);

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const message = await this.prisma.scheduledMessage.findFirst({
      where: { id, tenantId },
    });

    if (!message) {
      throw new NotFoundException('Scheduled message not found');
    }

    return message;
  }

  async create(tenantId: string, userId: string, dto: CreateScheduledMessageDto) {
    return this.prisma.scheduledMessage.create({
      data: {
        tenantId,
        sessionId: dto.sessionId,
        conversationId: dto.conversationId,
        contactPhone: dto.contactPhone,
        type: dto.type,
        content: dto.content,
        mediaUrl: dto.mediaUrl,
        scheduledFor: dto.scheduledFor,
        createdBy: userId,
        status: 'pending',
      },
    });
  }

  async update(
    id: string,
    tenantId: string,
    dto: Partial<CreateScheduledMessageDto>,
  ) {
    // First verify the message exists
    await this.findOne(id, tenantId);

    // Use atomic updateMany with status condition to prevent TOCTOU race
    const result = await this.prisma.scheduledMessage.updateMany({
      where: {
        id,
        tenantId,
        status: 'pending', // Only update if still pending
      },
      data: dto,
    });

    if (result.count === 0) {
      throw new Error('Can only update pending scheduled messages');
    }

    return this.findOne(id, tenantId);
  }

  async cancel(id: string, tenantId: string) {
    // First verify the message exists
    await this.findOne(id, tenantId);

    // Use atomic updateMany with status condition to prevent TOCTOU race
    const result = await this.prisma.scheduledMessage.updateMany({
      where: {
        id,
        tenantId,
        status: 'pending', // Only cancel if still pending
      },
      data: { status: 'cancelled' },
    });

    if (result.count === 0) {
      throw new Error('Can only cancel pending scheduled messages');
    }

    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.scheduledMessage.delete({
      where: { id },
    });

    return { success: true };
  }

  // Called by the scheduler job to get messages ready to send
  async getReadyToSend() {
    return this.prisma.scheduledMessage.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: new Date() },
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async markAsSent(id: string) {
    return this.prisma.scheduledMessage.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });
  }

  async markAsFailed(id: string, error: string) {
    return this.prisma.scheduledMessage.update({
      where: { id },
      data: {
        status: 'failed',
        error,
      },
    });
  }
}
