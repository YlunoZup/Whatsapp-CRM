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
import { TagsService } from './tags.service';
import { CreateTagDto, UpdateTagDto, AssignTagDto } from './dto/create-tag.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('Tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tag' })
  create(@TenantId() tenantId: string, @Body() createTagDto: CreateTagDto) {
    return this.tagsService.create(tenantId, createTagDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tags' })
  findAll(@TenantId() tenantId: string) {
    return this.tagsService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tag by ID' })
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.tagsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tag' })
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
  ) {
    return this.tagsService.update(tenantId, id, updateTagDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tag' })
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.tagsService.remove(tenantId, id);
  }

  @Post('assign')
  @ApiOperation({ summary: 'Assign a tag to a contact' })
  assignToContact(@TenantId() tenantId: string, @Body() assignTagDto: AssignTagDto) {
    return this.tagsService.assignToContact(
      tenantId,
      assignTagDto.contactId,
      assignTagDto.tagId,
    );
  }

  @Delete('contact/:contactId/tag/:tagId')
  @ApiOperation({ summary: 'Remove a tag from a contact' })
  removeFromContact(
    @TenantId() tenantId: string,
    @Param('contactId') contactId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tagsService.removeFromContact(tenantId, contactId, tagId);
  }

  @Get(':id/contacts')
  @ApiOperation({ summary: 'Get all contacts with a specific tag' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getContactsByTag(
    @TenantId() tenantId: string,
    @Param('id') tagId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tagsService.getContactsByTag(
      tenantId,
      tagId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
