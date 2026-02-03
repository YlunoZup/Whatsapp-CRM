import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthModule } from '../src/modules/health/health.module';
import { PrismaModule } from '../src/common/prisma/prisma.module';
import { RedisModule } from '../src/common/redis/redis.module';
import { ConfigModule } from '@nestjs/config';
import configuration from '../src/config/configuration';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          envFilePath: ['.env.test', '.env'],
        }),
        PrismaModule,
        RedisModule,
        HealthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/health (GET)', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
  });

  describe('/api/health/detailed (GET)', () => {
    it('should return detailed health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('redis');
    });
  });
});
