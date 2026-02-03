import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;
  let testTenantId: string;
  let testUserId: string;

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
        name: 'E2E Analytics Tenant',
        slug: `e2e-analytics-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `e2e-analytics-${Date.now()}@test.com`,
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

    // Create some test data for analytics
    const session = await prisma.whatsappSession.create({
      data: {
        name: 'Analytics Session',
        status: 'connected',
        tenantId: testTenantId,
      },
    });

    const contact = await prisma.contact.create({
      data: {
        phone: `+analytics${Date.now()}`,
        name: 'Analytics Contact',
        tenantId: testTenantId,
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        sessionId: session.id,
        tenantId: testTenantId,
        status: 'open',
        assignedTo: testUserId,
      },
    });

    // Create some messages
    await prisma.message.createMany({
      data: [
        {
          tenantId: testTenantId,
          conversationId: conversation.id,
          content: 'Test message 1',
          type: 'text',
          direction: 'incoming',
          status: 'delivered',
        },
        {
          tenantId: testTenantId,
          conversationId: conversation.id,
          content: 'Test message 2',
          type: 'text',
          direction: 'outgoing',
          status: 'sent',
        },
      ],
    });
  });

  afterAll(async () => {
    try {
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

  describe('/api/analytics (GET)', () => {
    it('should get analytics with date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const response = await request(app.getHttpServer())
        .get('/api/analytics')
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('overview');
      expect(response.body).toHaveProperty('messagesByDay');
      expect(response.body).toHaveProperty('conversationsByStatus');
      expect(response.body).toHaveProperty('topAgents');
    });

    it('should require date parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/analytics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(500); // Will fail without dates due to parseISO
    });

    it('should reject without authentication', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      await request(app.getHttpServer())
        .get('/api/analytics')
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(401);
    });
  });
});
