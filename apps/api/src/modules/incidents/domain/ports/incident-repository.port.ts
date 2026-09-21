/**
 * 008-incidents-problems, US1 — `IncidentRepositoryPort`
 * (data-model.md §1, ADR-004, ADR-011). `modules/incidents/application/**`
 * depends on this abstract class, never on `PrismaService` directly.
 * Mirrors `grc/finding/domain/ports/finding-repository.port.ts`'s shape —
 * see that file's header for the reasoning this one does not repeat.
 *
 * `Incident` carries no `version` column (data-model.md §1) — no
 * `If-Match`/`expectedVersion` shape here.
 *
 * One `transition` method, not one-per-target-status, mirroring
 * `ActionRepositoryPort.transition` rather than `FindingRepositoryPort`'s
 * `close`/`reopen`/`archive` split — `contracts/incidents.openapi.yaml`
 * exposes exactly one `POST /incidents/{id}/transitions` operation, so the
 * repository surface mirrors that single-dispatch shape.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentRecord {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefRecord;
  readonly title: string;
  readonly description: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly reportedBy: UserRefRecord;
  readonly owner: UserRefRecord;
  readonly reportedOn: Date;
  readonly resolutionSummary: string | undefined;
  readonly resolvedAt: Date | undefined;
  readonly resolvedBy: UserRefRecord | undefined;
  readonly closedAt: Date | undefined;
  readonly closedBy: UserRefRecord | undefined;
  readonly cancellationReason: string | undefined;
  readonly cancelledAt: Date | undefined;
  readonly cancelledBy: UserRefRecord | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateIncidentRecordInput {
  readonly code: string;
  readonly orgUnitId: string;
  readonly title: string;
  readonly description: string;
  readonly severity: IncidentSeverity;
  readonly reportedByUserId: string;
  readonly ownerUserId: string;
  readonly reportedOn: Date;
}

/** `undefined` means "leave unchanged" — the same convention
 * `UpdateFindingChanges`/`UpdateActionChanges` establish. No `status`:
 * `updateIncident` never changes lifecycle status (contract's own
 * description) — see `transition` below for that path. */
export interface UpdateIncidentChanges {
  readonly title?: string;
  readonly description?: string;
  readonly severity?: IncidentSeverity;
  readonly ownerUserId?: string;
}

/** Every column a transition may touch — `TransitionIncidentUseCase`
 * computes exactly which of these are non-`null` per target status
 * (data-model.md invariants I1/I2) before calling `transition` below. */
export interface IncidentTransitionChanges {
  readonly status: IncidentStatus;
  readonly resolutionSummary: string | null;
  readonly resolvedAt: Date | null;
  readonly resolvedByUserId: string | null;
  readonly closedAt: Date | null;
  readonly closedByUserId: string | null;
  readonly cancellationReason: string | null;
  readonly cancelledAt: Date | null;
  readonly cancelledByUserId: string | null;
}

export interface IncidentListFilter {
  readonly status?: readonly IncidentStatus[] | undefined;
  readonly severity?: readonly IncidentSeverity[] | undefined;
  readonly search?: string | undefined;
  readonly orgUnitId?: string | undefined;
}

export type IncidentSortField =
  'code' | 'title' | 'severity' | 'status' | 'reportedOn' | 'updatedAt';

export interface IncidentPageResult {
  readonly items: readonly IncidentRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export abstract class IncidentRepositoryPort {
  abstract create(input: CreateIncidentRecordInput): Promise<IncidentRecord>;

  /** Scoped single-row read (ADR-004) — the SAME predicate every other
   * method here applies, so an incident outside `scope` is
   * indistinguishable from one that does not exist (spec.md FR-014). */
  abstract findById(scope: ScopeFilter, id: string): Promise<IncidentRecord | undefined>;

  /**
   * F-38 — an UNSCOPED lookup of `id`'s CURRENT `orgUnitId`, ignoring
   * `scope` entirely. `undefined` only when no incident with this id
   * exists at all. Used EXCLUSIVELY on the refusal path, after `findById`/
   * `update`/`transition` has already returned nothing, so
   * `OrgScopeEnforcerService.assertExistingRecordAccessible` can tell
   * "does not exist" (no audit) apart from "exists outside scope"
   * (audited). NEVER for building a caller-visible response.
   */
  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  /** Scoped conditional update. Returns `undefined` when `id` is outside
   * `scope` or does not exist. */
  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateIncidentChanges,
  ): Promise<IncidentRecord | undefined>;

  /** Applies `changes` (already validated as a legal transition by
   * `incident.entity.ts#assertLegalIncidentTransition`) against exactly
   * this row, scoped. Returns `undefined` under the same out-of-scope/
   * not-found rule as `update`. */
  abstract transition(
    scope: ScopeFilter,
    id: string,
    changes: IncidentTransitionChanges,
  ): Promise<IncidentRecord | undefined>;

  abstract list(
    scope: ScopeFilter,
    filter: IncidentListFilter,
    sort: IncidentSortField,
    direction: 'asc' | 'desc',
    page: number,
    pageSize: number,
  ): Promise<IncidentPageResult>;
}
