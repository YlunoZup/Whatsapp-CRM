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
import { BroadcastsService } from './broadcasts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateBroadcastDto } from './broadcast.dto';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('Broadcasts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('broadcasts')
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all broadcasts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.broadcastsService.findAll(user.tenantId, {
      page,
      limit,
      status,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get broadcast statistics' })
  async getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.broadcastsService.getStats(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a broadcast by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.broadcastsService.findOne(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new broadcast' })
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 broadcasts per minute
  async create(@Body() dto: CreateBroadcastDto, @CurrentUser() user: AuthenticatedUser) {
    return this.broadcastsService.create(user.tenantId, dto);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a scheduled broadcast' })
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 broadcast starts per minute (resource intensive)
  async start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.broadcastsService.startBroadcast(id, user.tenantId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a broadcast' })
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.broadcastsService.cancel(id, user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a broadcast' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.broadcastsService.delete(id, user.tenantId);
  }
}
