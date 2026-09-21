/**
 * T176 — the identity capability's own `TransactionRunnerPort`
 * implementation, so `core/identity/application`'s new user-administration
 * use cases (`create-user.usecase.ts`, `set-user-status.usecase.ts`, ...)
 * can share one transaction with their `AuditRecorder` calls (ADR-005)
 * without importing `PrismaService` themselves (ADR-011).
 *
 * `modules/risk/infrastructure/prisma-transaction-runner.ts` already
 * implements this exact same port, but `core/**` may never import from
 * `modules/**` (ADR-011) — this one-line adapter is the capability's own
 * copy, exactly the outcome `shared/persistence/transaction-runner.port.ts`'s
 * own header comment anticipates ("a future business module ... writes its
 * own one-line adapter, rather than this abstraction being invented again
 * per module") extended to a future CORE capability with the same need.
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
