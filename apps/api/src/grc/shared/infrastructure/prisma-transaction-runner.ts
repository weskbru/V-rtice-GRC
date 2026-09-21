/**
 * 002-shared-grc-foundation, US1 — the sole `TransactionRunnerPort`
 * implementation for the `grc/**` capabilities. Thin by design, identical
 * shape to `modules/risk/infrastructure/prisma-transaction-runner.ts` — see
 * `shared/persistence/transaction-runner.port.ts` for the full rationale.
 * Shared across `EvidenceModule`/`ActionModule`/`FindingModule` (each
 * provides it under the same `TransactionRunnerPort` token) rather than
 * duplicated three times: unlike `EvidenceReferenceDataPort`-style ports,
 * there is no per-capability behavior here to diverge — it is exactly
 * `PrismaService.runInTransaction` either way.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';

@Injectable()
export class GrcTransactionRunner implements TransactionRunnerPort {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.runInTransaction(fn);
  }
}
