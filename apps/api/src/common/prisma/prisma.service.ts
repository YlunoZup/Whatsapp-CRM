import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly CONNECTION_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(attempt = 1): Promise<void> {
    try {
      this.logger.log(`Connecting to database (attempt ${attempt}/${this.MAX_RETRIES})...`);

      // Set timeout for connection
      const connectionPromise = this.$connect();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timeout')), this.CONNECTION_TIMEOUT),
      );

      await Promise.race([connectionPromise, timeoutPromise]);

      this.logger.log('Database connected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (attempt < this.MAX_RETRIES) {
        this.logger.warn(
          `Database connection failed (attempt ${attempt}/${this.MAX_RETRIES}): ${errorMessage}. ` +
          `Retrying in ${this.RETRY_DELAY}ms...`,
        );

        await this.sleep(this.RETRY_DELAY);
        return this.connectWithRetry(attempt + 1);
      } else {
        this.logger.error(
          `Failed to connect to database after ${this.MAX_RETRIES} attempts: ${errorMessage}. ` +
          `Application will continue but database operations may fail.`,
        );
        // Don't throw - allow application to start but log the error
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase(): Promise<unknown[] | void> {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    // Only for testing - delete all data
    const models = Reflect.ownKeys(this).filter((key) => {
      return typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$');
    });

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as { deleteMany: () => Promise<unknown> }).deleteMany();
        }
        return Promise.resolve();
      }),
    );
  }
}
