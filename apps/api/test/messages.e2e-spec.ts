import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('MessagesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;
  let testTenantId: string;
  let testUserId: string;
  let testContactId: string;
  let testSessionId: string;
  let testConversationId: string;
  let testMessageId: string;

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
        name: 'E2E Messages Tenant',
        slug: `e2e-messages-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `e2e-messages-${Date.now()}@test.com`,
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
        name: 'Messages Contact',
        tenantId: testTenantId,
      },
    });
    testContactId = contact.id;

    // Create test conversation
    const conversation = await prisma.conversation.create({
      data: {
        contactId: testContactId,
        sessionId: testSessionId,
        tenantId: testTenantId,
        status: 'open',
      },
    });
    testConversationId = conversation.id;

    // Create test message directly in DB
    const message = await prisma.message.create({
      data: {
        tenantId: testTenantId,
        conversationId: testConversationId,
        content: 'Test message',
        type: 'text',
        direction: 'incoming',
        status: 'delivered',
      },
    });
    testMessageId = message.id;

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
      await prisma.messageReaction.deleteMany({
        where: { message: { conversation: { tenantId: testTenantId } } }
      });
      await prisma.message.deleteMany({
        where: { conversation: { tenantId: testTenantId } }
      });
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

  describe('/api/conversations/:conversationId/messages (POST)', () => {
    it('should create a new message', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Hello, this is a test message!',
          type: 'text',
          direction: 'outbound',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('Hello, this is a test message!');
      expect(response.body.conversationId).toBe(testConversationId);
    });

    it('should reject without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/conversations/${testConversationId}/messages`)
        .send({
          content: 'Test',
          type: 'text',
          direction: 'outgoing',
        })
        .expect(401);
    });
  });

  describe('/api/conversations/:conversationId/messages (GET)', () => {
    it('should get messages for a conversation', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should support cursor pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/conversations/${testConversationId}/messages`)
        .query({ limit: 10 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('/api/messages/:messageId/star (POST)', () => {
    it('should star a message', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/messages/${testMessageId}/star`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.isStarred).toBe(true);
      expect(response.body.starredAt).not.toBeNull();
    });
  });

  describe('/api/messages/:messageId/star (DELETE)', () => {
    it('should unstar a message', async () => {
      // First ensure it's starred
      await request(app.getHttpServer())
        .post(`/api/messages/${testMessageId}/star`)
        .set('Authorization', `Bearer ${accessToken}`);

      const response = await request(app.getHttpServer())
        .delete(`/api/messages/${testMessageId}/star`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.isStarred).toBe(false);
    });
  });

  describe('/api/messages/starred (GET)', () => {
    it('should get starred messages', async () => {
      // First star a message
      await request(app.getHttpServer())
        .post(`/api/messages/${testMessageId}/star`)
        .set('Authorization', `Bearer ${accessToken}`);

      const response = await request(app.getHttpServer())
        .get('/api/messages/starred')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('/api/messages/:messageId/forward (POST)', () => {
    it('should forward a message to another conversation', async () => {
      // Create another conversation to forward to
      const contact2 = await prisma.contact.create({
        data: {
          phone: `+${Date.now() + 1}`,
          name: 'Forward Contact',
          tenantId: testTenantId,
        },
      });

      const conversation2 = await prisma.conversation.create({
        data: {
          contactId: contact2.id,
          sessionId: testSessionId,
          tenantId: testTenantId,
          status: 'open',
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/messages/${testMessageId}/forward`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          targetIds: [conversation2.id],
          targetType: 'conversation',
        })
        .expect(201);

      expect(response.body).toHaveProperty('forwarded');
      expect(response.body).toHaveProperty('results');
    });
  });
});
