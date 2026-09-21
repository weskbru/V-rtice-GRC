/**
 * T027-T042/003-controls-management, User Story 2/3 — a narrow,
 * independent read port for the handful of `Control` fields the
 * assessment/attestation and relationship use cases need to authorize
 * their own operations: the control's current lifecycle `status` (FR-006,
 * D-6 — a `RETIRED`/non-`ACTIVE` control refuses new assessments and
 * links), its `ownerUserId` (C2, FR-018), its `frequency` (fed to
 * `ControlEffectivenessService`, D-2) and its own organizational scope
 * (FR-007).
 *
 * Deliberately NOT `ControlRepositoryPort`
 * (`domain/ports/control-repository.port.ts`, the catalogue/lifecycle
 * workstream's own port for operations 1-6): that port's `ControlRecord`
 * additionally resolves the owner's full profile, the org unit's code/name
 * and the derived `effectiveness` — none of which this workstream's own
 * use cases need, and depending on it here would couple two concurrently
 * evolving workstreams' DI wiring together for no benefit. Both ports read
 * the same `controls` table; this is a deliberate, small, reported
 * duplication (CLAUDE.md §13.8) rather than a shared abstraction invented
 * before it has a second genuine reason to exist — see this task's report
 * for the explicit call to reconsider once `ControlsModule`'s own wiring
 * has settled.
 *
 * `infrastructure/control-lookup.repository.ts` is the only implementation.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ControlFrequency, ControlStatus } from '@prisma/client';

export interface ControlLookupRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly orgUnitId: string;
  readonly ownerUserId: string | undefined;
  readonly status: ControlStatus;
  readonly frequency: ControlFrequency | undefined;
  readonly version: number;
}

export abstract class ControlLookupPort {
  /** `undefined` when the control does not exist OR exists outside
   * `scope` — the two are indistinguishable by design (FR-007). */
  abstract findScoped(scope: ScopeFilter, id: string): Promise<ControlLookupRecord | undefined>;

  /** F-38 — an UNSCOPED lookup of `id`'s CURRENT `orgUnitId`, ignoring
   * `scope` entirely, used EXCLUSIVELY on the refusal path after a scoped
   * lookup already returned nothing, so `OrgScopeEnforcerService
   * .assertExistingRecordAccessible` can tell "does not exist" apart from
   * "exists outside scope". */
  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;
}
