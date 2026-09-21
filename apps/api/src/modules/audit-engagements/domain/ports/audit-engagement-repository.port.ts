/**
 * T024/005-audit-findings, User Story 1 — port for persisting and reading
 * `AuditEngagement` records (data-model.md §1, operations 1-4/9/10 of
 * `contracts/audit.openapi.yaml`). Every use case depends on this abstract
 * class, never on the Prisma-backed implementation directly (ADR-011) —
 * the same discipline `ControlRepositoryPort`/`FrameworkVersionRepositoryPort`
 * establish. Sole implementation: `infrastructure/prisma-audit-engagement.repository.ts`.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { AuditEngagementStatus } from '@prisma/client';

export interface AuditEngagementOrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AuditEngagementUserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

/** One `AuditEngagement`, exactly as the application/presentation layers
 * need it (every relation already resolved, mirroring `ControlRecord`'s
 * convention). */
export interface AuditEngagementRecord {
  readonly id: string;
  readonly code: string;
  readonly objective: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  /** Both `orgUnitId` and `leadAuditorUserId` are required, non-nullable
   * columns (data-model.md §1) — unlike `Control.orgUnitId`, there is no
   * "legacy record predates scoping" case to model here. */
  readonly orgUnit: AuditEngagementOrgUnitRefRecord;
  readonly leadAuditor: AuditEngagementUserRefRecord;
  readonly status: AuditEngagementStatus;
  readonly startedAt: Date | undefined;
  readonly startedBy: AuditEngagementUserRefRecord | undefined;
  readonly completedAt: Date | undefined;
  readonly completedBy: AuditEngagementUserRefRecord | undefined;
  readonly cancelledAt: Date | undefined;
  readonly cancelledBy: AuditEngagementUserRefRecord | undefined;
  readonly cancellationJustification: string | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAuditEngagementRecordInput {
  readonly code: string;
  readonly objective: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly orgUnitId: string;
  readonly leadAuditorUserId: string;
}

/** `undefined` = leave unchanged (`UpdateAuditEngagementUseCase`'s
 * partial-update semantics, mirroring `UpdateControlChanges`). */
export interface UpdateAuditEngagementChanges {
  readonly objective?: string;
  readonly periodStart?: Date;
  readonly periodEnd?: Date;
  readonly orgUnitId?: string;
  readonly leadAuditorUserId?: string;
}

/**
 * The write one lifecycle transition applies, in the SAME conditional
 * update as the optimistic-lock check (research.md D-18), mirroring
 * `ApplyControlTransitionChanges`. Only the fields relevant to the target
 * `status` are ever supplied by a given caller — `StartAuditEngagementUseCase`
 * supplies `startedAt`/`startedByUserId`, `CompleteAuditEngagementUseCase`
 * supplies `completedAt`/`completedByUserId`,
 * `CancelAuditEngagementUseCase` supplies `cancelledAt`/
 * `cancelledByUserId`/`cancellationJustification` — never more than one
 * group per call.
 */
export interface ApplyAuditEngagementTransitionChanges {
  readonly status: AuditEngagementStatus;
  readonly startedAt?: Date;
  readonly startedByUserId?: string;
  readonly completedAt?: Date;
  readonly completedByUserId?: string;
  readonly cancelledAt?: Date;
  readonly cancelledByUserId?: string;
  readonly cancellationJustification?: string;
}

export type AuditEngagementUpdateResult =
  | { readonly outcome: 'UPDATED'; readonly record: AuditEngagementRecord }
  | { readonly outcome: 'NOT_FOUND' }
  | {
      readonly outcome: 'VERSION_CONFLICT';
      readonly currentVersion: number;
      readonly currentStatus: AuditEngagementStatus;
    };

export interface AuditEngagementListFilters {
  readonly status?: readonly AuditEngagementStatus[] | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly leadAuditorUserId?: readonly string[] | undefined;
}

export type AuditEngagementListSortField = 'code' | 'periodStart' | 'updatedAt';
export type AuditEngagementListSortDirection = 'asc' | 'desc';

export interface AuditEngagementListQuery {
  readonly scope: ScopeFilter;
  readonly filters: AuditEngagementListFilters;
  readonly sortField: AuditEngagementListSortField;
  readonly sortDirection: AuditEngagementListSortDirection;
  readonly page: number;
  readonly pageSize: number;
}

export interface AuditEngagementListPage {
  readonly items: readonly AuditEngagementRecord[];
  readonly total: number;
}

export abstract class AuditEngagementRepositoryPort {
  abstract create(input: CreateAuditEngagementRecordInput): Promise<AuditEngagementRecord>;

  /** `undefined` when the engagement does not exist OR exists outside
   * `scope` — the two are indistinguishable by design (FR-018). */
  abstract findById(scope: ScopeFilter, id: string): Promise<AuditEngagementRecord | undefined>;

  /** An UNSCOPED lookup of `id`'s CURRENT `orgUnitId`, ignoring `scope`
   * entirely — used EXCLUSIVELY on the refusal path, after a scoped lookup
   * already returned nothing, so `OrgScopeEnforcerService
   * .assertExistingRecordAccessible` can tell "does not exist" apart from
   * "exists outside scope" (F-38's mechanism). */
  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract list(query: AuditEngagementListQuery): Promise<AuditEngagementListPage>;

  /** Applies `changes` iff the row is within `scope` AND its current
   * `version` equals `expectedVersion` — the same race-free single
   * conditional `UPDATE ... WHERE id = ? AND version = ? AND <scope>`
   * mechanism `ControlRepository`/`FrameworkVersionRepository` document
   * (research.md D-18). */
  abstract updateWithVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: UpdateAuditEngagementChanges,
  ): Promise<AuditEngagementUpdateResult>;

  /** Identical conditional-update mechanism as `updateWithVersion`, against
   * the disjoint `status`/`started*`/`completed*`/`cancelled*` fields. */
  abstract applyLifecycleTransition(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: ApplyAuditEngagementTransitionChanges,
  ): Promise<AuditEngagementUpdateResult>;
}
