import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_OPTIONS',
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('redis.host'),
        port: configService.get<number>('redis.port'),
        password: configService.get<string>('redis.password'),
        tls: configService.get<boolean>('redis.tls'),
      }),
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
