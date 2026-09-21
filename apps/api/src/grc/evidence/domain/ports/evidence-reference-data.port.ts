/**
 * T028/002-shared-grc-foundation, US1 — port for validating the records
 * `Evidence` refers to directly (FR-003 org unit, FR-004 responsible user).
 * Mirrors `modules/risk/domain/ports/risk-reference-data.port.ts` exactly —
 * see that file's header for why this is its own small port per module
 * rather than a shared cross-module lookup (each capability that needs "is
 * this org unit/user active" reads it independently; `core/organizations/
 * domain/ports/actor-directory.port.ts`'s own header documents the same
 * convention for actor-label lookups).
 *
 * `grc/evidence/infrastructure/prisma-evidence-reference-data.repository.ts`
 * is the only implementation, wired in `evidence.module.ts`.
 */

export interface OrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export interface UserLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
}

export abstract class EvidenceReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<OrgUnitLookup | undefined>;
  abstract findUser(id: string): Promise<UserLookup | undefined>;
}
