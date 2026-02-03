import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('TagsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;
  let testTenantId: string;
  let testUserId: string;
  let testTagId: string;

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
    jwtService = app.get(JwtService);

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'E2E Tags Tenant',
        slug: `e2e-tags-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `e2e-tags-${Date.now()}@test.com`,
        passwordHash: 'hashed',
        name: 'E2E Test User',
        role: 'admin',
        tenantId: testTenantId,
      },
    });
    testUserId = user.id;

    // Generate access token
    accessToken = jwtService.sign({
      sub: testUserId,
      email: user.email,
      tenantId: testTenantId,
      role: 'admin',
    });
  });

  afterAll(async () => {
    try {
      await prisma.tag.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.tenant.delete({ where: { id: testTenantId } });
    } catch (e) {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('/api/tags (POST)', () => {
    it('should create a new tag', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'VIP Customer',
          color: '#FF5733',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('VIP Customer');
      expect(response.body.color).toBe('#FF5733');

      testTagId = response.body.id;
    });

    it('should reject duplicate tag names', async () => {
      await request(app.getHttpServer())
        .post('/api/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'VIP Customer',
          color: '#00FF00',
        })
        .expect(409);
    });
  });

  describe('/api/tags (GET)', () => {
    it('should get all tags', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('/api/tags/:id (PATCH)', () => {
    it('should update a tag', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tags/${testTagId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Super VIP',
          color: '#0000FF',
        })
        .expect(200);

      expect(response.body.name).toBe('Super VIP');
      expect(response.body.color).toBe('#0000FF');
    });
  });

  describe('/api/tags/:id (DELETE)', () => {
    it('should delete a tag', async () => {
      // Create a tag to delete
      const createResponse = await request(app.getHttpServer())
        .post('/api/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'To Delete',
          color: '#999999',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/tags/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
