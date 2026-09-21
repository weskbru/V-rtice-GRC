/**
 * T068/002-shared-grc-foundation, US3 — `FindingRepositoryPort`
 * (data-model.md §5, ADR-004, ADR-011). `grc/finding/application/**`
 * depends on this abstract class, never on `PrismaService` directly.
 * Mirrors `grc/evidence/domain/ports/evidence-repository.port.ts`'s own
 * shape — see that file's header for the reasoning this one does not
 * repeat.
 *
 * `Finding` carries no `version` column (data-model.md §5) — no
 * `If-Match`/`expectedVersion` shape here.
 *
 * `close`/`reopen`/`archive` are three DEDICATED methods rather than one
 * generic `transition`, unlike `ActionRepositoryPort.transition` — each
 * `Finding` lifecycle operation has its own use case with its own extra
 * invariants (F1/F2 on close, a required reason on reopen, F4 on archive),
 * so the repository surface mirrors that one-operation-per-method shape
 * rather than a single dispatch-by-status method.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingStatus,
} from '@prisma/client';

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

/** The full wire-shape record `FindingResponseMapper` consumes, PLUS the
 * two read-time-derived counts (`openActionCount`/`evidenceCount`,
 * contracts/grc-foundation.openapi.yaml's `Finding` schema) — computed by
 * `PrismaFindingRepository` itself (direct, indexed counts against
 * `actions`/`evidence_links`; see that file's header for why this does
 * not need a cross-capability port). */
export interface FindingRecord {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefRecord;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string | undefined;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly owner: UserRefRecord;
  readonly identifiedOn: Date;
  readonly status: FindingStatus;
  readonly openActionCount: number;
  readonly evidenceCount: number;
  readonly closedAt: Date | undefined;
  readonly closedByUserId: string | undefined;
  readonly closureJustification: string | undefined;
  readonly archivedAt: Date | undefined;
  readonly archivedByUserId: string | undefined;
  /** 005-audit-findings, T089 (research.md D-5) — `null`/`undefined` for
   * every finding recorded through the manual path (`POST /findings`,
   * FR-008, unchanged); set, and never changeable afterward, for one
   * produced by `POST /audits/{auditId}/findings`
   * (`CreateFindingFromEngagementUseCase`, FR-007, SC-001). */
  readonly auditEngagementId: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateFindingRecordInput {
  readonly code: string;
  readonly orgUnitId: string;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string | undefined;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly ownerUserId: string;
  readonly identifiedOn: Date;
  /** `undefined` for the manual path (`CreateFindingUseCase`'s own
   * default) — see `FindingRecord.auditEngagementId`'s doc comment above. */
  readonly auditEngagementId?: string | undefined;
}

/** `undefined` means "leave unchanged" — the same convention
 * `UpdateEvidenceChanges`/`UpdateActionChanges` establish. No `status`:
 * `updateFinding` never changes lifecycle status (contract's own
 * description) — see `close`/`reopen`/`archive` below for that path. No
 * `origin`: not part of `UpdateFindingRequest` either (set once, at
 * creation). */
export interface UpdateFindingChanges {
  readonly title?: string;
  readonly description?: string;
  readonly recommendation?: string | null;
  readonly category?: FindingCategory;
  readonly severity?: FindingSeverity;
  readonly priority?: FindingPriority;
  readonly ownerUserId?: string;
}

export interface CloseFindingChanges {
  readonly closedAt: Date;
  readonly closedByUserId: string;
  readonly closureJustification: string | null;
}

export interface FindingListFilter {
  readonly status?: FindingStatus | undefined;
  readonly severity?: FindingSeverity | undefined;
  readonly ownerUserId?: string | undefined;
  /** The risk detail screen's own "Achados" panel read path
   * (contracts/grc-foundation.openapi.yaml's `listFindings` description) —
   * this phase models no direct Finding-to-Risk relationship, so a
   * domain screen scopes by organizational unit instead. */
  readonly orgUnitId?: string | undefined;
  /** SC-010's "achados sem remediação" view: `status = OPEN` AND no
   * `Action` exists with `originType = FINDING, originId = <this
   * finding>` — applied entirely inside `PrismaFindingRepository.list`
   * (see that file's own comment for the two-query, index-driven
   * implementation). */
  readonly withoutRemediation?: boolean | undefined;
  /** T043/005-audit-findings — `listAuditEngagementFindings`'s own filter
   * (`GET /audits/{auditId}/findings`), consumed directly by
   * `ListAuditEngagementFindingsUseCase` (`modules/audit-engagements`). Not
   * exposed by `listFindings`'s own query DTO — no FR of Phase 1 asked for
   * it there. */
  readonly auditEngagementId?: string | undefined;
}

export interface FindingPageResult {
  readonly items: readonly FindingRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export abstract class FindingRepositoryPort {
  abstract create(input: CreateFindingRecordInput): Promise<FindingRecord>;

  /** Scoped single-row read (ADR-004) — the SAME predicate every other
   * method here applies, so a finding outside `scope` is indistinguishable
   * from one that does not exist (FR-030/FR-032). */
  abstract findById(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined>;

  /**
   * F-38 — an UNSCOPED lookup of `id`'s CURRENT `orgUnitId`, ignoring
   * `scope` entirely. `undefined` only when no finding with this id exists
   * at all. Used EXCLUSIVELY on the refusal path, after `findById`/
   * `update`/`close`/`reopen`/`archive` has already returned nothing, so
   * `OrgScopeEnforcerService.assertExistingRecordAccessible` can tell
   * "does not exist" (no audit) apart from "exists outside scope"
   * (audited). NEVER for building a caller-visible response.
   */
  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  /**
   * Every `Finding.id` whose CURRENT `orgUnitId` falls within `scope` — a
   * single scoped query, no relations loaded. Backs
   * `FindingActionOriginAccessor.listOriginIdsInScope`
   * (`grc/shared/domain/ports/action-origin-resolver.port.ts`, Fix 1) —
   * see `RiskRepositoryPort.listIdsInScope`'s identical doc comment for
   * the full reasoning this one does not repeat.
   */
  abstract listIdsInScope(scope: ScopeFilter): Promise<readonly string[]>;

  /** Scoped conditional update. Returns `undefined` when `id` is outside
   * `scope` or does not exist. */
  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateFindingChanges,
  ): Promise<FindingRecord | undefined>;

  /** Sets `status = CLOSED` plus the three `changes` columns (Invariant
   * F1/F2, checked by `CloseFindingUseCase` before this is ever called).
   * Returns `undefined` under the same out-of-scope/not-found rule as
   * `update`. */
  abstract close(
    scope: ScopeFilter,
    id: string,
    changes: CloseFindingChanges,
  ): Promise<FindingRecord | undefined>;

  /** Sets `status = IN_REMEDIATION` and CLEARS `closedAt`/
   * `closedByUserId`/`closureJustification` back to `null` on the live
   * row — the previous closure stays legible in the audit trail's
   * `previousValues` on this same transition's own audit row (FR-027),
   * the identical shape `TransitionActionUseCase` uses for
   * `COMPLETED -> OPEN`. */
  abstract reopen(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined>;

  /**
   * T047/005-audit-findings (research.md D-10) — sets `status =
   * IN_REMEDIATION` directly from `OPEN`, the edge `finding.entity.ts`'s
   * own transition table has declared legal since Phase 1 but no operation
   * ever traversed (SC-002). Unlike `reopen` above, no column besides
   * `status` changes: an `OPEN` finding never had `closedAt`/
   * `closedByUserId`/`closureJustification` populated in the first place,
   * so there is nothing to clear. `StartFindingRemediationUseCase`
   * (`grc/finding/application/start-remediation.usecase.ts`) checks
   * `assertLegalFindingTransition(current.status, 'IN_REMEDIATION')`
   * before calling this — a finding not currently `OPEN` never reaches
   * this method at all.
   */
  abstract startRemediation(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined>;

  /** Sets `status = ARCHIVED`, `archivedAt`/`archivedByUserId`. Never a
   * physical delete (FR-027). */
  abstract archive(
    scope: ScopeFilter,
    id: string,
    archivedByUserId: string,
    archivedAt: Date,
  ): Promise<FindingRecord | undefined>;

  /**
   * The `responsibleUserId` of every `Action` with `originType = FINDING,
   * originId = findingId` and `status = COMPLETED` — Invariant F1 (`length
   * > 0` means a completed linked action exists) and Invariant F2 (does it
   * include the closer). Direct query against the shared `actions` table
   * (indexed on `(originType, originId)`) — no cross-capability port: see
   * `PrismaFindingRepository`'s own header for why this is a plain
   * infrastructure-layer read, not a `grc/action` dependency.
   */
  abstract findCompletedLinkedActionResponsibles(findingId: string): Promise<readonly string[]>;

  abstract list(
    scope: ScopeFilter,
    filter: FindingListFilter,
    page: number,
    pageSize: number,
  ): Promise<FindingPageResult>;
}
