import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTagDto, UpdateTagDto } from './dto/create-tag.dto';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, createTagDto: CreateTagDto) {
    // Use transaction to prevent TOCTOU race condition
    return this.prisma.$transaction(async (tx) => {
      // Check if tag with same name exists for this tenant
      const existingTag = await tx.tag.findFirst({
        where: {
          tenantId,
          name: createTagDto.name,
        },
      });

      if (existingTag) {
        throw new ConflictException('Tag with this name already exists');
      }

      try {
        return await tx.tag.create({
          data: {
            ...createTagDto,
            color: createTagDto.color || '#6B7280', // Default gray color
            tenantId,
          },
        });
      } catch (error: any) {
        // Handle unique constraint violation (race condition)
        if (error.code === 'P2002') {
          throw new ConflictException('Tag with this name already exists');
        }
        throw error;
      }
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.tag.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  async update(tenantId: string, id: string, updateTagDto: UpdateTagDto) {
    // Use transaction to prevent TOCTOU race condition
    return this.prisma.$transaction(async (tx) => {
      // Verify tag exists and belongs to tenant
      const tag = await tx.tag.findFirst({
        where: { id, tenantId },
      });

      if (!tag) {
        throw new NotFoundException('Tag not found');
      }

      // Check for name conflict if name is being updated
      if (updateTagDto.name && updateTagDto.name !== tag.name) {
        const existingTag = await tx.tag.findFirst({
          where: {
            tenantId,
            name: updateTagDto.name,
            NOT: { id },
          },
        });

        if (existingTag) {
          throw new ConflictException('Tag with this name already exists');
        }
      }

      try {
        return await tx.tag.update({
          where: { id },
          data: updateTagDto,
        });
      } catch (error: any) {
        // Handle unique constraint violation (race condition)
        if (error.code === 'P2002') {
          throw new ConflictException('Tag with this name already exists');
        }
        throw error;
      }
    });
  }

  async remove(tenantId: string, id: string) {
    // Verify tag exists and belongs to tenant
    await this.findOne(tenantId, id);

    return this.prisma.tag.delete({
      where: { id },
    });
  }

  async assignToContact(tenantId: string, contactId: string, tagId: string) {
    // Verify contact exists and belongs to tenant
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Verify tag exists and belongs to tenant
    await this.findOne(tenantId, tagId);

    return this.prisma.contact.update({
      where: { id: contactId },
      data: {
        tags: {
          connect: { id: tagId },
        },
      } as any,
      include: {
        tags: true,
      },
    });
  }

  async removeFromContact(tenantId: string, contactId: string, tagId: string) {
    // Verify contact exists and belongs to tenant
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return this.prisma.contact.update({
      where: { id: contactId },
      data: {
        tags: {
          disconnect: { id: tagId },
        },
      } as any,
      include: {
        tags: true,
      },
    });
  }

  async getContactsByTag(tenantId: string, tagId: string, page = 1, limit = 20) {
    // Verify tag exists and belongs to tenant
    await this.findOne(tenantId, tagId);

    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where: {
          tenantId,
          tags: {
            some: { id: tagId },
          },
        } as any,
        include: {
          tags: true,
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.contact.count({
        where: {
          tenantId,
          tags: {
            some: { id: tagId },
          },
        } as any,
      }),
    ]);

    return {
      data: contacts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
