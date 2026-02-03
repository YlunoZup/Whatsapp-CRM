import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prismaService: jest.Mocked<PrismaService>;

  const tenantId = 'tenant-123';

  const mockConversation = {
    id: 'conv-123',
    tenantId,
    sessionId: 'session-123',
    contactId: 'contact-123',
    status: 'open',
    priority: 'normal',
    label: null,
    assignedTo: null,
    lastMessageAt: new Date(),
    unreadCount: 0,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    contact: {
      id: 'contact-123',
      name: 'John Doe',
      phone: '+1234567890',
    },
    session: {
      id: 'session-123',
      name: 'Main Session',
      phoneNumber: '+0987654321',
    },
    assignedUser: null,
    messages: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      conversation: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    prismaService = module.get(PrismaService);
  });

  describe('findAll', () => {
    it('should return paginated conversations', async () => {
      (prismaService.conversation.findMany as jest.Mock).mockResolvedValue([mockConversation]);
      (prismaService.conversation.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(tenantId);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by status', async () => {
      (prismaService.conversation.findMany as jest.Mock).mockResolvedValue([mockConversation]);
      (prismaService.conversation.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(tenantId, { status: 'open' });

      expect(prismaService.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            status: 'open',
          }),
        }),
      );
    });

    it('should filter by sessionId', async () => {
      (prismaService.conversation.findMany as jest.Mock).mockResolvedValue([mockConversation]);
      (prismaService.conversation.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(tenantId, { sessionId: 'session-123' });

      expect(prismaService.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sessionId: 'session-123',
          }),
        }),
      );
    });

    it('should search by contact name or phone', async () => {
      (prismaService.conversation.findMany as jest.Mock).mockResolvedValue([mockConversation]);
      (prismaService.conversation.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(tenantId, { search: 'John' });

      expect(prismaService.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contact: {
              OR: [
                { name: { contains: 'John', mode: 'insensitive' } },
                { phone: { contains: 'John' } },
              ],
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a conversation by id', async () => {
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);

      const result = await service.findOne('conv-123', tenantId);

      expect(result).toEqual(mockConversation);
    });

    it('should throw NotFoundException if conversation not found', async () => {
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('invalid-id', tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByContactAndSession', () => {
    it('should find conversation by contact and session', async () => {
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);

      const result = await service.findByContactAndSession(
        'contact-123',
        'session-123',
        tenantId,
      );

      expect(result).toEqual(mockConversation);
    });
  });

  describe('findOrCreate', () => {
    it('should return existing conversation if found', async () => {
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);

      const result = await service.findOrCreate(tenantId, 'session-123', 'contact-123');

      expect(result).toEqual(mockConversation);
      expect(prismaService.conversation.create).not.toHaveBeenCalled();
    });

    it('should create new conversation if not found', async () => {
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.conversation.create as jest.Mock).mockResolvedValue(mockConversation);

      const result = await service.findOrCreate(tenantId, 'session-123', 'contact-123');

      expect(result).toEqual(mockConversation);
      expect(prismaService.conversation.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          sessionId: 'session-123',
          contactId: 'contact-123',
          status: 'open',
          unreadCount: 0,
        },
      });
    });
  });

  describe('update', () => {
    it('should update conversation', async () => {
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prismaService.conversation.update as jest.Mock).mockResolvedValue({
        ...mockConversation,
        status: 'closed',
      });

      const result = await service.update('conv-123', tenantId, { status: 'closed' });

      expect(result.status).toBe('closed');
    });
  });

  describe('assign', () => {
    it('should assign user to conversation', async () => {
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prismaService.conversation.update as jest.Mock).mockResolvedValue({
        ...mockConversation,
        assignedTo: 'user-123',
        assignedUser: { id: 'user-123', name: 'Agent', avatarUrl: null },
      });

      const result = await service.assign('conv-123', tenantId, 'user-123');

      expect(result.assignedTo).toBe('user-123');
    });

    it('should unassign user when passing null', async () => {
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue({
        ...mockConversation,
        assignedTo: 'user-123',
      });
      (prismaService.conversation.update as jest.Mock).mockResolvedValue({
        ...mockConversation,
        assignedTo: null,
        assignedUser: null,
      });

      const result = await service.assign('conv-123', tenantId, null);

      expect(result.assignedTo).toBeNull();
    });
  });

  describe('close', () => {
    it('should close a conversation', async () => {
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prismaService.conversation.update as jest.Mock).mockResolvedValue({
        ...mockConversation,
        status: 'closed',
      });

      const result = await service.close('conv-123', tenantId);

      expect(result.status).toBe('closed');
    });
  });

  describe('reopen', () => {
    it('should reopen a conversation', async () => {
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue({
        ...mockConversation,
        status: 'closed',
      });
      (prismaService.conversation.update as jest.Mock).mockResolvedValue({
        ...mockConversation,
        status: 'open',
      });

      const result = await service.reopen('conv-123', tenantId);

      expect(result.status).toBe('open');
    });
  });

  describe('incrementUnreadCount', () => {
    it('should increment unread count', async () => {
      (prismaService.conversation.update as jest.Mock).mockResolvedValue({
        ...mockConversation,
        unreadCount: 1,
      });

      const result = await service.incrementUnreadCount('conv-123');

      expect(prismaService.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: expect.any(Date),
        },
      });
    });
  });

  describe('resetUnreadCount', () => {
    it('should reset unread count to zero', async () => {
      (prismaService.conversation.update as jest.Mock).mockResolvedValue({
        ...mockConversation,
        unreadCount: 0,
      });

      await service.resetUnreadCount('conv-123');

      expect(prismaService.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        data: { unreadCount: 0 },
      });
    });
  });

  describe('bulkUpdate', () => {
    it('should bulk update conversations', async () => {
      (prismaService.conversation.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const result = await service.bulkUpdate(tenantId, ['conv-1', 'conv-2', 'conv-3'], {
        status: 'closed',
        priority: 'high',
      });

      expect(result.updated).toBe(3);
      expect(prismaService.conversation.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['conv-1', 'conv-2', 'conv-3'] },
          tenantId,
        },
        data: {
          status: 'closed',
          priority: 'high',
        },
      });
    });

    it('should only update provided fields', async () => {
      (prismaService.conversation.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.bulkUpdate(tenantId, ['conv-1'], { label: 'sales' });

      expect(prismaService.conversation.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['conv-1'] },
          tenantId,
        },
        data: {
          label: 'sales',
        },
      });
    });
  });
});
