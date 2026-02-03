import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto, TemplateCategory } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, createTemplateDto: CreateTemplateDto) {
    // Check if template with same name exists for this tenant
    const existingTemplate = await this.prisma.messageTemplate.findFirst({
      where: {
        tenantId,
        name: createTemplateDto.name,
      },
    });

    if (existingTemplate) {
      throw new ConflictException('Template with this name already exists');
    }

    // Extract variables from content if not provided
    const variables = createTemplateDto.variables || this.extractVariables(createTemplateDto.content);

    return this.prisma.messageTemplate.create({
      data: {
        name: createTemplateDto.name,
        content: createTemplateDto.content,
        variables,
        category: createTemplateDto.category || TemplateCategory.OTHER,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, category?: TemplateCategory) {
    const where: any = { tenantId };
    if (category) {
      where.category = category;
    }

    return this.prisma.messageTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async update(tenantId: string, id: string, updateTemplateDto: UpdateTemplateDto) {
    // Verify template exists and belongs to tenant
    await this.findOne(tenantId, id);

    // Check for name conflict if name is being updated
    if (updateTemplateDto.name) {
      const existingTemplate = await this.prisma.messageTemplate.findFirst({
        where: {
          tenantId,
          name: updateTemplateDto.name,
          NOT: { id },
        },
      });

      if (existingTemplate) {
        throw new ConflictException('Template with this name already exists');
      }
    }

    // Extract variables from new content if content is updated but variables not provided
    let variables = updateTemplateDto.variables;
    if (updateTemplateDto.content && !variables) {
      variables = this.extractVariables(updateTemplateDto.content);
    }

    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        ...updateTemplateDto,
        variables,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    // Verify template exists and belongs to tenant
    await this.findOne(tenantId, id);

    return this.prisma.messageTemplate.delete({
      where: { id },
    });
  }

  async render(tenantId: string, templateId: string, variables: Record<string, string>): Promise<string> {
    const template = await this.findOne(tenantId, templateId);

    // Check if all required variables are provided
    const missingVariables = template.variables.filter(
      (v) => !(v in variables),
    );

    if (missingVariables.length > 0) {
      throw new BadRequestException(
        `Missing required variables: ${missingVariables.join(', ')}`,
      );
    }

    // Replace variables in content
    let content = template.content;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return content;
  }

  async duplicate(tenantId: string, id: string, newName?: string) {
    const original = await this.findOne(tenantId, id);
    const name = newName || `${original.name} (Copy)`;

    // Check if name already exists
    const existingTemplate = await this.prisma.messageTemplate.findFirst({
      where: { tenantId, name },
    });

    if (existingTemplate) {
      throw new ConflictException('Template with this name already exists');
    }

    return this.prisma.messageTemplate.create({
      data: {
        name,
        content: original.content,
        variables: original.variables,
        category: original.category,
        tenantId,
      },
    });
  }

  async getByCategory(tenantId: string) {
    const templates = await this.prisma.messageTemplate.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    // Group by category
    const grouped: Record<string, typeof templates> = {};
    for (const template of templates) {
      const category = template.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(template);
    }

    return grouped;
  }

  private extractVariables(content: string): string[] {
    const regex = /{{(\w+)}}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }
}
