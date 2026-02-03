import { Module } from '@nestjs/common';
import { ScheduledMessagesController } from './scheduled-messages.controller';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { ScheduledMessagesProcessor } from './scheduled-messages.processor';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { QueueModule } from '../../common/queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [ScheduledMessagesController],
  providers: [ScheduledMessagesService, ScheduledMessagesProcessor],
  exports: [ScheduledMessagesService],
})
export class ScheduledMessagesModule {}
