import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';

@Global()
@Module({
  providers: [
    {
      provide: 'QUEUE_OPTIONS',
      useFactory: (configService: ConfigService) => {
        const useTls = configService.get<boolean>('redis.tls');
        return {
          connection: {
            host: configService.get<string>('redis.host'),
            port: configService.get<number>('redis.port'),
            password: configService.get<string>('redis.password'),
            tls: useTls ? {} : undefined,
          },
        };
      },
      inject: [ConfigService],
    },
    QueueService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
