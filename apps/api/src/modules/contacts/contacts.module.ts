import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactSyncService } from './contact-sync.service';
import { ContactsController } from './contacts.controller';

@Module({
  controllers: [ContactsController],
  providers: [ContactsService, ContactSyncService],
  exports: [ContactsService, ContactSyncService],
})
export class ContactsModule {}
