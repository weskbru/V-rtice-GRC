/**
 * T013/002-shared-grc-foundation — `Evidence`'s `ScopedRepository` base
 * (ADR-004, FR-031/FR-032). Follows
 * `core/organizations/infrastructure/prisma-org-unit-directory.repository.ts`
 * / `modules/risk/infrastructure/risk.repository.ts` exactly: extends the
 * shared, generic `ScopedRepository<Prisma.EvidenceWhereInput>`
 * (`shared/persistence/scoped-repository.ts`) with the scope column fixed
 * to `orgUnitId` (data-model.md §2), so every concrete query method a
 * future task (T031/US1) adds is compile-time required to thread the
 * caller's `ScopeFilter` through `applyScope`/`withScope` — there is no way
 * to add a method to that subclass which queries `evidence` without
 * applying scope, without also widening this base.
 *
 * This file is intentionally the base only, not the full repository:
 * concrete query/write methods (`findById`, `create`, `archive`, ...) and
 * the `EvidenceRepositoryPort` implementation are T031 (US1), out of this
 * task's scope — "the blocking foundation, nothing else". `EvidenceModule`
 * (T035) wires the concrete class this base is extended by.
 */
import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class EvidenceScopedRepository extends ScopedRepository<Prisma.EvidenceWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
