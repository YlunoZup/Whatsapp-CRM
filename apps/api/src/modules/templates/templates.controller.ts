import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto, RenderTemplateDto, TemplateCategory } from './dto/create-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Message Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new message template' })
  create(@TenantId() tenantId: string, @Body() createTemplateDto: CreateTemplateDto) {
    return this.templatesService.create(tenantId, createTemplateDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all templates' })
  @ApiQuery({ name: 'category', required: false, enum: TemplateCategory })
  findAll(
    @TenantId() tenantId: string,
    @Query('category') category?: TemplateCategory,
  ) {
    return this.templatesService.findAll(tenantId, category);
  }

  @Get('grouped')
  @ApiOperation({ summary: 'Get all templates grouped by category' })
  getByCategory(@TenantId() tenantId: string) {
    return this.templatesService.getByCategory(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a template by ID' })
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.templatesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a template' })
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(tenantId, id, updateTemplateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a template' })
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.templatesService.remove(tenantId, id);
  }

  @Post('render')
  @ApiOperation({ summary: 'Render a template with variables' })
  render(@TenantId() tenantId: string, @Body() renderTemplateDto: RenderTemplateDto) {
    return this.templatesService.render(
      tenantId,
      renderTemplateDto.templateId,
      renderTemplateDto.variables,
    );
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a template' })
  @ApiQuery({ name: 'name', required: false })
  duplicate(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('name') name?: string,
  ) {
    return this.templatesService.duplicate(tenantId, id, name);
  }
}
