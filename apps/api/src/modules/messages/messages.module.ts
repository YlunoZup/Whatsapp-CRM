import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessageProcessor } from './message.processor';
import { ConversationsModule } from '../conversations/conversations.module';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [ConversationsModule, ContactsModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessageProcessor],
  exports: [MessagesService],
})
export class MessagesModule {}
