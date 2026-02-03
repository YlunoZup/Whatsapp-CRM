import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { Roles } from '../../common/guards/roles.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services?: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
}

interface ServiceStatus {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  async check(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('detailed')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Detailed health check with service status (admin only)' })
  async detailedCheck(): Promise<HealthStatus> {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const isHealthy = dbStatus.status === 'up' && redisStatus.status === 'up';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check for k8s' })
  async readyCheck(): Promise<{ ready: boolean }> {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const isReady = dbStatus.status === 'up' && redisStatus.status === 'up';

    if (!isReady) {
      throw new Error('Service not ready');
    }

    return { ready: true };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check for k8s' })
  async liveCheck(): Promise<{ alive: boolean }> {
    return { alive: true };
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    const start = Date.now();

    try {
      const client = this.redis.getClient();
      await client.ping();
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
