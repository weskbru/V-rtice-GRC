/**
 * T178/T179 — the organizations capability's own `TransactionRunnerPort`
 * implementation, so `OrgUnitAdminService` and `ScopeGrantService`
 * (`core/organizations/application`) can share one transaction with their
 * `AuditRecorder` calls and their `orgTreeVersion`/`grantsVersion` bumps
 * (ADR-004, ADR-005) without importing `PrismaService` directly (ADR-011).
 * See `core/identity/infrastructure/prisma-transaction-runner.ts` for why
 * this is a per-capability copy rather than a shared import from
 * `modules/risk`.
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
