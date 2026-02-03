import { Module, Global } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { MessageBufferService } from './message-buffer.service';
import { LidMappingService } from './lid-mapping.service';
import { ContentHashService } from './content-hash.service';

@Global()
@Module({
  providers: [
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
