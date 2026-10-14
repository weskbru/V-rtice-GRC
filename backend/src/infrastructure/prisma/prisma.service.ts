import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { AppConfigService } from '../config/app-config.service';

export type PrismaTransactionClient = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  private static readonly transactionStorage = new AsyncLocalStorage<PrismaTransactionClient>();

  private readonly self: this;

  constructor(appConfig: AppConfigService) {
    super({
      datasourceUrl: appConfig.database.url,
    });
    this.self = this;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('PostgreSQL connection established.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  get client(): PrismaClient | PrismaTransactionClient {
    return PrismaService.transactionStorage.getStore() ?? this.self;
  }

  get isInTransaction(): boolean {
    return PrismaService.transactionStorage.getStore() !== undefined;
  }

  async runInTransaction<T>(fn: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    const existing = PrismaService.transactionStorage.getStore();

    if (existing) {
      return fn(existing);
    }

    return this.$transaction(async (tx) => {
      return PrismaService.transactionStorage.run(tx, () => fn(tx));
    });
  }
}
