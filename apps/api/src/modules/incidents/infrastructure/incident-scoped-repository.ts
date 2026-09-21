/**
 * 008-incidents-problems, US1 — `Incident`'s `ScopedRepository` base
 * (ADR-004, spec.md FR-014/FR-022). See
 * `grc/finding/infrastructure/finding-scoped-repository.ts`'s header for
 * the full explanation this file does not repeat. Scope column fixed to
 * `orgUnitId` (data-model.md §1).
 */
import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class IncidentScopedRepository extends ScopedRepository<Prisma.IncidentWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
