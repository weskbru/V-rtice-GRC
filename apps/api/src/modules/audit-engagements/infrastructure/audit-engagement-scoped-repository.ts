/**
 * T024/005-audit-findings — `AuditEngagement`'s `ScopedRepository` base
 * (FR-018: "toda leitura e escrita de engajamento... DEVEM respeitar o
 * escopo organizacional"). See
 * `grc/evidence/infrastructure/evidence-scoped-repository.ts`'s header for
 * the full explanation this file does not repeat. Scope column fixed to
 * `orgUnitId` (data-model.md §1).
 */
import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class AuditEngagementScopedRepository extends ScopedRepository<Prisma.AuditEngagementWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
