import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { MessagesService } from './messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateMessageDto } from './dto/create-message.dto';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'direction', required: false, enum: ['before', 'after'] })
  async findByConversation(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('direction') direction?: 'before' | 'after',
  ) {
    return this.messagesService.findByConversation(conversationId, user.tenantId, {
      cursor,
      limit,
      direction,
    });
  }

  @Post('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Create a message in a conversation' })
  async create(
    @Param('conversationId') conversationId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Verify user has access to conversation (throws if not found or wrong tenant)
    await this.conversationsService.findOne(conversationId, user.tenantId);

    return this.messagesService.create({
      ...dto,
      tenantId: user.tenantId,
      conversationId,
    });
  }

  @Post('messages/send')
  @ApiOperation({ summary: 'Send a direct message via WhatsApp' })
  @Throttle({ default: { ttl: 60000, limit: 30 } }) // 30 messages per minute per user
  async send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.messagesService.send(user.tenantId, dto);
  }

  @Post('messages/:messageId/forward')
  @ApiOperation({ summary: 'Forward a message to other conversations or contacts' })
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 forwards per minute (resource intensive)
  async forward(
    @Param('messageId') messageId: string,
    @Body() dto: { targetIds: string[]; targetType: 'conversation' | 'contact' },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.forwardMessage(
      messageId,
      user.tenantId,
      dto.targetIds,
      dto.targetType,
    );
  }

  @Post('messages/:messageId/star')
  @ApiOperation({ summary: 'Star a message' })
  async starMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.toggleStar(messageId, user.tenantId, true);
  }

  @Delete('messages/:messageId/star')
  @ApiOperation({ summary: 'Unstar a message' })
  async unstarMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.toggleStar(messageId, user.tenantId, false);
  }

  @Get('messages/starred')
  @ApiOperation({ summary: 'Get all starred messages' })
  @ApiQuery({ name: 'conversationId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getStarredMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Query('conversationId') conversationId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.messagesService.getStarredMessages(user.tenantId, {
      conversationId,
      limit,
    });
  }
}
