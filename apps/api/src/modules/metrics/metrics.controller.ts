import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MetricsService } from './metrics.service';
import { Roles, ROLES_KEY } from '../../common/guards/roles.guard';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Roles('admin')
  @ApiOperation({ summary: 'Get system metrics (Prometheus format) - admin only' })
  async getMetrics(): Promise<string> {
    return this.metricsService.getPrometheusMetrics();
  }

  @Get('json')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Roles('admin')
  @ApiOperation({ summary: 'Get detailed system metrics (JSON)' })
  async getJsonMetrics() {
    return this.metricsService.getDetailedMetrics();
  }

  @Get('runtime')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Roles('admin')
  @ApiOperation({ summary: 'Get runtime metrics' })
  async getRuntimeMetrics() {
    return this.metricsService.getRuntimeMetrics();
  }
}
