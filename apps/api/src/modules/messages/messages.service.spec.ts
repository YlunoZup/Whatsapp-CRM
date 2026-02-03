import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueueService } from '../../common/queue/queue.service';
import { SocketService } from '../../common/socket/socket.service';
import { ConversationsService } from '../conversations/conversations.service';

describe('MessagesService', () => {
  let service: MessagesService;
  let prismaService: jest.Mocked<PrismaService>;
  let queueService: jest.Mocked<QueueService>;
  let socketService: jest.Mocked<SocketService>;
  let conversationsService: jest.Mocked<ConversationsService>;

  const tenantId = 'tenant-123';

  const mockMessage = {
    id: 'msg-123',
    tenantId,
    conversationId: 'conv-123',
    whatsappMessageId: 'wa-msg-123',
    direction: 'outbound',
    type: 'text',
    content: 'Hello World',
    mediaUrl: null,
    status: 'sent',
    isStarred: false,
    starredAt: null,
    metadata: {},
    sequenceNumber: null,
    createdAt: new Date(),
  };

  const mockConversation = {
    id: 'conv-123',
    tenantId,
    sessionId: 'session-123',
    contactId: 'contact-123',
    status: 'open',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      message: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      conversation: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      contact: {
        findFirst: jest.fn(),
      },
      whatsappSession: {
        findFirst: jest.fn(),
      },
    };

    const mockQueueService = {
      addMessageJob: jest.fn(),
    };

    const mockSocketService = {
      emitNewMessage: jest.fn(),
      emitMessageStatusUpdate: jest.fn(),
    };

    const mockConversationsService = {
      findOne: jest.fn(),
      updateLastMessageAt: jest.fn(),
      incrementUnreadCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: SocketService, useValue: mockSocketService },
        { provide: ConversationsService, useValue: mockConversationsService },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    prismaService = module.get(PrismaService);
    queueService = module.get(QueueService);
    socketService = module.get(SocketService);
    conversationsService = module.get(ConversationsService);
  });

  describe('findByConversation', () => {
    it('should return messages for a conversation', async () => {
      (conversationsService.findOne as jest.Mock).mockResolvedValue(mockConversation);
      (prismaService.message.findMany as jest.Mock).mockResolvedValue([mockMessage]);

      const result = await service.findByConversation('conv-123', tenantId);

      expect(result.data).toHaveLength(1);
      expect(conversationsService.findOne).toHaveBeenCalledWith('conv-123', tenantId);
    });

    it('should paginate messages with cursor', async () => {
      (conversationsService.findOne as jest.Mock).mockResolvedValue(mockConversation);
      (prismaService.message.findUnique as jest.Mock).mockResolvedValue({
        createdAt: new Date('2024-01-01'),
      });
      (prismaService.message.findMany as jest.Mock).mockResolvedValue([mockMessage]);

      await service.findByConversation('conv-123', tenantId, {
        cursor: 'msg-cursor',
        limit: 20,
        direction: 'before',
      });

      expect(prismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: 'conv-123',
            createdAt: { lt: expect.any(Date) },
          }),
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('create', () => {
    it('should create a new message', async () => {
      (prismaService.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (conversationsService.updateLastMessageAt as jest.Mock).mockResolvedValue(undefined);

      const result = await service.create({
        conversationId: 'conv-123',
        direction: 'outbound',
        type: 'text',
        content: 'Hello World',
      });

      expect(result).toEqual(mockMessage);
      expect(prismaService.message.create).toHaveBeenCalled();
      expect(conversationsService.updateLastMessageAt).toHaveBeenCalledWith('conv-123');
      expect(socketService.emitNewMessage).toHaveBeenCalled();
    });

    it('should increment unread count for inbound messages', async () => {
      const inboundMessage = { ...mockMessage, direction: 'inbound' };
      (prismaService.message.create as jest.Mock).mockResolvedValue(inboundMessage);

      await service.create({
        conversationId: 'conv-123',
        direction: 'inbound',
        type: 'text',
        content: 'Hello',
      });

      expect(conversationsService.incrementUnreadCount).toHaveBeenCalledWith('conv-123');
    });
  });

  describe('send', () => {
    it('should queue a message for sending', async () => {
      (queueService.addMessageJob as jest.Mock).mockResolvedValue({ id: 'job-123' });

      const result = await service.send(tenantId, {
        sessionId: 'session-123',
        to: '+1234567890',
        type: 'text',
        content: 'Hello',
      });

      expect(result.status).toBe('queued');
      expect(result.jobId).toBe('job-123');
      expect(queueService.addMessageJob).toHaveBeenCalledWith({
        sessionId: 'session-123',
        to: '+1234567890',
        message: 'Hello',
        type: 'text',
        mediaUrl: undefined,
        metadata: undefined,
      });
    });
  });

  describe('updateStatus', () => {
    it('should update message status', async () => {
      (prismaService.message.update as jest.Mock).mockResolvedValue({
        ...mockMessage,
        status: 'delivered',
      });

      const result = await service.updateStatus('msg-123', 'delivered');

      expect(result.status).toBe('delivered');
      expect(socketService.emitMessageStatusUpdate).toHaveBeenCalled();
    });

    it('should update whatsappMessageId if provided', async () => {
      (prismaService.message.update as jest.Mock).mockResolvedValue(mockMessage);

      await service.updateStatus('msg-123', 'sent', 'wa-new-id');

      expect(prismaService.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-123' },
        data: {
          status: 'sent',
          whatsappMessageId: 'wa-new-id',
        },
      });
    });
  });

  describe('findByWhatsAppId', () => {
    it('should find message by WhatsApp message ID', async () => {
      (prismaService.message.findFirst as jest.Mock).mockResolvedValue(mockMessage);

      const result = await service.findByWhatsAppId('wa-msg-123');

      expect(result).toEqual(mockMessage);
    });
  });

  describe('delete', () => {
    it('should delete a message', async () => {
      (prismaService.message.findUnique as jest.Mock).mockResolvedValue({
        ...mockMessage,
        conversation: mockConversation,
      });
      (prismaService.message.delete as jest.Mock).mockResolvedValue(mockMessage);

      const result = await service.delete('msg-123', tenantId);

      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException if message not found', async () => {
      (prismaService.message.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('invalid-id', tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if message belongs to different tenant', async () => {
      (prismaService.message.findUnique as jest.Mock).mockResolvedValue({
        ...mockMessage,
        conversation: { ...mockConversation, tenantId: 'other-tenant' },
      });

      await expect(service.delete('msg-123', tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleStar', () => {
    it('should star a message', async () => {
      (prismaService.message.findUnique as jest.Mock).mockResolvedValue({
        ...mockMessage,
        conversation: mockConversation,
      });
      (prismaService.message.update as jest.Mock).mockResolvedValue({
        ...mockMessage,
        isStarred: true,
        starredAt: new Date(),
      });

      const result = await service.toggleStar('msg-123', tenantId, true);

      expect(result.isStarred).toBe(true);
      expect(prismaService.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-123' },
        data: {
          isStarred: true,
          starredAt: expect.any(Date),
        },
      });
    });

    it('should unstar a message', async () => {
      (prismaService.message.findUnique as jest.Mock).mockResolvedValue({
        ...mockMessage,
        isStarred: true,
        conversation: mockConversation,
      });
      (prismaService.message.update as jest.Mock).mockResolvedValue({
        ...mockMessage,
        isStarred: false,
        starredAt: null,
      });

      const result = await service.toggleStar('msg-123', tenantId, false);

      expect(result.isStarred).toBe(false);
      expect(prismaService.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-123' },
        data: {
          isStarred: false,
          starredAt: null,
        },
      });
    });
  });

  describe('getStarredMessages', () => {
    it('should return starred messages', async () => {
      const starredMessage = { ...mockMessage, isStarred: true };
      (prismaService.message.findMany as jest.Mock).mockResolvedValue([starredMessage]);

      const result = await service.getStarredMessages(tenantId);

      expect(result.data).toHaveLength(1);
      expect(prismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isStarred: true,
            conversation: { tenantId },
          },
          orderBy: { starredAt: 'desc' },
        }),
      );
    });

    it('should filter by conversationId', async () => {
      (prismaService.message.findMany as jest.Mock).mockResolvedValue([]);

      await service.getStarredMessages(tenantId, { conversationId: 'conv-123' });

      expect(prismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: 'conv-123',
          }),
        }),
      );
    });
  });

  describe('forwardMessage', () => {
    it('should forward message to conversations', async () => {
      (prismaService.message.findUnique as jest.Mock).mockResolvedValue({
        ...mockMessage,
        conversation: mockConversation,
      });
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prismaService.message.create as jest.Mock).mockResolvedValue({
        ...mockMessage,
        id: 'forwarded-msg-123',
        content: '[Forwarded]\nHello World',
      });
      (conversationsService.updateLastMessageAt as jest.Mock).mockResolvedValue(undefined);

      const result = await service.forwardMessage(
        'msg-123',
        tenantId,
        ['conv-456'],
        'conversation',
      );

      expect(result.forwarded).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should throw NotFoundException for non-existent message', async () => {
      (prismaService.message.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.forwardMessage('invalid-id', tenantId, ['conv-456'], 'conversation'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
