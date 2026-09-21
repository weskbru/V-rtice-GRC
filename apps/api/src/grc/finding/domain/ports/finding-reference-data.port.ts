/**
 * T068/002-shared-grc-foundation, US3 — port for validating the records
 * `Finding` refers to directly (FR-021 org unit, owner). Mirrors
 * `grc/evidence/domain/ports/evidence-reference-data.port.ts` exactly —
 * see that file's header for why this is its own small port per
 * capability rather than a shared cross-module lookup.
 *
 * `grc/finding/infrastructure/prisma-finding-reference-data.repository.ts`
 * is the only implementation, wired in `finding.module.ts`.
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

export abstract class FindingReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<OrgUnitLookup | undefined>;
  abstract findUser(id: string): Promise<UserLookup | undefined>;
}
