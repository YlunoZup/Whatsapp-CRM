import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('ConversationsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;
  let testTenantId: string;
  let testUserId: string;
  let testContactId: string;
  let testSessionId: string;
  let testConversationId: string;

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
        name: 'E2E Conversations Tenant',
        slug: `e2e-conversations-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `e2e-conversations-${Date.now()}@test.com`,
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

    // Create test contact
    const contact = await prisma.contact.create({
      data: {
        phone: `+${Date.now()}`,
        name: 'Conversation Contact',
        tenantId: testTenantId,
      },
    });
    testContactId = contact.id;

    // Create test conversation directly in DB
    const conversation = await prisma.conversation.create({
      data: {
        contactId: testContactId,
        sessionId: testSessionId,
        tenantId: testTenantId,
        status: 'open',
      },
    });
    testConversationId = conversation.id;

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
      await prisma.message.deleteMany({ where: { conversation: { tenantId: testTenantId } } });
      await prisma.conversation.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.contact.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.whatsappSession.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.tenant.delete({ where: { id: testTenantId } });
    } catch (e) {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('/api/conversations (GET)', () => {
    it('should get all conversations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/conversations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/conversations')
        .expect(401);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/conversations')
        .query({ status: 'open' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.every((c: { status: string }) => c.status === 'open')).toBe(true);
    });

    it('should filter by session', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/conversations')
        .query({ sessionId: testSessionId })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.every((c: { sessionId: string }) => c.sessionId === testSessionId)).toBe(true);
    });
  });

  describe('/api/conversations/:id (GET)', () => {
    it('should get a conversation by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/conversations/${testConversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testConversationId);
      expect(response.body.contactId).toBe(testContactId);
    });

    it('should return 404 for non-existent conversation', async () => {
      await request(app.getHttpServer())
        .get('/api/conversations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('/api/conversations/:id/assign (POST)', () => {
    it('should assign conversation to a user', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/conversations/${testConversationId}/assign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          userId: testUserId,
        })
        .expect(201);

      expect(response.body.assignedTo).toBe(testUserId);
    });

    it('should unassign conversation', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/conversations/${testConversationId}/assign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          userId: null,
        })
        .expect(201);

      expect(response.body.assignedTo).toBeNull();
    });
  });

  describe('/api/conversations/:id/close (POST)', () => {
    it('should close a conversation', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/conversations/${testConversationId}/close`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.status).toBe('closed');
    });
  });

  describe('/api/conversations/:id/reopen (POST)', () => {
    it('should reopen a conversation', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/conversations/${testConversationId}/reopen`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.status).toBe('open');
    });
  });

  describe('/api/conversations/bulk-update (POST)', () => {
    it('should bulk update conversations', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/conversations/bulk-update')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ids: [testConversationId],
          label: 'support',
        })
        .expect(201);

      expect(response.body).toHaveProperty('updated');
      expect(response.body.updated).toBe(1);
    });
  });

  describe('/api/conversations/:id (PUT)', () => {
    it('should update a conversation status', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/conversations/${testConversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'pending',
        })
        .expect(200);

      expect(response.body.status).toBe('pending');
    });
  });
});
