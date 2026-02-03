import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface CreateNoteDto {
  contactId: string;
  content: string;
  isPinned?: boolean;
}

interface UpdateNoteDto {
  content?: string;
  isPinned?: boolean;
}

@Injectable()
export class ContactNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForContact(tenantId: string, contactId: string) {
    return this.prisma.contactNote.findMany({
      where: { tenantId, contactId },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string, tenantId: string) {
    const note = await this.prisma.contactNote.findFirst({
      where: { id, tenantId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return note;
  }

  async create(tenantId: string, userId: string, dto: CreateNoteDto) {
    // Also log activity
    await this.logActivity(tenantId, dto.contactId, userId, 'note_added', {
      noteContent: dto.content.substring(0, 100),
    });

    return this.prisma.contactNote.create({
      data: {
        tenantId,
        contactId: dto.contactId,
        userId,
        content: dto.content,
        isPinned: dto.isPinned ?? false,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateNoteDto) {
    await this.findOne(id, tenantId);

    return this.prisma.contactNote.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.contactNote.delete({
      where: { id },
    });

    return { success: true };
  }

  async togglePin(id: string, tenantId: string) {
    const note = await this.findOne(id, tenantId);

    return this.prisma.contactNote.update({
      where: { id },
      data: { isPinned: !note.isPinned },
    });
  }

  // Activity logging
  async logActivity(
    tenantId: string,
    contactId: string,
    userId: string | null,
    type: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.prisma.contactActivity.create({
      data: {
        tenantId,
        contactId,
        userId,
        type,
        metadata: metadata as any,
      },
    });
  }

  async getActivityLog(tenantId: string, contactId: string, limit = 50) {
    return this.prisma.contactActivity.findMany({
      where: { tenantId, contactId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
