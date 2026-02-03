import { Module } from '@nestjs/common';
import { ContactNotesController } from './contact-notes.controller';
import { ContactNotesService } from './contact-notes.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ContactNotesController],
  providers: [ContactNotesService],
  exports: [ContactNotesService],
})
export class ContactNotesModule {}
