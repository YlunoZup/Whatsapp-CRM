import { Test, TestingModule } from '@nestjs/testing';
import { AuditService, AuditActions } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prismaService: jest.Mocked<PrismaService>;

  const tenantId = 'tenant-123';
  const userId = 'user-123';

  const mockAuditLog = {
    id: 'log-123',
    tenantId,
    userId,
    action: AuditActions.LOGIN,
    resource: 'auth',
    resourceId: null,
    metadata: {},
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prismaService = module.get(PrismaService);
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue(mockAuditLog);

      await service.log({
        tenantId,
        userId,
        action: AuditActions.LOGIN,
        resource: 'auth',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          userId,
          action: AuditActions.LOGIN,
          resource: 'auth',
          resourceId: undefined,
          metadata: {},
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should not throw if logging fails', async () => {
      (prismaService.auditLog.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(
        service.log({
          tenantId,
          userId,
          action: AuditActions.LOGIN,
          resource: 'auth',
        }),
      ).resolves.not.toThrow();
    });

    it('should include metadata if provided', async () => {
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue(mockAuditLog);

      await service.log({
        tenantId,
        userId,
        action: AuditActions.CONTACT_CREATED,
        resource: 'contact',
        resourceId: 'contact-123',
        metadata: { phone: '+1234567890' },
      });

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resourceId: 'contact-123',
          metadata: { phone: '+1234567890' },
        }),
      });
    });
  });

  describe('logUserAction', () => {
    it('should log user action with simplified parameters', async () => {
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue(mockAuditLog);

      await service.logUserAction(
        tenantId,
        userId,
        AuditActions.MESSAGE_SENT,
        'message',
        'msg-123',
        { recipient: '+1234567890' },
      );

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          userId,
          action: AuditActions.MESSAGE_SENT,
          resource: 'message',
          resourceId: 'msg-123',
          metadata: { recipient: '+1234567890' },
        }),
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const logs = [mockAuditLog];
      (prismaService.auditLog.findMany as jest.Mock).mockResolvedValue(logs);
      (prismaService.auditLog.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getAuditLogs(tenantId);

      expect(result.data).toEqual(logs);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by userId', async () => {
      (prismaService.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.auditLog.count as jest.Mock).mockResolvedValue(0);

      await service.getAuditLogs(tenantId, { userId });

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            userId,
          }),
        }),
      );
    });

    it('should filter by action', async () => {
      (prismaService.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.auditLog.count as jest.Mock).mockResolvedValue(0);

      await service.getAuditLogs(tenantId, { action: AuditActions.LOGIN });

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: AuditActions.LOGIN,
          }),
        }),
      );
    });

    it('should filter by resource', async () => {
      (prismaService.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.auditLog.count as jest.Mock).mockResolvedValue(0);

      await service.getAuditLogs(tenantId, { resource: 'message' });

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resource: 'message',
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      (prismaService.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.auditLog.count as jest.Mock).mockResolvedValue(0);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await service.getAuditLogs(tenantId, { startDate, endDate });

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        }),
      );
    });

    it('should paginate results', async () => {
      (prismaService.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.auditLog.count as jest.Mock).mockResolvedValue(100);

      const result = await service.getAuditLogs(tenantId, { page: 2, limit: 20 });

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        }),
      );
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.totalPages).toBe(5);
    });

    it('should include user details in results', async () => {
      (prismaService.auditLog.findMany as jest.Mock).mockResolvedValue([mockAuditLog]);
      (prismaService.auditLog.count as jest.Mock).mockResolvedValue(1);

      await service.getAuditLogs(tenantId);

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
      );
    });
  });

  describe('AuditActions', () => {
    it('should have all required action types', () => {
      expect(AuditActions.LOGIN).toBe('auth.login');
      expect(AuditActions.LOGOUT).toBe('auth.logout');
      expect(AuditActions.USER_CREATED).toBe('user.created');
      expect(AuditActions.CONTACT_CREATED).toBe('contact.created');
      expect(AuditActions.MESSAGE_SENT).toBe('message.sent');
      expect(AuditActions.BROADCAST_SENT).toBe('broadcast.sent');
      expect(AuditActions.SESSION_CREATED).toBe('session.created');
      expect(AuditActions.WEBHOOK_CREATED).toBe('webhook.created');
    });
  });
});
