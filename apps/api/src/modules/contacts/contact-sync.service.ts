import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * ContactSyncService handles synchronization of contact metadata from WhatsApp.
 *
 * Responsible for:
 * - Syncing contact names from pushName
 * - Updating presence status
 * - Storing contact metadata (avatar, about, etc.)
 * - Handling contact creation from various sources
 */
@Injectable()
export class ContactSyncService {
  private readonly logger = new Logger(ContactSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sync contact metadata from incoming message or event.
   * Updates contact name, presence, and other metadata.
   */
  async syncContactMetadata(
    tenantId: string,
    contactId: string,
    metadata: {
      pushName?: string;
      phoneNumber?: string;
      whatsappId?: string;
      avatar?: string;
      about?: string;
      isBot?: boolean;
      isBusinessAccount?: boolean;
    },
  ): Promise<void> {
    try {
      const updates: Record<string, any> = {};

      // Update name if provided and better than current
      if (metadata.pushName) {
        updates.name = metadata.pushName;
      }

      // Update whatsappId if provided
      if (metadata.whatsappId) {
        updates.whatsappId = metadata.whatsappId;
      }

      // Store avatar, about, and other metadata in metadata JSON field
      const metadataUpdates: Record<string, any> = {};
      if (metadata.avatar) {
        metadataUpdates.avatar = metadata.avatar;
      }
      if (metadata.about) {
        metadataUpdates.about = metadata.about;
      }
      if (metadata.isBot !== undefined) {
        metadataUpdates.isBot = metadata.isBot;
      }
      if (metadata.isBusinessAccount !== undefined) {
        metadataUpdates.isBusinessAccount = metadata.isBusinessAccount;
      }

      if (Object.keys(metadataUpdates).length > 0) {
        // Merge with existing metadata
        const contact = await this.prisma.contact.findUnique({
          where: { id: contactId },
          select: { metadata: true },
        });

        // Safely merge metadata (handle both object and non-object cases)
        const existingMetadata = contact?.metadata && typeof contact.metadata === 'object' && !Array.isArray(contact.metadata)
          ? (contact.metadata as Record<string, unknown>)
          : {};

        updates.metadata = {
          ...existingMetadata,
          ...metadataUpdates,
        };
      }

      // Perform update
      if (Object.keys(updates).length > 0) {
        await this.prisma.contact.update({
          where: { id: contactId },
          data: updates,
        });

        this.logger.log(
          `Synced contact ${contactId} metadata: ${JSON.stringify(metadataUpdates)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error syncing contact metadata for ${contactId}: ${error}`,
      );
    }
  }

  /**
   * Update contact presence status (online/offline, typing, etc.)
   */
  async updateContactPresence(
    contactId: string,
    presence: {
      isOnline?: boolean;
      lastPresence?: 'available' | 'composing' | 'recording' | 'paused' | 'unavailable';
      lastSeenAt?: Date;
    },
  ): Promise<void> {
    try {
      const updates: Record<string, any> = {};

      if (presence.isOnline !== undefined) {
        updates.isOnline = presence.isOnline;
      }

      if (presence.lastPresence) {
        updates.lastPresence = presence.lastPresence;
      }

      if (presence.lastSeenAt) {
        updates.lastSeenAt = presence.lastSeenAt;
      }

      if (Object.keys(updates).length > 0) {
        await this.prisma.contact.update({
          where: { id: contactId },
          data: updates,
        });

        this.logger.debug(
          `Updated contact ${contactId} presence: ${JSON.stringify(updates)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating contact presence for ${contactId}: ${error}`,
      );
    }
  }

  /**
   * Find or create contact by phone number.
   * Used when contacts.upsert event is received from WhatsApp.
   */
  async findOrCreateContact(
    tenantId: string,
    phoneNumber: string,
    metadata?: {
      name?: string;
      whatsappId?: string;
      avatar?: string;
      about?: string;
    },
  ) {
    try {
      // Normalize phone number
      const normalizedPhone = phoneNumber.replace(/\D/g, '');

      // Try to find existing contact by phone
      let contact = await this.prisma.contact.findFirst({
        where: {
          tenantId,
          OR: [
            { phone: normalizedPhone },
            { phone: `+${normalizedPhone}` },
            { whatsappId: phoneNumber },
          ],
        },
      });

      // Create if not found
      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            tenantId,
            phone: normalizedPhone,
            whatsappId: metadata?.whatsappId || phoneNumber,
            name: metadata?.name || normalizedPhone,
            metadata: {
              avatar: metadata?.avatar,
              about: metadata?.about,
              createdFrom: 'contact_sync_event',
            },
          },
        });

        this.logger.log(
          `Created contact from sync event: ${contact.id} (phone: ${normalizedPhone}, name: ${metadata?.name})`,
        );
      } else if (metadata) {
        // Update existing contact with new metadata
        await this.syncContactMetadata(tenantId, contact.id, metadata);
      }

      return contact;
    } catch (error) {
      this.logger.error(
        `Error finding or creating contact for ${phoneNumber}: ${error}`,
      );
      return null;
    }
  }

  /**
   * Batch sync contacts from contact list.
   * Called when messaging-history.set provides contact information.
   */
  async batchSyncContacts(
    tenantId: string,
    contacts: Array<{
      id?: string;
      phone?: string;
      name?: string;
      lid?: string;
      avatar?: string;
      about?: string;
    }>,
  ): Promise<number> {
    let synced = 0;

    for (const contactData of contacts) {
      try {
        // Skip if no identifying information
        if (!contactData.phone && !contactData.id && !contactData.lid) {
          continue;
        }

        // Extract phone number
        let phone = contactData.phone;
        if (!phone && contactData.id?.includes('@s.whatsapp.net')) {
          phone = contactData.id;
        }

        if (phone) {
          await this.findOrCreateContact(tenantId, phone, {
            name: contactData.name,
            whatsappId: contactData.id,
            avatar: contactData.avatar,
            about: contactData.about,
          });

          synced++;
        }
      } catch (error) {
        this.logger.error(
          `Error syncing contact ${contactData.phone || contactData.id}: ${error}`,
        );
      }
    }

    if (synced > 0) {
      this.logger.log(`Batch synced ${synced} contacts for tenant ${tenantId}`);
    }

    return synced;
  }
}
