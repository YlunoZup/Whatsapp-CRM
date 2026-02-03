import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let prismaService: jest.Mocked<PrismaService>;

  const tenantId = 'tenant-123';

  const mockContact = {
    id: 'contact-123',
    tenantId,
    whatsappId: 'wa-123',
    phone: '+1234567890',
    name: 'John Doe',
    email: 'john@example.com',
    avatarUrl: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    conversations: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      contact: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      contactTag: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    prismaService = module.get(PrismaService);
  });

  describe('findAll', () => {
    it('should return paginated contacts', async () => {
      const contacts = [mockContact];
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue(contacts);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(tenantId);

      expect(result.data).toEqual(contacts);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter contacts by search term', async () => {
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([mockContact]);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(tenantId, { search: 'John' });

      expect(prismaService.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            OR: expect.arrayContaining([
              { name: { contains: 'John', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should filter contacts by tag IDs', async () => {
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([mockContact]);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(tenantId, { tagIds: ['tag-1', 'tag-2'] });

      expect(prismaService.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: {
              some: {
                tagId: { in: ['tag-1', 'tag-2'] },
              },
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a contact by id', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.findOne('contact-123', tenantId);

      expect(result).toEqual(mockContact);
    });

    it('should throw NotFoundException if contact not found', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('invalid-id', tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByPhone', () => {
    it('should find contact by phone number', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.findByPhone('+1234567890', tenantId);

      expect(result).toEqual(mockContact);
      expect(prismaService.contact.findFirst).toHaveBeenCalledWith({
        where: { phone: '+1234567890', tenantId },
      });
    });
  });

  describe('findByWhatsAppId', () => {
    it('should find contact by WhatsApp ID', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.findByWhatsAppId('wa-123', tenantId);

      expect(result).toEqual(mockContact);
      expect(prismaService.contact.findFirst).toHaveBeenCalledWith({
        where: { whatsappId: 'wa-123', tenantId },
      });
    });
  });

  describe('create', () => {
    it('should create a new contact', async () => {
      (prismaService.contact.create as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.create(tenantId, {
        phone: '+1234567890',
        name: 'John Doe',
        email: 'john@example.com',
      });

      expect(result).toEqual(mockContact);
      expect(prismaService.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phone: '+1234567890',
          name: 'John Doe',
          email: 'john@example.com',
          tenantId,
        }),
      });
    });
  });

  describe('update', () => {
    it('should update an existing contact', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prismaService.contact.update as jest.Mock).mockResolvedValue({
        ...mockContact,
        name: 'Jane Doe',
      });

      const result = await service.update('contact-123', tenantId, {
        name: 'Jane Doe',
      });

      expect(result.name).toBe('Jane Doe');
    });

    it('should throw NotFoundException if contact not found', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('invalid-id', tenantId, { name: 'Jane Doe' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a contact', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prismaService.contact.delete as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.delete('contact-123', tenantId);

      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException if contact not found', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('invalid-id', tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addTags', () => {
    it('should add tags to a contact', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prismaService.contactTag.createMany as jest.Mock).mockResolvedValue({ count: 2 });

      const result = await service.addTags('contact-123', tenantId, ['tag-1', 'tag-2']);

      expect(prismaService.contactTag.createMany).toHaveBeenCalledWith({
        data: [
          { contactId: 'contact-123', tagId: 'tag-1' },
          { contactId: 'contact-123', tagId: 'tag-2' },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('removeTags', () => {
    it('should remove tags from a contact', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prismaService.contactTag.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      await service.removeTags('contact-123', tenantId, ['tag-1', 'tag-2']);

      expect(prismaService.contactTag.deleteMany).toHaveBeenCalledWith({
        where: {
          contactId: 'contact-123',
          tagId: { in: ['tag-1', 'tag-2'] },
        },
      });
    });
  });

  describe('findOrCreate', () => {
    it('should return existing contact if found', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.findOrCreate(tenantId, 'wa-123', '+1234567890', 'John');

      expect(result).toEqual(mockContact);
      expect(prismaService.contact.create).not.toHaveBeenCalled();
    });

    it('should create new contact if not found', async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.contact.create as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.findOrCreate(tenantId, 'wa-123', '+1234567890', 'John');

      expect(result).toEqual(mockContact);
      expect(prismaService.contact.create).toHaveBeenCalled();
    });
  });

  describe('importFromCsv', () => {
    it('should import contacts from CSV buffer', async () => {
      const csvContent = 'phone,name,email\n+1234567890,John Doe,john@example.com';
      const buffer = Buffer.from(csvContent);

      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.contact.create as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.importFromCsv(tenantId, buffer, {
        phoneColumn: 0,
        nameColumn: 1,
        emailColumn: 2,
      });

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should handle invalid phone numbers', async () => {
      const csvContent = 'phone,name\n123,Invalid User';
      const buffer = Buffer.from(csvContent);

      const result = await service.importFromCsv(tenantId, buffer, {
        phoneColumn: 0,
        nameColumn: 1,
      });

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('Invalid phone number format');
    });
  });

  describe('exportToCsv', () => {
    it('should export contacts to CSV', async () => {
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([
        { ...mockContact, tags: [] },
      ]);

      const result = await service.exportToCsv(tenantId);

      expect(result.content).toContain('phone,name,email,tags,created_at');
      expect(result.content).toContain('+1234567890');
      expect(result.filename).toMatch(/contacts-export-\d{4}-\d{2}-\d{2}\.csv/);
    });
  });
});
