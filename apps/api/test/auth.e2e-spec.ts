import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUserEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up test user
    try {
      const user = await prisma.user.findUnique({
        where: { email: testUserEmail },
      });
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
        await prisma.tenant.delete({ where: { id: user.tenantId } });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('/api/auth/register (POST)', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUserEmail,
          password: testPassword,
          name: 'Test User',
          tenantName: 'Test Tenant',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUserEmail);

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject registration with existing email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUserEmail,
          password: testPassword,
          name: 'Test User 2',
          tenantName: 'Test Tenant 2',
        })
        .expect(409);
    });

    it('should reject registration with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: testPassword,
          name: 'Test User',
          tenantName: 'Test Tenant',
        })
        .expect(400);
    });

    it('should reject registration with missing fields', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'new@example.com',
        })
        .expect(400);
    });
  });

  describe('/api/auth/login (POST)', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject login with wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject login with non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);
    });
  });

  describe('/api/auth/refresh (POST)', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject refresh with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);
    });
  });
});
