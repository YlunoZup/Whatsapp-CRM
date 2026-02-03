import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
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
