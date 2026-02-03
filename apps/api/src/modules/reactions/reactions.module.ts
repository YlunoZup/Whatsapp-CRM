import { Module } from '@nestjs/common';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { SocketModule } from '../../common/socket/socket.module';
import { WhatsAppModule } from '../../common/whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, SocketModule, WhatsAppModule],
  controllers: [ReactionsController],
  providers: [ReactionsService],
  exports: [ReactionsService],
})
export class ReactionsModule {}
