/**
 * 008-incidents-problems, foundation — the sole implementation of
 * `ProblemLookupPort` (`domain/ports/problem-lookup.port.ts`). A plain
 * `PrismaService`-backed query, not yet built on a shared
 * `ProblemScopedRepository` base — Fase 4 (tasks.md) introduces that base
 * when the full `ProblemRepositoryPort` (create/list/update) arrives, the
 * same order `modules/controls`/`modules/assets` already followed
 * (a narrow lookup port before the full scoped-repository base existed).
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { applyScopeToWhere } from '../../../shared/persistence/scope-filter';
import { ProblemLookupPort } from '../domain/ports/problem-lookup.port';

import type { ScopeFilter, UnitScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ProblemLookupRecord } from '../domain/ports/problem-lookup.port';
import type { Prisma } from '@prisma/client';

const SELECT = {
  id: true,
  code: true,
  title: true,
  orgUnitId: true,
} as const;

@Injectable()
export class ProblemLookupRepository implements ProblemLookupPort {
  constructor(private readonly prisma: PrismaService) {}

  async findScoped(scope: ScopeFilter, id: string): Promise<ProblemLookupRecord | undefined> {
    const where = applyScopeToWhere<Prisma.ProblemWhereInput>(scope, 'orgUnitId', { id });
    const row = await this.prisma.client.problem.findFirst({ where, select: SELECT });
    return row ?? undefined;
  }

  async listIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    const where = applyScopeToWhere<Prisma.ProblemWhereInput>(scope, 'orgUnitId', {});
    const rows = await this.prisma.client.problem.findMany({ where, select: { id: true } });
    return rows.map((row) => row.id);
  }
}
