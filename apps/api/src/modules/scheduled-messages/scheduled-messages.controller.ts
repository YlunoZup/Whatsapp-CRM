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
import { ScheduledMessagesService } from './scheduled-messages.service';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

interface CreateScheduledMessageDto {
  sessionId: string;
  conversationId?: string;
  contactPhone: string;
  type?: string;
  content: string;
  mediaUrl?: string;
  scheduledFor: string;
}

@Controller('scheduled-messages')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ScheduledMessagesController {
  constructor(private readonly scheduledMessagesService: ScheduledMessagesService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('sessionId') sessionId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.scheduledMessagesService.findAll(tenantId, {
      status,
      sessionId,
      page,
      limit,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.scheduledMessagesService.findOne(id, tenantId);
  }

  @Post()
  async create(
    @Body() dto: CreateScheduledMessageDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.scheduledMessagesService.create(tenantId, user.id, {
      ...dto,
      type: dto.type || 'text',
      scheduledFor: new Date(dto.scheduledFor),
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateScheduledMessageDto>,
    @CurrentTenant() tenantId: string,
  ) {
    return this.scheduledMessagesService.update(id, tenantId, {
      ...dto,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
    });
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.scheduledMessagesService.cancel(id, tenantId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.scheduledMessagesService.delete(id, tenantId);
  }
}
