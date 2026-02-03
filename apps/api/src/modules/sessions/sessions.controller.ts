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
  BadRequestException,
} from '@nestjs/common';
import { isValid } from 'date-fns';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SessionsService } from './sessions.service';
import { SessionLogsService, LogLevel } from './session-logs.service';
import { SessionHealthService } from './session-health.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { parseISO } from 'date-fns';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@ApiTags('Sessions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly sessionLogsService: SessionLogsService,
    private readonly sessionHealthService: SessionHealthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all WhatsApp sessions' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a session by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findOne(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new WhatsApp session' })
  async create(@Body() dto: CreateSessionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.create(user.tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a session' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a session' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.delete(id, user.tenantId);
  }

  @Post(':id/connect')
  @ApiOperation({ summary: 'Connect/start a WhatsApp session' })
  async connect(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.connect(id, user.tenantId);
  }

  @Post(':id/disconnect')
  @ApiOperation({ summary: 'Disconnect a WhatsApp session' })
  async disconnect(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.disconnect(id, user.tenantId);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Get QR code for session' })
  async getQrCode(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.getQrCode(id, user.tenantId);
  }

  // ============================================
  // SESSION HEALTH ENDPOINT
  // ============================================

  @Get(':id/health')
  @ApiOperation({ summary: 'Get session health metrics and score' })
  async getHealth(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionHealthService.getSessionHealth(id, user.tenantId);
  }

  // ============================================
  // SESSION LOGS ENDPOINTS
  // ============================================

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get logs for a session' })
  @ApiQuery({ name: 'level', required: false, enum: ['debug', 'info', 'warning', 'error'] })
  @ApiQuery({ name: 'event', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLogs(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('level') level?: LogLevel,
    @Query('event') event?: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    // Verify session belongs to tenant
    await this.sessionsService.findOne(id, user.tenantId);

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateStr) {
      startDate = parseISO(startDateStr);
      if (!isValid(startDate)) {
        throw new BadRequestException('startDate must be a valid ISO date');
      }
    }

    if (endDateStr) {
      endDate = parseISO(endDateStr);
      if (!isValid(endDate)) {
        throw new BadRequestException('endDate must be a valid ISO date');
      }
    }

    // Validate pagination
    const validPage = Math.max(1, page ? Number(page) : 1);
    const validLimit = Math.min(100, Math.max(1, limit ? Number(limit) : 50));

    return this.sessionLogsService.getLogs(id, {
      level,
      event,
      startDate,
      endDate,
      page: validPage,
      limit: validLimit,
    });
  }

  @Get(':id/logs/stats')
  @ApiOperation({ summary: 'Get log statistics for a session' })
  async getLogStats(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    // Verify session belongs to tenant
    await this.sessionsService.findOne(id, user.tenantId);
    return this.sessionLogsService.getStats(id);
  }

  @Get(':id/logs/events')
  @ApiOperation({ summary: 'Get available event types for filtering' })
  async getLogEventTypes(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    // Verify session belongs to tenant
    await this.sessionsService.findOne(id, user.tenantId);
    return this.sessionLogsService.getEventTypes(id);
  }

  @Delete(':id/logs')
  @ApiOperation({ summary: 'Clear old logs (keeps last 30 days by default)' })
  async clearLogs(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('daysToKeep') daysToKeep?: number,
  ) {
    // Verify session belongs to tenant
    await this.sessionsService.findOne(id, user.tenantId);

    // Validate daysToKeep
    let validDaysToKeep = 30;
    if (daysToKeep !== undefined) {
      validDaysToKeep = Number(daysToKeep);
      if (isNaN(validDaysToKeep) || validDaysToKeep < 0 || validDaysToKeep > 365) {
        throw new BadRequestException('daysToKeep must be a number between 0 and 365');
      }
    }

    const deletedCount = await this.sessionLogsService.clearOldLogs(id, validDaysToKeep);
    return { deletedCount };
  }
}
