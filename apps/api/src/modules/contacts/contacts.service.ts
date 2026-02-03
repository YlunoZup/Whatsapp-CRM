import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WhatsAppService } from '../../common/whatsapp/whatsapp.service';
import { AuditService, AuditActions } from '../../common/audit/audit.service';

// Session binding conflict response
export interface SessionConflictResult {
  hasConflict: boolean;
  contact?: {
    id: string;
    name: string | null;
    phone: string;
  };
  currentSession?: {
    id: string;
    name: string;
    phoneNumber: string | null;
  };
  requestedSession?: {
    id: string;
    name: string;
    phoneNumber: string | null;
  };
  lockedAt?: Date;
  message?: string;
}

interface CreateContactDto {
  phone: string;
  name?: string;
  email?: string;
  whatsappId?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
  validateWhatsApp?: boolean; // If true, validate phone with WhatsApp
}

interface UpdateContactDto {
  name?: string;
  email?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

interface FindAllOptions {
  search?: string;
  tagIds?: string[];
  status?: string;
  page?: number;
  limit?: number;
}

// Lead pipeline status constants
export const LEAD_STATUSES = {
  NEW: 'new',
  CONTACTED: 'contacted',
  INTERESTED: 'interested',
  NOT_INTERESTED: 'not_interested',
  CLOSED_WON: 'closed_won',
  CLOSED_LOST: 'closed_lost',
} as const;

export type LeadStatus = typeof LEAD_STATUSES[keyof typeof LEAD_STATUSES];

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenantId: string, options: FindAllOptions = {}) {
    const { search, tagIds, status } = options;
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tagIds && tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: { in: tagIds },
        },
      };
    }

    if (status) {
      where.status = status;
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          assignedSession: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async findByPhone(phone: string, tenantId: string) {
    return this.prisma.contact.findFirst({
      where: { phone, tenantId },
    });
  }

  async findByWhatsAppId(whatsappId: string, tenantId: string) {
    return this.prisma.contact.findFirst({
      where: { whatsappId, tenantId },
    });
  }

  async create(tenantId: string, dto: CreateContactDto, userId?: string) {
    let whatsappId = dto.whatsappId;

    // If validateWhatsApp is true (or not specified), try to validate with WhatsApp
    if (dto.validateWhatsApp !== false && !whatsappId) {
      const connectedSessions = this.whatsappService.getConnectedSessions();

      if (connectedSessions.length > 0) {
        // Use the first connected session to validate
        const sessionId = connectedSessions[0];
        try {
          this.logger.log(`Validating phone ${dto.phone} with WhatsApp...`);
          const result = await this.whatsappService.checkNumberOnWhatsApp(sessionId, dto.phone);

          if (result.exists && result.jid) {
            whatsappId = result.jid;
            this.logger.log(`Phone ${dto.phone} found on WhatsApp with JID: ${whatsappId}`);
          } else {
            this.logger.log(`Phone ${dto.phone} not found on WhatsApp`);
          }
        } catch (error) {
          this.logger.warn(`Failed to validate phone with WhatsApp: ${error}`);
          // Continue without whatsappId - it will be set when first message is sent
        }
      }
    }

    // Check if a contact with this whatsappId already exists
    if (whatsappId) {
      const existing = await this.prisma.contact.findFirst({
        where: { tenantId, whatsappId },
      });
      if (existing) {
        this.logger.log(`Contact with whatsappId ${whatsappId} already exists, returning existing contact`);
        // Update the existing contact with new info if provided
        return this.prisma.contact.update({
          where: { id: existing.id },
          data: {
            name: dto.name || existing.name,
            email: dto.email || existing.email,
            phone: dto.phone || existing.phone,
          },
        });
      }
    }

    // Also check by phone number to prevent duplicates
    const normalizedPhone = dto.phone.replace(/\D/g, '');
    const existingByPhone = await this.prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [
          { phone: dto.phone },
          { phone: normalizedPhone },
          { phone: `+${normalizedPhone}` },
        ],
      },
    });

    if (existingByPhone) {
      this.logger.log(`Contact with phone ${dto.phone} already exists, updating with whatsappId`);
      return this.prisma.contact.update({
        where: { id: existingByPhone.id },
        data: {
          name: dto.name || existingByPhone.name,
          email: dto.email || existingByPhone.email,
          whatsappId: whatsappId || existingByPhone.whatsappId,
        },
      });
    }

    const contact = await this.prisma.contact.create({
      data: {
        phone: dto.phone,
        name: dto.name,
        email: dto.email,
        avatarUrl: dto.avatarUrl,
        metadata: dto.metadata as any,
        whatsappId,
        tenantId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACT_CREATED,
      resource: 'contact',
      resourceId: contact.id,
      metadata: { contactId: contact.id, name: contact.name },
    });

    return contact;
  }

  async update(id: string, tenantId: string, dto: UpdateContactDto, userId?: string) {
    await this.findOne(id, tenantId);

    const contact = await this.prisma.contact.update({
      where: { id },
      data: dto as any,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACT_UPDATED,
      resource: 'contact',
      resourceId: id,
      metadata: { contactId: id, changedFields: Object.keys(dto) },
    });

    return contact;
  }

  async delete(id: string, tenantId: string, userId?: string) {
    await this.findOne(id, tenantId);

    await this.prisma.contact.delete({
      where: { id },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACT_DELETED,
      resource: 'contact',
      resourceId: id,
      metadata: { contactId: id },
    });

    return { success: true };
  }

  async addTags(id: string, tenantId: string, tagIds: string[]) {
    await this.findOne(id, tenantId);

    await this.prisma.contactTag.createMany({
      data: tagIds.map((tagId) => ({
        contactId: id,
        tagId,
      })),
      skipDuplicates: true,
    });

    return this.findOne(id, tenantId);
  }

  async removeTags(id: string, tenantId: string, tagIds: string[]) {
    await this.findOne(id, tenantId);

    await this.prisma.contactTag.deleteMany({
      where: {
        contactId: id,
        tagId: { in: tagIds },
      },
    });

    return this.findOne(id, tenantId);
  }

  async findOrCreate(tenantId: string, whatsappId: string, phone: string, name?: string) {
    // Use transaction with retry to handle race conditions atomically
    return this.prisma.$transaction(async (tx) => {
      // Try to find existing contact
      let contact = await tx.contact.findFirst({
        where: {
          tenantId,
          OR: [
            { whatsappId },
            { phone },
          ],
        },
        include: {
          tags: { include: { tag: true } },
        },
      });

      if (contact) {
        // Update whatsappId if not set
        if (!contact.whatsappId && whatsappId) {
          contact = await tx.contact.update({
            where: { id: contact.id },
            data: { whatsappId },
            include: { tags: { include: { tag: true } } },
          });
        }
        return contact;
      }

      // Create new contact
      try {
        return await tx.contact.create({
          data: {
            tenantId,
            whatsappId,
            phone,
            name: name || phone,
          },
          include: {
            tags: { include: { tag: true } },
          },
        });
      } catch (error: any) {
        // Handle unique constraint violation (race condition - another request created it)
        if (error.code === 'P2002') {
          const existing = await tx.contact.findFirst({
            where: {
              tenantId,
              OR: [{ whatsappId }, { phone }],
            },
            include: { tags: { include: { tag: true } } },
          });
          if (existing) return existing;
        }
        throw error;
      }
    });
  }

  async importFromCsv(
    tenantId: string,
    buffer: Buffer,
    options: {
      phoneColumn: number;
      nameColumn?: number;
      emailColumn?: number;
      // Extended metadata fields
      companyColumn?: number;
      jobTitleColumn?: number;
      websiteColumn?: number;
      addressColumn?: number;
      cityColumn?: number;
      countryColumn?: number;
      sourceColumn?: number;
      notesColumn?: number;
      // Import options
      importMode?: 'create' | 'update' | 'createOrUpdate';
      skipEmptyValues?: boolean;
      tagIds?: string[];
      sessionId?: string;
    },
    userId?: string,
  ) {
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    // Skip header row
    const dataRows = lines.slice(1);

    const importMode = options.importMode || 'createOrUpdate';
    const skipEmptyValues = options.skipEmptyValues ?? true;

    const results = {
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      errors: [] as Array<{ row: number; phone: string; error: string }>,
    };

    // Helper to get cell value, respecting skipEmptyValues
    const getCellValue = (cells: string[], columnIndex?: number): string | undefined => {
      if (columnIndex === undefined || columnIndex === -1) return undefined;
      const value = cells[columnIndex]?.trim();
      return value || undefined;
    };

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const cells = this.parseCsvRow(row);

      const phone = getCellValue(cells, options.phoneColumn);
      const name = getCellValue(cells, options.nameColumn);
      const email = getCellValue(cells, options.emailColumn);

      // Get metadata fields
      const company = getCellValue(cells, options.companyColumn);
      const jobTitle = getCellValue(cells, options.jobTitleColumn);
      const website = getCellValue(cells, options.websiteColumn);
      const address = getCellValue(cells, options.addressColumn);
      const city = getCellValue(cells, options.cityColumn);
      const country = getCellValue(cells, options.countryColumn);
      const source = getCellValue(cells, options.sourceColumn);
      const notes = getCellValue(cells, options.notesColumn);

      if (!phone) {
        results.failed++;
        results.errors.push({
          row: i + 2, // +2 because 1-indexed and skip header
          phone: phone || 'empty',
          error: 'Phone number is required',
        });
        continue;
      }

      // Validate phone format (basic validation)
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      if (cleanPhone.length < 8) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          phone,
          error: 'Invalid phone number format',
        });
        continue;
      }

      try {
        // Check if contact already exists
        const existing = await this.findByPhone(cleanPhone, tenantId);

        // Build metadata object
        const metadata: Record<string, unknown> = {};
        if (company) metadata.company = company;
        if (jobTitle) metadata.jobTitle = jobTitle;
        if (website) metadata.website = website;
        if (address) metadata.address = address;
        if (city) metadata.city = city;
        if (country) metadata.country = country;
        if (source) metadata.source = source;
        if (notes) metadata.notes = notes;

        let contactId: string;

        if (existing) {
          // Skip if mode is 'create' only
          if (importMode === 'create') {
            results.failed++;
            results.errors.push({
              row: i + 2,
              phone,
              error: 'Contact already exists (create mode)',
            });
            continue;
          }

          // Update existing contact
          const updateData: Record<string, unknown> = {};

          // Handle basic fields
          if (skipEmptyValues) {
            if (name) updateData.name = name;
            if (email) updateData.email = email;
          } else {
            updateData.name = name || existing.name;
            updateData.email = email || existing.email;
          }

          // Merge metadata
          const existingMetadata = (existing.metadata as Record<string, unknown>) || {};
          const mergedMetadata = skipEmptyValues
            ? { ...existingMetadata, ...metadata }
            : { ...existingMetadata, ...metadata }; // Overwrite with new values

          if (Object.keys(mergedMetadata).length > 0) {
            updateData.metadata = mergedMetadata;
          }

          // Update session if provided
          if (options.sessionId) {
            updateData.assignedSessionId = options.sessionId;
          }

          await this.prisma.contact.update({
            where: { id: existing.id },
            data: updateData,
          });

          contactId = existing.id;
          results.updated++;
        } else {
          // Skip if mode is 'update' only
          if (importMode === 'update') {
            results.failed++;
            results.errors.push({
              row: i + 2,
              phone,
              error: 'Contact not found (update mode)',
            });
            continue;
          }

          // Create new contact
          const createData: Record<string, unknown> = {
            tenantId,
            phone: cleanPhone,
            name,
            email,
          };

          if (Object.keys(metadata).length > 0) {
            createData.metadata = metadata;
          }

          if (options.sessionId) {
            createData.assignedSessionId = options.sessionId;
          }

          const newContact = await this.prisma.contact.create({
            data: createData as any,
          });

          contactId = newContact.id;
          results.created++;
        }

        // Assign tags if provided
        if (options.tagIds && options.tagIds.length > 0 && contactId) {
          for (const tagId of options.tagIds) {
            try {
              await this.prisma.contactTag.upsert({
                where: {
                  contactId_tagId: {
                    contactId,
                    tagId,
                  },
                },
                update: {},
                create: {
                  contactId,
                  tagId,
                },
              });
            } catch (tagError) {
              // Ignore tag assignment errors, contact was still imported
              this.logger.warn(`Failed to assign tag ${tagId} to contact ${contactId}: ${tagError}`);
            }
          }
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          phone,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACTS_IMPORTED,
      resource: 'contacts',
      metadata: {
        created: results.created,
        updated: results.updated,
        failed: results.failed,
        success: results.success,
      },
    });

    return results;
  }

  private parseCsvRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of row) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  async exportToCsv(tenantId: string, userId?: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId },
      include: {
        tags: {
          include: { tag: true },
        },
        assignedSession: {
          select: { name: true, phoneNumber: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const lines: string[] = [];
    // Header includes all fields that can be imported
    lines.push('phone,name,email,company,job_title,website,address,city,country,source,notes,tags,assigned_session,created_at');

    const escapeCsvField = (field: string | null | undefined) => {
      if (!field) return '';
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    for (const contact of contacts) {
      const tags = contact.tags.map((t) => t.tag.name).join(';');
      const metadata = (contact.metadata as Record<string, unknown>) || {};
      const sessionName = contact.assignedSession?.name || '';

      lines.push([
        escapeCsvField(contact.phone),
        escapeCsvField(contact.name),
        escapeCsvField(contact.email),
        escapeCsvField(metadata.company as string),
        escapeCsvField(metadata.jobTitle as string),
        escapeCsvField(metadata.website as string),
        escapeCsvField(metadata.address as string),
        escapeCsvField(metadata.city as string),
        escapeCsvField(metadata.country as string),
        escapeCsvField(metadata.source as string),
        escapeCsvField(metadata.notes as string),
        escapeCsvField(tags),
        escapeCsvField(sessionName),
        contact.createdAt.toISOString(),
      ].join(','));
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACTS_EXPORTED,
      resource: 'contacts',
      metadata: { count: contacts.length },
    });

    return {
      content: lines.join('\n'),
      filename: `contacts-export-${new Date().toISOString().split('T')[0]}.csv`,
    };
  }

  /**
   * Check if there's a session conflict when trying to message a contact from a different session
   * This implements the GoHighLevel-style session binding - once a session contacts someone,
   * only that session can message them unless explicitly overridden.
   */
  async checkSessionConflict(
    contactId: string,
    sessionId: string,
    tenantId: string,
  ): Promise<SessionConflictResult> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: {
        assignedSession: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // No assigned session - no conflict
    if (!contact.assignedSessionId) {
      return { hasConflict: false };
    }

    // Same session - no conflict
    if (contact.assignedSessionId === sessionId) {
      return { hasConflict: false };
    }

    // Different session - CONFLICT!
    const requestedSession = await this.prisma.whatsappSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
      },
    });

    return {
      hasConflict: true,
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
      },
      currentSession: contact.assignedSession ? {
        id: contact.assignedSession.id,
        name: contact.assignedSession.name,
        phoneNumber: contact.assignedSession.phoneNumber,
      } : undefined,
      requestedSession: requestedSession ? {
        id: requestedSession.id,
        name: requestedSession.name,
        phoneNumber: requestedSession.phoneNumber,
      } : undefined,
      lockedAt: contact.sessionLockedAt || undefined,
      message: `This contact is already assigned to session "${contact.assignedSession?.name || 'Unknown'}" (${contact.assignedSession?.phoneNumber || 'No number'}). Only that session can message this contact. To change, you must reassign the contact.`,
    };
  }

  /**
   * Assign a contact to a session - this is called when first messaging a contact
   * or when explicitly reassigning
   */
  async assignToSession(
    contactId: string,
    sessionId: string,
    tenantId: string,
    force: boolean = false,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: {
        assignedSession: {
          select: { id: true, name: true },
        },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Check for conflict if not forcing
    if (!force && contact.assignedSessionId && contact.assignedSessionId !== sessionId) {
      throw new BadRequestException(
        `Contact is already assigned to session "${contact.assignedSession?.name}". Use force=true to reassign.`,
      );
    }

    // Verify session exists
    const session = await this.prisma.whatsappSession.findFirst({
      where: { id: sessionId, tenantId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Assign the session
    const updated = await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        assignedSessionId: sessionId,
        sessionLockedAt: new Date(),
      },
      include: {
        assignedSession: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
      },
    });

    this.logger.log(
      `Contact ${contact.id} (${contact.phone}) assigned to session ${session.id} (${session.name})${force ? ' [FORCED]' : ''}`,
    );

    return updated;
  }

  /**
   * Remove session assignment from a contact
   */
  async unassignFromSession(contactId: string, tenantId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const updated = await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        assignedSessionId: null,
        sessionLockedAt: null,
      },
    });

    this.logger.log(`Contact ${contact.id} (${contact.phone}) unassigned from session`);

    return updated;
  }

  /**
   * Get all contacts assigned to a specific session
   */
  async getContactsBySession(sessionId: string, tenantId: string) {
    return this.prisma.contact.findMany({
      where: {
        tenantId,
        assignedSessionId: sessionId,
      },
      orderBy: { name: 'asc' },
    });
  }

  // ============================================
  // BULK ACTION METHODS
  // ============================================

  /**
   * Add tags to multiple contacts (optimized batch operation)
   */
  async bulkAddTags(tenantId: string, contactIds: string[], tagIds: string[], userId?: string) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    // Batch verify all contacts belong to tenant in a single query
    const validContacts = await this.prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        tenantId,
      },
      select: { id: true },
    });

    const validContactIds = new Set(validContacts.map(c => c.id));
    const invalidContactIds = contactIds.filter(id => !validContactIds.has(id));

    // Mark invalid contacts as failed
    for (const id of invalidContactIds) {
      results.failed++;
      results.errors.push({ id, error: 'Contact not found' });
    }

    // Build all tag assignments at once
    const tagAssignments: Array<{ contactId: string; tagId: string }> = [];
    for (const contactId of validContactIds) {
      for (const tagId of tagIds) {
        tagAssignments.push({ contactId, tagId });
      }
    }

    // Batch create tags (skipDuplicates handles existing ones)
    if (tagAssignments.length > 0) {
      try {
        await this.prisma.contactTag.createMany({
          data: tagAssignments,
          skipDuplicates: true,
        });
        results.success = validContactIds.size;
      } catch (error) {
        // If batch fails, mark all as failed
        for (const contactId of validContactIds) {
          results.failed++;
          results.errors.push({
            id: contactId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        results.success = 0;
      }
    }

    // Get tag names for audit log
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { name: true },
    });
    const tagNames = tags.map((t) => t.name);

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACTS_BULK_TAGS_ADDED,
      resource: 'contacts',
      metadata: {
        count: results.success,
        failed: results.failed,
        tagNames,
      },
    });

    return results;
  }

  /**
   * Remove tags from multiple contacts (optimized batch operation)
   */
  async bulkRemoveTags(tenantId: string, contactIds: string[], tagIds: string[], userId?: string) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    // Batch verify all contacts belong to tenant
    const validContacts = await this.prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        tenantId,
      },
      select: { id: true },
    });

    const validContactIds = new Set(validContacts.map(c => c.id));
    const invalidContactIds = contactIds.filter(id => !validContactIds.has(id));

    // Mark invalid contacts as failed
    for (const id of invalidContactIds) {
      results.failed++;
      results.errors.push({ id, error: 'Contact not found' });
    }

    // Batch delete all tag assignments in a single query
    if (validContactIds.size > 0) {
      try {
        await this.prisma.contactTag.deleteMany({
          where: {
            contactId: { in: Array.from(validContactIds) },
            tagId: { in: tagIds },
          },
        });
        results.success = validContactIds.size;
      } catch (error) {
        for (const contactId of validContactIds) {
          results.failed++;
          results.errors.push({
            id: contactId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        results.success = 0;
      }
    }

    // Get tag names for audit log
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { name: true },
    });
    const tagNames = tags.map((t) => t.name);

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACTS_BULK_TAGS_REMOVED,
      resource: 'contacts',
      metadata: {
        count: results.success,
        failed: results.failed,
        tagNames,
      },
    });

    return results;
  }

  /**
   * Assign multiple contacts to a session (optimized batch operation)
   */
  async bulkAssignSession(tenantId: string, contactIds: string[], sessionId: string, userId?: string) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    // Verify session exists and belongs to tenant
    const session = await this.prisma.whatsappSession.findFirst({
      where: { id: sessionId, tenantId },
    });

    if (!session) {
      return {
        success: 0,
        failed: contactIds.length,
        errors: contactIds.map(id => ({ id, error: 'Session not found' })),
      };
    }

    // Batch verify all contacts belong to tenant
    const validContacts = await this.prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        tenantId,
      },
      select: { id: true },
    });

    const validContactIds = new Set(validContacts.map(c => c.id));
    const invalidContactIds = contactIds.filter(id => !validContactIds.has(id));

    // Mark invalid contacts as failed
    for (const id of invalidContactIds) {
      results.failed++;
      results.errors.push({ id, error: 'Contact not found' });
    }

    // Batch update all valid contacts in a single query
    if (validContactIds.size > 0) {
      try {
        await this.prisma.contact.updateMany({
          where: {
            id: { in: Array.from(validContactIds) },
            tenantId, // Extra safety check
          },
          data: {
            assignedSessionId: sessionId,
            sessionLockedAt: new Date(),
          },
        });
        results.success = validContactIds.size;
      } catch (error) {
        for (const contactId of validContactIds) {
          results.failed++;
          results.errors.push({
            id: contactId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        results.success = 0;
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACTS_BULK_SESSION_ASSIGNED,
      resource: 'contacts',
      metadata: {
        count: results.success,
        failed: results.failed,
        sessionName: session.name,
        sessionId: session.id,
      },
    });

    return results;
  }

  /**
   * Delete multiple contacts
   */
  async bulkDelete(tenantId: string, contactIds: string[], userId?: string) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    for (const contactId of contactIds) {
      try {
        // Verify contact belongs to tenant and delete
        const contact = await this.prisma.contact.findFirst({
          where: { id: contactId, tenantId },
        });

        if (!contact) {
          results.failed++;
          results.errors.push({ id: contactId, error: 'Contact not found' });
          continue;
        }

        // Delete related records first
        await this.prisma.contactTag.deleteMany({
          where: { contactId },
        });

        await this.prisma.contact.delete({
          where: { id: contactId },
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          id: contactId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACTS_BULK_DELETED,
      resource: 'contacts',
      metadata: {
        count: results.success,
        failed: results.failed,
      },
    });

    return results;
  }

  /**
   * Bulk edit multiple contacts with the same field values
   */
  async bulkEdit(
    tenantId: string,
    contactIds: string[],
    updates: {
      name?: string;
      email?: string;
      metadata?: Record<string, unknown>;
    },
    userId?: string,
  ) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email;

    for (const contactId of contactIds) {
      try {
        const contact = await this.prisma.contact.findFirst({
          where: { id: contactId, tenantId },
        });

        if (!contact) {
          results.failed++;
          results.errors.push({ id: contactId, error: 'Contact not found' });
          continue;
        }

        // Handle metadata merge
        const finalData = { ...updateData };
        if (updates.metadata) {
          const existingMetadata = (contact.metadata as Record<string, unknown>) || {};
          finalData.metadata = { ...existingMetadata, ...updates.metadata };
        }

        await this.prisma.contact.update({
          where: { id: contactId },
          data: finalData,
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          id: contactId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACTS_BULK_EDITED,
      resource: 'contacts',
      metadata: {
        count: results.success,
        failed: results.failed,
        changedFields: Object.keys(updates),
      },
    });

    return results;
  }

  /**
   * Merge multiple contacts into a master record (GoHighLevel-style)
   * Max 10 contacts can be merged at once
   * Master record keeps: conversations, tags, last activity, files
   */
  async mergeContacts(
    tenantId: string,
    masterContactId: string,
    mergeContactIds: string[],
    userId?: string,
  ) {
    // Validate max 10 contacts
    const allContactIds = [masterContactId, ...mergeContactIds];
    if (allContactIds.length > 10) {
      throw new BadRequestException('Cannot merge more than 10 contacts at once');
    }

    if (mergeContactIds.length === 0) {
      throw new BadRequestException('At least one contact must be selected to merge');
    }

    // Verify all contacts exist and belong to tenant
    const contacts = await this.prisma.contact.findMany({
      where: {
        id: { in: allContactIds },
        tenantId,
      },
      include: {
        tags: { include: { tag: true } },
        conversations: true,
      },
    });

    if (contacts.length !== allContactIds.length) {
      throw new BadRequestException('One or more contacts not found');
    }

    const masterContact = contacts.find(c => c.id === masterContactId);
    if (!masterContact) {
      throw new BadRequestException('Master contact not found');
    }

    const mergeContacts = contacts.filter(c => c.id !== masterContactId);

    // Collect all unique tags from merge contacts
    const masterTagIds = new Set(masterContact.tags.map(t => t.tagId));
    const allTagIds = new Set<string>();

    mergeContacts.forEach(contact => {
      contact.tags.forEach(t => {
        if (!masterTagIds.has(t.tagId)) {
          allTagIds.add(t.tagId);
        }
      });
    });

    // Merge metadata from all contacts (master's values take precedence)
    let mergedMetadata = (masterContact.metadata as Record<string, unknown>) || {};
    for (const contact of mergeContacts) {
      const contactMetadata = (contact.metadata as Record<string, unknown>) || {};
      // Only add fields that don't exist in master
      for (const [key, value] of Object.entries(contactMetadata)) {
        if (mergedMetadata[key] === undefined || mergedMetadata[key] === null || mergedMetadata[key] === '') {
          mergedMetadata[key] = value;
        }
      }
    }

    // Track merged contact info for audit
    const mergedContactInfo = mergeContacts.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
    }));

    // Start transaction for merge
    await this.prisma.$transaction(async (tx) => {
      // 1. Transfer all conversations to master contact
      for (const contact of mergeContacts) {
        await tx.conversation.updateMany({
          where: { contactId: contact.id },
          data: { contactId: masterContactId },
        });
      }

      // 2. Add tags from merged contacts to master
      for (const tagId of allTagIds) {
        await tx.contactTag.upsert({
          where: {
            contactId_tagId: { contactId: masterContactId, tagId },
          },
          update: {},
          create: { contactId: masterContactId, tagId },
        });
      }

      // 3. Update master contact with merged metadata
      // Fill in missing fields from merged contacts
      const masterName = masterContact.name || mergeContacts.find(c => c.name)?.name;
      const masterEmail = masterContact.email || mergeContacts.find(c => c.email)?.email;
      const masterAvatarUrl = masterContact.avatarUrl || mergeContacts.find(c => c.avatarUrl)?.avatarUrl;

      await tx.contact.update({
        where: { id: masterContactId },
        data: {
          name: masterName,
          email: masterEmail,
          avatarUrl: masterAvatarUrl,
          metadata: mergedMetadata as any,
          updatedAt: new Date(),
        },
      });

      // 4. Delete tags from merged contacts
      await tx.contactTag.deleteMany({
        where: { contactId: { in: mergeContactIds } },
      });

      // 5. Delete merged contacts
      await tx.contact.deleteMany({
        where: { id: { in: mergeContactIds } },
      });
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACTS_MERGED,
      resource: 'contacts',
      resourceId: masterContactId,
      metadata: {
        masterContact: {
          id: masterContact.id,
          name: masterContact.name,
          phone: masterContact.phone,
        },
        mergedContacts: mergedContactInfo,
        totalMerged: mergeContactIds.length,
      },
    });

    // Return the updated master contact
    return this.findOne(masterContactId, tenantId);
  }

  /**
   * Find potential duplicate contacts based on phone or email
   */
  async findDuplicates(tenantId: string, contactIds: string[]) {
    const contacts = await this.prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        tenantId,
      },
      include: {
        tags: { include: { tag: true } },
        assignedSession: {
          select: { id: true, name: true, phoneNumber: true },
        },
        conversations: {
          select: { id: true },
        },
      },
    });

    return contacts.map(contact => ({
      ...contact,
      conversationCount: contact.conversations.length,
    }));
  }

  /**
   * Export selected contacts to CSV
   */
  async exportSelectedToCsv(tenantId: string, contactIds: string[], userId?: string) {
    const contacts = await this.prisma.contact.findMany({
      where: {
        tenantId,
        id: { in: contactIds },
      },
      include: {
        tags: {
          include: { tag: true },
        },
        assignedSession: {
          select: { name: true, phoneNumber: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const lines: string[] = [];
    lines.push('phone,name,email,company,job_title,website,address,city,country,source,notes,tags,assigned_session,created_at');

    const escapeCsvField = (field: string | null | undefined) => {
      if (!field) return '';
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    for (const contact of contacts) {
      const tags = contact.tags.map((t) => t.tag.name).join(';');
      const metadata = (contact.metadata as Record<string, unknown>) || {};
      const sessionName = contact.assignedSession?.name || '';

      lines.push([
        escapeCsvField(contact.phone),
        escapeCsvField(contact.name),
        escapeCsvField(contact.email),
        escapeCsvField(metadata.company as string),
        escapeCsvField(metadata.jobTitle as string),
        escapeCsvField(metadata.website as string),
        escapeCsvField(metadata.address as string),
        escapeCsvField(metadata.city as string),
        escapeCsvField(metadata.country as string),
        escapeCsvField(metadata.source as string),
        escapeCsvField(metadata.notes as string),
        escapeCsvField(tags),
        escapeCsvField(sessionName),
        contact.createdAt.toISOString(),
      ].join(','));
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: AuditActions.CONTACTS_BULK_EXPORTED,
      resource: 'contacts',
      metadata: { count: contacts.length },
    });

    return {
      content: lines.join('\n'),
      filename: `contacts-export-${new Date().toISOString().split('T')[0]}.csv`,
    };
  }

  // ============================================
  // LEAD PIPELINE STATUS METHODS
  // ============================================

  /**
   * Update the status of a single contact
   */
  async updateContactStatus(
    contactId: string,
    tenantId: string,
    status: LeadStatus,
    userId?: string,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const previousStatus = contact.status;

    const updated = await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        status,
        statusChangedAt: new Date(),
      },
      include: {
        tags: {
          include: { tag: true },
        },
        assignedSession: {
          select: { id: true, name: true, phoneNumber: true },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'contact.status_changed',
      resource: 'contact',
      resourceId: contactId,
      metadata: {
        contactId,
        contactName: contact.name,
        previousStatus,
        newStatus: status,
      },
    });

    this.logger.log(`Contact ${contactId} status changed from ${previousStatus} to ${status}`);

    return updated;
  }

  /**
   * Bulk update status of multiple contacts (optimized batch operation)
   */
  async bulkUpdateStatus(
    tenantId: string,
    contactIds: string[],
    status: LeadStatus,
    userId?: string,
  ) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    // Batch verify all contacts belong to tenant
    const validContacts = await this.prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        tenantId,
      },
      select: { id: true },
    });

    const validContactIds = new Set(validContacts.map(c => c.id));
    const invalidContactIds = contactIds.filter(id => !validContactIds.has(id));

    // Mark invalid contacts as failed
    for (const id of invalidContactIds) {
      results.failed++;
      results.errors.push({ id, error: 'Contact not found' });
    }

    // Batch update all valid contacts in a single query
    if (validContactIds.size > 0) {
      try {
        await this.prisma.contact.updateMany({
          where: {
            id: { in: Array.from(validContactIds) },
            tenantId, // Extra safety check
          },
          data: {
            status,
            statusChangedAt: new Date(),
          },
        });
        results.success = validContactIds.size;
      } catch (error) {
        for (const contactId of validContactIds) {
          results.failed++;
          results.errors.push({
            id: contactId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        results.success = 0;
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'contacts.bulk.status_changed',
      resource: 'contacts',
      metadata: {
        count: results.success,
        failed: results.failed,
        newStatus: status,
      },
    });

    return results;
  }

  /**
   * Get counts of contacts by status for pipeline analytics
   */
  async getStatusCounts(tenantId: string) {
    const counts = await this.prisma.contact.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    const statusCounts: Record<string, number> = {
      [LEAD_STATUSES.NEW]: 0,
      [LEAD_STATUSES.CONTACTED]: 0,
      [LEAD_STATUSES.INTERESTED]: 0,
      [LEAD_STATUSES.NOT_INTERESTED]: 0,
      [LEAD_STATUSES.CLOSED_WON]: 0,
      [LEAD_STATUSES.CLOSED_LOST]: 0,
    };

    for (const item of counts) {
      statusCounts[item.status] = item._count.id;
    }

    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    return {
      counts: statusCounts,
      total,
    };
  }
}
