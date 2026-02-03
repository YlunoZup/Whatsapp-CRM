import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor, TimeoutInterceptor } from './common/interceptors';
import { GracefulShutdown } from './common/utils';

function validateProductionSecrets(configService: ConfigService, logger: Logger): void {
  const nodeEnv = configService.get('NODE_ENV', 'development');

  if (nodeEnv === 'production') {
    const criticalSecrets = [
      { key: 'JWT_SECRET', value: configService.get('JWT_SECRET') },
      { key: 'JWT_REFRESH_SECRET', value: configService.get('JWT_REFRESH_SECRET') },
      { key: 'ENCRYPTION_KEY', value: configService.get('ENCRYPTION_KEY') },
    ];

    const defaultSecrets = [
      'super-secret-jwt-key-change-in-production',
      'super-secret-refresh-key-change-in-production',
      'change-this-32-character-secret!',
    ];

    const missingOrDefault = criticalSecrets.filter(
      (s) => !s.value || defaultSecrets.includes(s.value)
    );

    if (missingOrDefault.length > 0) {
      const missing = missingOrDefault.map((s) => s.key).join(', ');
      logger.error(`CRITICAL: Missing or default secrets detected in production: ${missing}`);
      logger.error('Application cannot start in production with default security credentials.');
      logger.error('Please set proper values for these environment variables.');
      process.exit(1);
    }

    // Validate CORS origin is not localhost in production
    const corsOrigin = configService.get('CORS_ORIGIN', '');
    if (!corsOrigin || corsOrigin.includes('localhost')) {
      logger.warn('WARNING: CORS_ORIGIN not configured or set to localhost in production.');
    }

    // Validate MinIO credentials
    const minioAccessKey = configService.get('MINIO_ACCESS_KEY', '');
    if (!minioAccessKey || minioAccessKey === 'minioadmin') {
      logger.warn('WARNING: MinIO using default credentials in production.');
    }

    logger.log('Production security validation passed.');
  }
}

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    // Limit logging in production for performance and security
    logger: isProd ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Enable shutdown hooks for proper cleanup
  app.enableShutdownHooks();

  // Setup graceful shutdown
  GracefulShutdown.setup(app);
  const configService = app.get(ConfigService);

  // Validate production secrets
  validateProductionSecrets(configService, logger);

  // Global Exception Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global Interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TimeoutInterceptor(30000), // 30 second timeout
  );

  // Security
  app.use(helmet());

  // Compression
  app.use(compression());

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  // API Prefix and Versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation - only enable in development
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('WhatsApp CRM API')
      .setDescription(`
## Overview
WhatsApp CRM API provides endpoints for managing WhatsApp conversations, contacts,
broadcasts, and integrations. Built for multi-tenant SaaS with support for multiple
WhatsApp accounts via Evolution API.

## Authentication
- **JWT Bearer Token**: Use for web/mobile app authentication
- **API Key**: Use for server-to-server integrations

## Rate Limiting
- Short: 3 requests per second
- Medium: 20 requests per 10 seconds
- Long: 100 requests per minute

## Modules
- **Auth**: User authentication and registration
- **Contacts**: Contact management with tags
- **Conversations**: Chat conversations and messages
- **Sessions**: WhatsApp session management
- **Broadcasts**: Bulk messaging campaigns
- **Templates**: Message templates
- **Webhooks**: Outbound webhook integrations
- **Analytics**: Reporting and metrics
      `)
      .setVersion('1.0')
      .setContact('WhatsApp CRM', 'https://example.com', 'support@example.com')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
        'JWT-auth',
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'API Key for server-to-server integrations',
        },
        'api-key',
      )
      .addTag('Auth', 'User authentication and registration')
      .addTag('Contacts', 'Contact management')
      .addTag('Conversations', 'Chat conversation management')
      .addTag('Messages', 'Message operations')
      .addTag('Sessions', 'WhatsApp session management')
      .addTag('Broadcasts', 'Bulk messaging campaigns')
      .addTag('Templates', 'Message templates')
      .addTag('Webhooks', 'Webhook integrations')
      .addTag('Analytics', 'Reporting and metrics')
      .addTag('Users', 'User management')
      .addTag('Tags', 'Contact tagging')
      .addTag('Search', 'Global search')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);

  if (!isProd) {
    logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  }

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${configService.get('NODE_ENV', 'development')}`);
}

bootstrap();
