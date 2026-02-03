import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { IncomingWebhooksController } from './incoming-webhooks.controller';
import { WebhookProcessor } from './webhook.processor';
import { SessionsModule } from '../sessions/sessions.module';
import { MessagesModule } from '../messages/messages.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [SessionsModule, MessagesModule, ContactsModule, ConversationsModule],
  controllers: [WebhooksController, IncomingWebhooksController],
  providers: [WebhooksService, WebhookProcessor],
  exports: [WebhooksService, WebhookProcessor],
})
export class WebhooksModule {}
