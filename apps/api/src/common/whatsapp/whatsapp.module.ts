import { Module, Global } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { MessageBufferService } from './message-buffer.service';
import { LidMappingService } from './lid-mapping.service';
import { ContentHashService } from './content-hash.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Global()
@Module({
  providers: [
    PrismaService,
    RedisService,
    WhatsAppService,
    MessageBufferService,
    LidMappingService,
    ContentHashService,
  ],
  exports: [
    WhatsAppService,
    MessageBufferService,
    LidMappingService,
    ContentHashService,
  ],
})
export class WhatsAppModule {}
