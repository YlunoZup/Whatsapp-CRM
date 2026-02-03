import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConversationsService } from './conversations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all conversations' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'sessionId', required: false })
  @ApiQuery({ name: 'assignedTo', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('sessionId') sessionId?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.conversationsService.findAll(user.tenantId, {
      status,
      sessionId,
      assignedTo,
      search,
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.findOne(id, user.tenantId);
  }

  @Post('start')
  @ApiOperation({ summary: 'Start or find a conversation with a contact' })
  async startConversation(
    @Body() dto: { contactId: string; sessionId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const conversation = await this.conversationsService.findOrCreate(
      user.tenantId,
      dto.sessionId,
      dto.contactId,
    );
    return this.conversationsService.findOne(conversation.id, user.tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a conversation' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversationsService.update(id, user.tenantId, dto);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign conversation to a user' })
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversationsService.assign(id, user.tenantId, dto.userId, user.id);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close a conversation' })
  async close(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.close(id, user.tenantId, user.id);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reopen a conversation' })
  async reopen(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.reopen(id, user.tenantId, user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.conversationsService.findOne(id, user.tenantId); // Verify access
    return this.conversationsService.resetUnreadCount(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a conversation' })
  async partialUpdate(
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversationsService.update(id, user.tenantId, dto);
  }

  @Post('bulk-update')
  @ApiOperation({ summary: 'Bulk update multiple conversations' })
  async bulkUpdate(
    @Body() dto: {
      ids: string[];
      status?: string;
      priority?: string;
      label?: string | null;
      assignedTo?: string | null;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversationsService.bulkUpdate(
      user.tenantId,
      dto.ids,
      {
        status: dto.status,
        priority: dto.priority,
        label: dto.label,
        assignedTo: dto.assignedTo,
      },
      user.id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation and all its messages' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.conversationsService.delete(id, user.tenantId, user.id);
    return { success: true, message: 'Conversation deleted' };
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Bulk delete multiple conversations' })
  async bulkDelete(
    @Body() dto: { ids: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversationsService.bulkDelete(user.tenantId, dto.ids, user.id);
  }
}
