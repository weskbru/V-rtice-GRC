/**
 * T013/002-shared-grc-foundation — `Action`'s `ScopedRepository` base
 * (ADR-004, FR-031/FR-032). See
 * `grc/evidence/infrastructure/evidence-scoped-repository.ts`'s header for
 * the full explanation this file does not repeat. Scope column fixed to
 * `orgUnitId` (data-model.md §4).
 *
 * Base only — concrete query/write methods and the `ActionRepositoryPort`
 * implementation are T050 (US2), out of this task's scope.
 */
import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class ActionScopedRepository extends ScopedRepository<Prisma.ActionWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
