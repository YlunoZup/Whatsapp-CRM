import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('BroadcastsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;
  let testTenantId: string;
  let testUserId: string;
  let testSessionId: string;
  let testContactIds: string[] = [];
  let testBroadcastId: string;

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
        name: 'E2E Broadcasts Tenant',
        slug: `e2e-broadcasts-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `e2e-broadcasts-${Date.now()}@test.com`,
        passwordHash: 'hashed',
        name: 'E2E Test User',
        role: 'admin',
        tenantId: testTenantId,
      },
    });
    testUserId = user.id;

    // Create test session
    const session = await prisma.whatsappSession.create({
      data: {
        name: 'Test Session',
        status: 'connected',
        tenantId: testTenantId,
      },
    });
    testSessionId = session.id;

    // Create test contacts
    for (let i = 0; i < 3; i++) {
      const contact = await prisma.contact.create({
        data: {
          phone: `+${Date.now()}${i}`,
          name: `Broadcast Contact ${i}`,
          tenantId: testTenantId,
        },
      });
      testContactIds.push(contact.id);
    }

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
      await prisma.broadcastRecipient.deleteMany({
        where: { broadcast: { tenantId: testTenantId } }
      });
      await prisma.broadcast.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.contact.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.whatsappSession.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.tenant.delete({ where: { id: testTenantId } });
    } catch (e) {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('/api/broadcasts (POST)', () => {
    it('should create a scheduled broadcast', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const response = await request(app.getHttpServer())
        .post('/api/broadcasts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Scheduled Broadcast',
          content: 'Hello everyone! This is a test broadcast.',
          type: 'text',
          sessionId: testSessionId,
          contactIds: testContactIds,
          scheduledAt: futureDate.toISOString(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Scheduled Broadcast');
      expect(response.body.status).toBe('scheduled');

      testBroadcastId = response.body.id;
    });

    it('should create an immediate broadcast', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/broadcasts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Immediate Broadcast',
          content: 'This is sent immediately!',
          type: 'text',
          sessionId: testSessionId,
          contactIds: testContactIds.slice(0, 2),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Immediate Broadcast');
      // Status could be pending or processing
      expect(['pending', 'processing']).toContain(response.body.status);
    });
  });

  describe('/api/broadcasts (GET)', () => {
    it('should get all broadcasts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/broadcasts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('/api/broadcasts/:id (GET)', () => {
    it('should get a broadcast by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/broadcasts/${testBroadcastId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testBroadcastId);
      expect(response.body.name).toBe('Test Scheduled Broadcast');
    });

    it('should include recipient count', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/broadcasts/${testBroadcastId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('_count');
    });

    it('should return 404 for non-existent broadcast', async () => {
      await request(app.getHttpServer())
        .get('/api/broadcasts/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('/api/broadcasts/:id/start (POST)', () => {
    it('should start a scheduled broadcast', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/broadcasts/${testBroadcastId}/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('processing');
    });
  });

  describe('/api/broadcasts/:id/cancel (POST)', () => {
    it('should cancel a broadcast', async () => {
      // Create a new scheduled broadcast to cancel
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);

      const createResponse = await request(app.getHttpServer())
        .post('/api/broadcasts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'To Cancel',
          content: 'This will be cancelled',
          type: 'text',
          sessionId: testSessionId,
          contactIds: testContactIds,
          scheduledAt: futureDate.toISOString(),
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/broadcasts/${createResponse.body.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
    });
  });

  describe('/api/broadcasts/:id (DELETE)', () => {
    it('should delete a broadcast', async () => {
      // Create a scheduled broadcast to delete
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 3);

      const createResponse = await request(app.getHttpServer())
        .post('/api/broadcasts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'To Delete',
          content: 'This will be deleted',
          type: 'text',
          sessionId: testSessionId,
          contactIds: [testContactIds[0]],
          scheduledAt: futureDate.toISOString(),
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/broadcasts/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
