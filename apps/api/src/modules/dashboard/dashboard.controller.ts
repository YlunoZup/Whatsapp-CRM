import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

// Helper to safely parse and validate numbers with bounds
function parseQueryInt(value: string | undefined, defaultValue: number, min = 1, max = 100): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getStats(@TenantId() tenantId: string) {
    return this.dashboardService.getStats(tenantId);
  }

  @Get('conversation-trends')
  @ApiOperation({ summary: 'Get conversation trends over time' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getConversationTrends(
    @TenantId() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.dashboardService.getConversationTrends(
      tenantId,
      parseQueryInt(days, 7, 1, 365), // Max 365 days
    );
  }

  @Get('message-trends')
  @ApiOperation({ summary: 'Get message trends over time' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getMessageTrends(
    @TenantId() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.dashboardService.getMessageTrends(
      tenantId,
      parseQueryInt(days, 7, 1, 365), // Max 365 days
    );
  }

  @Get('top-contacts')
  @ApiOperation({ summary: 'Get top contacts by conversation count' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopContacts(
    @TenantId() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getTopContacts(
      tenantId,
      parseQueryInt(limit, 5, 1, 50), // Max 50 contacts
    );
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Get recent message activity' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecentActivity(
    @TenantId() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getRecentActivity(
      tenantId,
      parseQueryInt(limit, 10, 1, 100), // Max 100 activities
    );
  }
}
