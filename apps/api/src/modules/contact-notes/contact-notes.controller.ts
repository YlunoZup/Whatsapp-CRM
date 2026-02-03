import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ContactNotesService } from './contact-notes.service';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

interface CreateNoteDto {
  contactId: string;
  content: string;
  isPinned?: boolean;
}

interface UpdateNoteDto {
  content?: string;
  isPinned?: boolean;
}

@Controller('contact-notes')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContactNotesController {
  constructor(private readonly contactNotesService: ContactNotesService) {}

  @Get()
  async findAllForContact(
    @CurrentTenant() tenantId: string,
    @Query('contactId') contactId: string,
  ) {
    return this.contactNotesService.findAllForContact(tenantId, contactId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.contactNotesService.findOne(id, tenantId);
  }

  @Post()
  async create(
    @Body() dto: CreateNoteDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactNotesService.create(tenantId, user.id, dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.contactNotesService.update(id, tenantId, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.contactNotesService.delete(id, tenantId);
  }

  @Post(':id/toggle-pin')
  async togglePin(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.contactNotesService.togglePin(id, tenantId);
  }

  @Get('activity/:contactId')
  async getActivityLog(
    @Param('contactId') contactId: string,
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    return this.contactNotesService.getActivityLog(tenantId, contactId, limit);
  }
}
