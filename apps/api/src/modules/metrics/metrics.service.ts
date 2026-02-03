import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

interface RuntimeMetrics {
  uptime: number;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  nodeVersion: string;
  platform: string;
  pid: number;
}

interface DatabaseMetrics {
  totalUsers: number;
  totalTenants: number;
  totalContacts: number;
  totalConversations: number;
  totalMessages: number;
  activeConversations: number;
}

interface DetailedMetrics {
  runtime: RuntimeMetrics;
  database: DatabaseMetrics;
  redis: {
    connected: boolean;
    memory?: string;
    clients?: number;
  };
  timestamp: string;
}

@Injectable()
export class MetricsService {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getPrometheusMetrics(): Promise<string> {
    const runtime = this.getRuntimeMetrics();
    const db = await this.getDatabaseMetrics();

    const lines: string[] = [];

    // Runtime metrics
    lines.push(`# HELP nodejs_uptime_seconds Node.js process uptime in seconds`);
    lines.push(`# TYPE nodejs_uptime_seconds gauge`);
    lines.push(`nodejs_uptime_seconds ${runtime.uptime}`);

    lines.push(`# HELP nodejs_memory_heap_used_bytes Node.js heap memory used`);
    lines.push(`# TYPE nodejs_memory_heap_used_bytes gauge`);
    lines.push(`nodejs_memory_heap_used_bytes ${runtime.memory.heapUsed}`);

    lines.push(`# HELP nodejs_memory_heap_total_bytes Node.js heap memory total`);
    lines.push(`# TYPE nodejs_memory_heap_total_bytes gauge`);
    lines.push(`nodejs_memory_heap_total_bytes ${runtime.memory.heapTotal}`);

    lines.push(`# HELP nodejs_memory_external_bytes Node.js external memory`);
    lines.push(`# TYPE nodejs_memory_external_bytes gauge`);
    lines.push(`nodejs_memory_external_bytes ${runtime.memory.external}`);

    lines.push(`# HELP nodejs_memory_rss_bytes Node.js resident set size`);
    lines.push(`# TYPE nodejs_memory_rss_bytes gauge`);
    lines.push(`nodejs_memory_rss_bytes ${runtime.memory.rss}`);

    // Database metrics
    lines.push(`# HELP whatsapp_crm_users_total Total number of users`);
    lines.push(`# TYPE whatsapp_crm_users_total gauge`);
    lines.push(`whatsapp_crm_users_total ${db.totalUsers}`);

    lines.push(`# HELP whatsapp_crm_tenants_total Total number of tenants`);
    lines.push(`# TYPE whatsapp_crm_tenants_total gauge`);
    lines.push(`whatsapp_crm_tenants_total ${db.totalTenants}`);

    lines.push(`# HELP whatsapp_crm_contacts_total Total number of contacts`);
    lines.push(`# TYPE whatsapp_crm_contacts_total gauge`);
    lines.push(`whatsapp_crm_contacts_total ${db.totalContacts}`);

    lines.push(`# HELP whatsapp_crm_conversations_total Total number of conversations`);
    lines.push(`# TYPE whatsapp_crm_conversations_total gauge`);
    lines.push(`whatsapp_crm_conversations_total ${db.totalConversations}`);

    lines.push(`# HELP whatsapp_crm_conversations_active Active conversations`);
    lines.push(`# TYPE whatsapp_crm_conversations_active gauge`);
    lines.push(`whatsapp_crm_conversations_active ${db.activeConversations}`);

    lines.push(`# HELP whatsapp_crm_messages_total Total number of messages`);
    lines.push(`# TYPE whatsapp_crm_messages_total gauge`);
    lines.push(`whatsapp_crm_messages_total ${db.totalMessages}`);

    return lines.join('\n');
  }

  async getDetailedMetrics(): Promise<DetailedMetrics> {
    const runtime = this.getRuntimeMetrics();
    const database = await this.getDatabaseMetrics();
    const redisInfo = await this.getRedisInfo();

    return {
      runtime,
      database,
      redis: redisInfo,
      timestamp: new Date().toISOString(),
    };
  }

  getRuntimeMetrics(): RuntimeMetrics {
    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
    };
  }

  private async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    const [
      totalUsers,
      totalTenants,
      totalContacts,
      totalConversations,
      totalMessages,
      activeConversations,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tenant.count(),
      this.prisma.contact.count(),
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.conversation.count({
        where: { status: 'open' },
      }),
    ]);

    return {
      totalUsers,
      totalTenants,
      totalContacts,
      totalConversations,
      totalMessages,
      activeConversations,
    };
  }

  private async getRedisInfo(): Promise<{
    connected: boolean;
    memory?: string;
    clients?: number;
  }> {
    try {
      const client = this.redis.getClient();
      const info = await client.info('memory');
      const clientsInfo = await client.info('clients');

      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const clientsMatch = clientsInfo.match(/connected_clients:(\d+)/);

      return {
        connected: true,
        memory: memoryMatch ? memoryMatch[1] : undefined,
        clients: clientsMatch ? parseInt(clientsMatch[1], 10) : undefined,
      };
    } catch {
      return { connected: false };
    }
  }
}
