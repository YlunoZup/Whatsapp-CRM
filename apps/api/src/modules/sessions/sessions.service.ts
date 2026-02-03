import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SocketService } from '../../common/socket/socket.service';
import { WhatsAppService } from '../../common/whatsapp/whatsapp.service';
import { SessionLogsService } from './session-logs.service';

interface CreateSessionDto {
  name: string;
  webhookUrl?: string;
  settings?: Record<string, unknown>;
}

interface UpdateSessionDto {
  name?: string;
  webhookUrl?: string;
  settings?: Record<string, unknown>;
}

@Injectable()
export class SessionsService implements OnModuleInit {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
    private readonly whatsappService: WhatsAppService,
    private readonly sessionLogs: SessionLogsService,
  ) {}

  async onModuleInit() {
    // Listen for WhatsApp connection changes
    this.whatsappService.onConnectionChange(async (sessionId, status, qrCode, phoneNumber) => {
      this.logger.log(`WhatsApp status change: ${sessionId} -> ${status}`);

      // Get the session to find tenantId
      const session = await this.prisma.whatsappSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) return;

      // Log the status change
      const prevStatus = session.status;
      if (status === 'connected') {
        await this.sessionLogs.info(sessionId, 'connected', `Session connected successfully`, {
          phoneNumber,
          previousStatus: prevStatus,
        });
      } else if (status === 'disconnected') {
        await this.sessionLogs.warning(sessionId, 'disconnected', `Session disconnected`, {
          previousStatus: prevStatus,
        });
      } else if (status === 'qr_pending') {
        await this.sessionLogs.info(sessionId, 'qr_generated', `QR code generated, waiting for scan`);
      } else if (status === 'connecting') {
        await this.sessionLogs.info(sessionId, 'connecting', `Session connecting...`);
      }

      // Update database
      await this.prisma.whatsappSession.update({
        where: { id: sessionId },
        data: {
          status,
          qrCode: qrCode || null,
          phoneNumber: phoneNumber || session.phoneNumber,
          lastConnectedAt: status === 'connected' ? new Date() : session.lastConnectedAt,
        },
      });

      // Emit socket events
      this.socketService.emitSessionStatusChange(session.tenantId, {
        sessionId,
        status,
        phoneNumber,
      });

      if (qrCode) {
        const QR_EXPIRY_SECONDS = 60;
        const qrGeneratedAt = new Date();
        const expiresAt = new Date(qrGeneratedAt.getTime() + QR_EXPIRY_SECONDS * 1000);

        this.socketService.emitQrCodeUpdate(session.tenantId, {
          sessionId,
          qrCode,
          generatedAt: qrGeneratedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          expirySeconds: QR_EXPIRY_SECONDS,
          remainingSeconds: QR_EXPIRY_SECONDS,
          isExpired: false,
        });
      }
    });

    // Auto-reconnect sessions that were previously connected
    await this.autoReconnectSessions();
  }

  private async autoReconnectSessions() {
    try {
      // Find all sessions that were connected or connecting
      const sessions = await this.prisma.whatsappSession.findMany({
        where: {
          status: { in: ['connected', 'connecting', 'qr_pending'] },
        },
      });

      this.logger.log(`Found ${sessions.length} sessions to auto-reconnect`);

      for (const session of sessions) {
        try {
          this.logger.log(`Auto-reconnecting session: ${session.id} (${session.name})`);

          await this.sessionLogs.info(session.id, 'auto_reconnect_started',
            `Server started, attempting to restore session`, {
              previousStatus: session.status,
              sessionName: session.name,
            });

          // Check if WhatsApp service already has this session connected
          const liveStatus = this.whatsappService.getConnectionStatus(session.id);
          if (liveStatus === 'connected') {
            this.logger.log(`Session ${session.id} is already connected in WhatsApp service`);
            await this.sessionLogs.info(session.id, 'already_connected',
              `Session was already connected, syncing status`);

            // Sync database with actual status
            await this.prisma.whatsappSession.update({
              where: { id: session.id },
              data: { status: 'connected' },
            });
            continue;
          }

          // Update status to connecting
          await this.prisma.whatsappSession.update({
            where: { id: session.id },
            data: { status: 'connecting' },
          });

          // Try to reconnect - this will use saved credentials if available
          const result = await this.whatsappService.connect(session.id);

          // Log the result
          if (result.status === 'connected') {
            await this.sessionLogs.info(session.id, 'auto_reconnect_success',
              `Session restored using saved credentials`);
          } else if (result.status === 'qr_pending') {
            await this.sessionLogs.info(session.id, 'auto_reconnect_qr_needed',
              `Credentials expired, QR code scan required`);
          }
        } catch (error: any) {
          this.logger.error(`Failed to auto-reconnect session ${session.id}: ${error.message}`);

          await this.sessionLogs.error(session.id, 'auto_reconnect_failed',
            `Auto-reconnect failed: ${error.message}`, {
              errorStack: error.stack,
            });

          // Set back to disconnected on failure
          await this.prisma.whatsappSession.update({
            where: { id: session.id },
            data: { status: 'disconnected' },
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Auto-reconnect error: ${error.message}`);
    }
  }

  async findAll(tenantId: string) {
    return this.prisma.whatsappSession.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        status: true,
        lastConnectedAt: true,
        createdAt: true,
        settings: true,
        _count: {
          select: {
            assignedContacts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const session = await this.prisma.whatsappSession.findFirst({
      where: { id, tenantId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async create(tenantId: string, dto: CreateSessionDto) {
    return this.prisma.whatsappSession.create({
      data: {
        tenantId,
        name: dto.name,
        status: 'disconnected',
        webhookUrl: dto.webhookUrl,
        settings: (dto.settings || {}) as any,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateSessionDto) {
    await this.findOne(id, tenantId);

    return this.prisma.whatsappSession.update({
      where: { id },
      data: dto as any,
    });
  }

  async delete(id: string, tenantId: string) {
    const session = await this.findOne(id, tenantId);

    if (session.status === 'connected') {
      throw new BadRequestException('Cannot delete a connected session. Disconnect first.');
    }

    await this.prisma.whatsappSession.delete({
      where: { id },
    });

    return { success: true };
  }

  async connect(id: string, tenantId: string) {
    const session = await this.findOne(id, tenantId);

    // Check actual WhatsApp service status first to prevent false "already connected" errors
    const liveStatus = this.whatsappService.getConnectionStatus(id);
    if (liveStatus === 'connected') {
      // Already connected in WhatsApp service, sync database and return
      await this.sessionLogs.info(id, 'connect_already_active',
        `Session already connected in WhatsApp service, syncing status`);

      await this.prisma.whatsappSession.update({
        where: { id },
        data: { status: 'connected' },
      });

      this.socketService.emitSessionStatusChange(tenantId, {
        sessionId: id,
        status: 'connected',
      });

      return { ...session, status: 'connected' };
    }

    this.logger.log(`Connecting session ${id} using Baileys`);

    await this.sessionLogs.info(id, 'connect_initiated',
      `User initiated connection`, { sessionName: session.name });

    // Update status to connecting
    await this.prisma.whatsappSession.update({
      where: { id },
      data: { status: 'connecting' },
    });

    this.socketService.emitSessionStatusChange(tenantId, {
      sessionId: id,
      status: 'connecting',
    });

    try {
      // Connect via Baileys - this will emit QR code via callback
      const result = await this.whatsappService.connect(id);

      // Update session with QR code if returned
      if (result.qrCode) {
        const updatedSession = await this.prisma.whatsappSession.update({
          where: { id },
          data: {
            status: 'qr_pending',
            qrCode: result.qrCode,
          },
        });

        return updatedSession;
      }

      return session;
    } catch (error: any) {
      this.logger.error(`Connect error: ${error.message}`, error.stack);

      await this.sessionLogs.error(id, 'connect_failed',
        `Connection failed: ${error.message}`, { errorStack: error.stack });

      // Reset status on error
      await this.prisma.whatsappSession.update({
        where: { id },
        data: { status: 'disconnected' },
      });

      throw new BadRequestException('Failed to connect: ' + (error.message || 'Unknown error'));
    }
  }

  async disconnect(id: string, tenantId: string) {
    const session = await this.findOne(id, tenantId);

    // Check actual WhatsApp service status
    const liveStatus = this.whatsappService.getConnectionStatus(id);

    if (session.status === 'disconnected' && liveStatus !== 'connected') {
      throw new BadRequestException('Session is already disconnected');
    }

    await this.sessionLogs.info(id, 'disconnect_initiated',
      `User initiated disconnect`, { previousStatus: session.status });

    try {
      await this.whatsappService.disconnect(id);
      await this.sessionLogs.info(id, 'disconnect_success', `Session disconnected successfully`);
    } catch (error: any) {
      this.logger.error(`Disconnect error: ${error.message}`);
      await this.sessionLogs.error(id, 'disconnect_error',
        `Disconnect error: ${error.message}`, { errorStack: error.stack });
    }

    // Update database
    const updatedSession = await this.prisma.whatsappSession.update({
      where: { id },
      data: {
        status: 'disconnected',
        qrCode: null,
      },
    });

    // Emit socket event
    this.socketService.emitSessionStatusChange(tenantId, {
      sessionId: id,
      status: 'disconnected',
    });

    return updatedSession;
  }

  async getQrCode(id: string, tenantId: string) {
    const session = await this.findOne(id, tenantId);

    // Try to get live QR from WhatsApp service first
    const liveQr = this.whatsappService.getQrCode(id);
    const qrCode = liveQr || session.qrCode;

    if (!qrCode) {
      throw new BadRequestException('QR code not available. Try connecting again.');
    }

    // Calculate expiration
    const qrGeneratedAt = session.updatedAt;
    const QR_EXPIRY_SECONDS = 60;
    const expiresAt = new Date(qrGeneratedAt.getTime() + QR_EXPIRY_SECONDS * 1000);
    const now = new Date();
    const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    const isExpired = remainingSeconds <= 0;

    return {
      qrCode,
      generatedAt: qrGeneratedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      expirySeconds: QR_EXPIRY_SECONDS,
      remainingSeconds,
      isExpired,
    };
  }

  async updateStatus(id: string, status: string, phoneNumber?: string) {
    const session = await this.prisma.whatsappSession.findUnique({
      where: { id },
    });

    if (!session) {
      return null;
    }

    const updatedSession = await this.prisma.whatsappSession.update({
      where: { id },
      data: {
        status,
        phoneNumber: phoneNumber || session.phoneNumber,
        lastConnectedAt: status === 'connected' ? new Date() : session.lastConnectedAt,
        qrCode: status === 'connected' ? null : session.qrCode,
      },
    });

    // Emit socket event
    this.socketService.emitSessionStatusChange(session.tenantId, {
      sessionId: id,
      status,
      phoneNumber,
    });

    return updatedSession;
  }
}
