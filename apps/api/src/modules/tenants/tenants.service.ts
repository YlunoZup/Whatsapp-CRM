import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface UpdateTenantDto {
  name?: string;
  settings?: Record<string, unknown>;
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        settings: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id); // Verify tenant exists

    return this.prisma.tenant.update({
      where: { id },
      data: dto as any,
      select: {
        id: true,
        name: true,
        slug: true,
        settings: true,
        plan: true,
        updatedAt: true,
      },
    });
  }

  async getSettings(id: string) {
    const tenant = await this.findOne(id);
    return tenant.settings;
  }

  async updateSettings(id: string, settings: Record<string, unknown>) {
    await this.findOne(id); // Verify tenant exists

    return this.prisma.tenant.update({
      where: { id },
      data: { settings: settings as any },
      select: {
        id: true,
        settings: true,
        updatedAt: true,
      },
    });
  }
}
