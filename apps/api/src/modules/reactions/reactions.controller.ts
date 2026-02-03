import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReactionsService } from './reactions.service';

interface AddReactionDto {
  emoji: string;
}

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

@Controller('messages/:messageId/reactions')
@UseGuards(JwtAuthGuard)
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Get()
  async getReactions(
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reactionsService.getReactions(messageId, user.tenantId);
  }

  @Post()
  async addReaction(
    @Param('messageId') messageId: string,
    @Body() dto: AddReactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reactionsService.addReaction(messageId, user.id, user.tenantId, dto.emoji);
  }

  @Delete(':emoji')
  async removeReaction(
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reactionsService.removeReaction(messageId, user.id, user.tenantId, decodeURIComponent(emoji));
  }

  @Get('allowed')
  getAllowedEmojis() {
    return this.reactionsService.getAllowedEmojis();
  }
}
