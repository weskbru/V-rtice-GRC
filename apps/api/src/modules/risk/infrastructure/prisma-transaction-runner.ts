/**
 * T089/T090 — the sole implementation of `TransactionRunnerPort`, thin by
 * design: it exists only so `CreateRiskUseCase`/`UpdateRiskUseCase`
 * (`application/**`) never need to import `PrismaService` themselves
 * (ADR-011). See `shared/persistence/transaction-runner.port.ts` for the
 * full rationale.
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
