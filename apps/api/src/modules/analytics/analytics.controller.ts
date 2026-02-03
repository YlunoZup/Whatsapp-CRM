import { Controller, Get, Query, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { AnalyticsService } from './analytics.service';
import { parseISO, startOfDay, endOfDay, isValid, subDays } from 'date-fns';

function parseAndValidateDate(dateStr: string | undefined, fieldName: string): Date {
  if (!dateStr) {
    throw new BadRequestException(`${fieldName} is required`);
  }

  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date (e.g., 2024-01-01)`);
    }
    return date;
  } catch {
    throw new BadRequestException(`${fieldName} must be a valid ISO date (e.g., 2024-01-01)`);
  }
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getAnalytics(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
  ) {
    const startDate = startOfDay(parseAndValidateDate(startDateStr, 'startDate'));
    const endDate = endOfDay(parseAndValidateDate(endDateStr, 'endDate'));

    // Validate date range (max 1 year)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 365 days in ms
    if (endDate.getTime() - startDate.getTime() > maxRange) {
      throw new BadRequestException('Date range cannot exceed 1 year');
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    return this.analyticsService.getAnalytics(tenantId, startDate, endDate);
  }

  @Get('export')
  async exportAnalytics(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
    @Res() res: Response,
  ) {
    const startDate = startOfDay(parseAndValidateDate(startDateStr, 'startDate'));
    const endDate = endOfDay(parseAndValidateDate(endDateStr, 'endDate'));

    // Validate date range (max 1 year)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 365 days in ms
    if (endDate.getTime() - startDate.getTime() > maxRange) {
      throw new BadRequestException('Date range cannot exceed 1 year');
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const csv = await this.analyticsService.exportAnalytics(tenantId, startDate, endDate);

    // Sanitize filename
    const safeStartDate = startDateStr.replace(/[^a-zA-Z0-9-]/g, '');
    const safeEndDate = endDateStr.replace(/[^a-zA-Z0-9-]/g, '');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics-${safeStartDate}-${safeEndDate}.csv"`,
    );
    res.send(csv);
  }
}
