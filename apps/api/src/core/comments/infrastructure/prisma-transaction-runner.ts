/**
 * T192 — the sole `TransactionRunnerPort` implementation for
 * `core/comments`, thin by design (see `shared/persistence/
 * transaction-runner.port.ts` and every other module's own copy).
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';

@Injectable()
export class PrismaTransactionRunner implements TransactionRunnerPort {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.runInTransaction(fn);
  }
}
