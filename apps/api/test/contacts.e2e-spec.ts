import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('ContactsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;
  let testTenantId: string;
  let testUserId: string;
  let testContactId: string;

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

    // Create test tenant and user
    const tenant = await prisma.tenant.create({
      data: {
        name: 'E2E Test Tenant',
        slug: `e2e-test-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        email: `e2e-contacts-${Date.now()}@test.com`,
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
    // Clean up
    try {
      await prisma.contact.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.tenant.delete({ where: { id: testTenantId } });
    } catch (e) {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('/api/contacts (POST)', () => {
    it('should create a new contact', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phone: '+1234567890',
          name: 'Test Contact',
          email: 'contact@example.com',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.phone).toBe('+1234567890');
      expect(response.body.name).toBe('Test Contact');
      expect(response.body.tenantId).toBe(testTenantId);

      testContactId = response.body.id;
    });

    it('should reject without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/contacts')
        .send({
          phone: '+0987654321',
          name: 'Unauthorized Contact',
        })
        .expect(401);
    });

    it('should reject with invalid phone', async () => {
      await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Contact',
        })
        .expect(400);
    });
  });

  describe('/api/contacts (GET)', () => {
    it('should get all contacts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should search contacts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/contacts')
        .query({ search: 'Test' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should paginate contacts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/contacts')
        .query({ page: 1, limit: 5 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page');
    });
  });

  describe('/api/contacts/:id (GET)', () => {
    it('should get a contact by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/contacts/${testContactId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testContactId);
      expect(response.body.phone).toBe('+1234567890');
    });

    it('should return 404 for non-existent contact', async () => {
      await request(app.getHttpServer())
        .get('/api/contacts/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('/api/contacts/:id (PUT)', () => {
    it('should update a contact', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/contacts/${testContactId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Contact Name',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Contact Name');
    });
  });

  describe('/api/contacts/:id (DELETE)', () => {
    it('should delete a contact', async () => {
      // Create a contact to delete
      const createResponse = await request(app.getHttpServer())
        .post('/api/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phone: '+9999999999',
          name: 'To Delete',
        })
        .expect(201);

      const deleteId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/api/contacts/${deleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify deletion
      await request(app.getHttpServer())
        .get(`/api/contacts/${deleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
