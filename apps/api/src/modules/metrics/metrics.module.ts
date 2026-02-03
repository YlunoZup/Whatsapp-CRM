import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
