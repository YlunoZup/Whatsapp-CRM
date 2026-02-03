import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('TemplatesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;
  let testTenantId: string;
  let testUserId: string;
  let testTemplateId: string;

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
        name: 'E2E Templates Tenant',
        slug: `e2e-templates-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `e2e-templates-${Date.now()}@test.com`,
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
      await prisma.messageTemplate.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.tenant.delete({ where: { id: testTenantId } });
    } catch (e) {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('/api/templates (POST)', () => {
    it('should create a new template', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Welcome Message',
          content: 'Hello {{name}}, welcome to our service!',
          category: 'greeting',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Welcome Message');
      expect(response.body.content).toBe('Hello {{name}}, welcome to our service!');
      expect(response.body.category).toBe('greeting');

      testTemplateId = response.body.id;
    });

    it('should extract variables from template', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Order Confirmation',
          content: 'Hi {{customer}}, your order #{{order_id}} is confirmed for {{date}}.',
          category: 'sales',
        })
        .expect(201);

      expect(response.body.variables).toContain('customer');
      expect(response.body.variables).toContain('order_id');
      expect(response.body.variables).toContain('date');
    });
  });

  describe('/api/templates (GET)', () => {
    it('should get all templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/templates')
        .query({ category: 'greeting' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.every((t: any) => t.category === 'greeting')).toBe(true);
    });
  });

  describe('/api/templates/:id (PATCH)', () => {
    it('should update a template', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Welcome',
          content: 'Hello {{name}}, welcome aboard!',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Welcome');
    });
  });

  describe('/api/templates/:id (DELETE)', () => {
    it('should delete a template', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'To Delete',
          content: 'This will be deleted',
          category: 'other',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/templates/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
