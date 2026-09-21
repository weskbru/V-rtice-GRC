/**
 * 008-incidents-problems, US1 — port for validating the records
 * `Incident` refers to directly (org unit, owner). Mirrors
 * `grc/finding/domain/ports/finding-reference-data.port.ts` exactly — see
 * that file's header for why this is its own small port per module
 * rather than a shared cross-module lookup.
 *
 * `infrastructure/prisma-incident-reference-data.repository.ts` is the
 * only implementation, wired in `incidents.module.ts`.
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

export abstract class IncidentReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<OrgUnitLookup | undefined>;
  abstract findUser(id: string): Promise<UserLookup | undefined>;
}
