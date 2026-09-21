/**
 * 008-incidents-problems, US2 — port for validating the records `Problem`
 * refers to directly: the organizational unit it belongs to, and the user
 * proposed as its owner (spec.md FR-001 to FR-003). Mirrors
 * `modules/controls/domain/ports/control-reference-data.port.ts`'s shape
 * exactly — see that file's header for why this is each module's own
 * small port rather than a shared cross-module lookup.
 *
 * `infrastructure/prisma-problem-reference-data.repository.ts` is the only
 * implementation, wired by `problems.module.ts`.
 */

export interface ProblemOrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export interface ProblemOwnerLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
  /**
   * `undefined` when the user carries no primary organizational unit —
   * such a user is not confined to one and is therefore assignable
   * anywhere (`core/organizations/domain/assignment-line.ts`'s own rule),
   * the same convention `ControlOwnerLookup.primaryOrgUnitId` documents.
   */
  readonly primaryOrgUnitId: string | undefined;
}

export abstract class ProblemReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<ProblemOrgUnitLookup | undefined>;
  abstract findUser(id: string): Promise<ProblemOwnerLookup | undefined>;
}
