import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { TagsModule } from './modules/tags/tags.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { BroadcastsModule } from './modules/broadcasts/broadcasts.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { SearchModule } from './modules/search/search.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ScheduledMessagesModule } from './modules/scheduled-messages/scheduled-messages.module';
import { ContactNotesModule } from './modules/contact-notes/contact-notes.module';
import { ReactionsModule } from './modules/reactions/reactions.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { QueueModule } from './common/queue/queue.module';
import { RedisModule } from './common/redis/redis.module';
import { SocketModule } from './common/socket/socket.module';
import { CacheModule } from './common/cache/cache.module';
import { AuditModule } from './common/audit/audit.module';
import { WhatsAppModule } from './common/whatsapp/whatsapp.module';
import { SanitizationMiddleware, RequestIdMiddleware } from './common/middleware';
import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Core modules
    PrismaModule,
    RedisModule,
    CacheModule,
    QueueModule,
    SocketModule,
    AuditModule,
    WhatsAppModule,

    // Feature modules
    AuthModule,
    UsersModule,
    TenantsModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    SessionsModule,
    WebhooksModule,
    IntegrationsModule,
    TagsModule,
    TemplatesModule,
    DashboardModule,
    BroadcastsModule,
    UploadsModule,
    SearchModule,
    AnalyticsModule,
    ScheduledMessagesModule,
    ContactNotesModule,
    ReactionsModule,
    HealthModule,
    MetricsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, SanitizationMiddleware)
      .forRoutes('*');
  }
}
