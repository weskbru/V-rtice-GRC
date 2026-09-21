/**
 * 008-incidents-problems, US2 — `Problem`'s `ScopedRepository` base
 * (ADR-004, FR-014). Mirrors
 * `grc/finding/infrastructure/finding-scoped-repository.ts`'s header —
 * see that file for the full explanation this one does not repeat. Scope
 * column fixed to `orgUnitId` (data-model.md §1).
 */
import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class ProblemScopedRepository extends ScopedRepository<Prisma.ProblemWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
