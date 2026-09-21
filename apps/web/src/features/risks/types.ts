/**
 * PharosGRC frontend — Risk Management types (T095–T099).
 *
 * Hand-written against `specs/001-grc-platform-foundation/contracts/risks.openapi.yaml`
 * and `admin.openapi.yaml`, for the same reason `auth-types.ts` is
 * hand-written: `packages/api-types` is not yet generated from a live
 * `apps/api/openapi.json` for this surface (T205). Every shape below mirrors
 * a named schema in those contracts — when T205 lands, replace these with
 * the generated `components['schemas'][...]` equivalents rather than
 * widening them; this file should shrink to nothing, not grow.
 *
 * Deliberately excluded: `inherentScore`, `inherentLevel`, `residualScore`,
 * `residualLevel` never appear in any *request* shape here — they are
 * derived exclusively by `RiskScoringService` from an assessment (FR-062,
 * FR-063) and the API rejects them as unknown properties on write. They do
 * appear on `RiskSummary`/`RiskDetail` as server-supplied, read-only output.
 */

/** Mirrors `enum RiskStatus` (data-model.md §8, FR-079). */
export type RiskStatus =
  | 'DRAFT'
  | 'IDENTIFIED'
  | 'ASSESSED'
  | 'UNDER_TREATMENT'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'CLOSED'
  | 'ARCHIVED';

/** Mirrors `enum RiskLevel` (data-model.md §8). */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Mirrors `UserRef` (risks.openapi.yaml). */
export interface UserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email?: string;
}

/** Mirrors `OrgUnitRef` (risks.openapi.yaml). */
export interface OrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `ReferenceDataRef` (risks.openapi.yaml) — a risk category, type or origin as referenced from a risk. */
export interface ReferenceDataRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `ReferenceDataItem` (platform.openapi.yaml) — `GET /risk-categories|risk-types|risk-origins`. */
export interface ReferenceDataItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
}

/** Mirrors `OrgUnitNode` (admin.openapi.yaml) — `GET /org-units`. */
export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

/** Mirrors `RiskStatement` (risks.openapi.yaml) — an individually recorded cause or consequence (FR-057). */
export interface RiskStatement {
  readonly id: string;
  readonly description: string;
  readonly sortOrder: number;
}

/** Mirrors `RiskSummary` (risks.openapi.yaml) — one register row; also the shape shared by `RiskDetail`. */
export interface RiskSummary {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  /** Server-truncated 200-character projection of the description, for list
   * previews only. The full description is on `RiskDetail`. */
  readonly descriptionExcerpt: string | null;
  readonly status: RiskStatus;
  /**
   * F-18 (`docs/deferred-findings.md`), fixed 2026-09-18: the contract marks
   * `category` OPTIONAL — absent from the response body, never sent as
   * `null` — confirmed against `risk-query.service.ts`'s own mapper
   * (`toReferenceDataRefOrUndefined`, `?? undefined`). The hand-written type
   * used to say `ReferenceDataRef | null` (required, nullable), which let
   * `risk.category !== null` typecheck and read `undefined !== null` as
   * true — a latent hazard the audit that fixed this confirmed was not yet
   * live in any call site, but the type itself was still wrong.
   */
  readonly category?: ReferenceDataRef;
  readonly orgUnit: OrgUnitRef;
  readonly owner: UserRef;
  readonly responsible?: UserRef;
  readonly inherentScore?: number;
  readonly inherentLevel?: RiskLevel;
  readonly residualScore?: number;
  readonly residualLevel?: RiskLevel;
  readonly lastAssessedOn?: string;
  /**
   * Also optional (F-18) — `nextReviewOn: row.next_review_on ?? undefined`
   * in the same mapper. NOT in F-18's own original "confirmed instances"
   * list (found during this fix's own field-by-field audit, the same audit
   * that found `updatedAt` did NOT belong on that list — the original list
   * was wrong in both directions, not just one).
   */
  readonly nextReviewOn?: string;
  readonly overdueReview: boolean;
  readonly overdueTreatment: boolean;
  readonly pendingApproval: boolean;
  readonly version: number;
  readonly updatedAt: string;
}

/** Mirrors `RiskDetail` (risks.openapi.yaml) — `GET /risks/{riskId}`. Sections beyond overview/causes/consequences/assessment/treatment/relationships (action plans, lifecycle history, attachments, comments) are read from their own endpoints in later phases; only what T095–T099, T129–T132 and T144–T146 use is modeled here. */
export interface RiskDetail extends RiskSummary {
  readonly description: string;
  readonly type: ReferenceDataRef | null;
  readonly origin: ReferenceDataRef | null;
  readonly causes: readonly RiskStatement[];
  readonly consequences: readonly RiskStatement[];
  /** The risk's current point-in-time evaluation (US4), or `null` for a risk not yet assessed (SC-013 — never fabricated). Immutable once created; a reassessment repoints this to a new record rather than mutating it (ADR-006, FR-064, FR-065). */
  readonly currentAssessment: RiskAssessment | null;
  /** The current (non-superseded) treatment decision (US5, FR-073), or `null` for a risk never treated. Recording a new decision supersedes this one — it is never edited in place. */
  readonly currentTreatment: RiskTreatmentDecision | null;
  /** Current (non-withdrawn) control links only — "shown where they influence residual risk" (FR-078). Withdrawn links remain in `GET /risks/{riskId}/controls?includeWithdrawn=true`'s history, never here. */
  readonly controls: readonly RiskControlLink[];
  readonly processes: readonly RiskEntityLink[];
  readonly assets: readonly RiskEntityLink[];
  readonly treatmentActionSummary: TreatmentActionSummary;
  readonly identifiedOn: string;
  readonly archivedAt: string | null;
  readonly createdAt: string;
}

/** Mirrors `TreatmentStrategy` (data-model.md §10, risks.openapi.yaml). */
export type TreatmentStrategy = 'MITIGATE' | 'ACCEPT' | 'TRANSFER' | 'AVOID';

/** Mirrors `TreatmentActionStatus` (data-model.md §10, risks.openapi.yaml). */
export type TreatmentActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** Mirrors `RiskDetail.treatmentActionSummary` (risks.openapi.yaml). */
export interface TreatmentActionSummary {
  readonly total: number;
  readonly open: number;
  readonly overdue: number;
}

/** Mirrors `RiskTreatmentDecision` (risks.openapi.yaml, FR-071 to FR-073) — an immutable treatment decision; superseded decisions are retained, never overwritten. */
export interface RiskTreatmentDecision {
  readonly id: string;
  readonly strategy: TreatmentStrategy;
  readonly description: string;
  readonly deadline: string | null;
  readonly decidedBy: UserRef;
  readonly decidedAt: string;
  readonly supersededAt: string | null;
  /** The deadline has passed with outstanding actions (FR-075). Computed on the server — never recomputed here. */
  readonly deadlineOverdue: boolean;
}

/** Mirrors `CreateRiskTreatmentDecisionRequest` (risks.openapi.yaml) — `POST /risks/{riskId}/treatments`. The deciding user and timestamp come from the session, never sent here. */
export interface CreateRiskTreatmentDecisionRequest {
  strategy: TreatmentStrategy;
  description: string;
  deadline?: string | null;
}

/** Mirrors `RiskTreatmentAction` (risks.openapi.yaml, FR-074 to FR-075). `overdue` is computed by the server (ADR-015) — never recomputed from `dueOn`/`status` in this app. */
export interface RiskTreatmentAction {
  readonly id: string;
  readonly treatmentDecisionId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly responsible: UserRef;
  readonly dueOn: string;
  readonly status: TreatmentActionStatus;
  readonly overdue: boolean;
  readonly completedAt: string | null;
  readonly createdAt: string;
}

/** Mirrors `CreateRiskTreatmentActionRequest` (risks.openapi.yaml) — `POST /risks/{riskId}/treatment-actions`. */
export interface CreateRiskTreatmentActionRequest {
  title: string;
  description?: string | null;
  responsibleUserId: string;
  dueOn: string;
  treatmentDecisionId?: string | null;
}

/** Mirrors `UpdateRiskTreatmentActionRequest` (risks.openapi.yaml) — `PATCH /risks/{riskId}/treatment-actions/{actionId}`. At least one property required; omitted properties are left unchanged. */
export interface UpdateRiskTreatmentActionRequest {
  title?: string;
  description?: string | null;
  responsibleUserId?: string;
  dueOn?: string;
  status?: TreatmentActionStatus;
  /** Required by the server when `status: 'OPEN'` reopens a `COMPLETED`
   * action (Invariant A2, `UpdateRiskTreatmentActionRequestDto`) — optional
   * here because every other status change legitimately omits it. */
  reopenReason?: string;
}

/** Mirrors `RegistryItem` (platform.openapi.yaml) — one entry of the minimal control/process/asset registry `GET /controls|/processes|/assets` returns. */
export interface RegistryItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly orgUnitId: string | null;
  readonly isActive: boolean;
}

/**
 * Mirrors `AttachableEntityType`/`CommentableEntityType` (platform.openapi.yaml,
 * `contracts/grc-foundation.openapi.yaml`) — the comments/attachments
 * entity-type registry (ADR-008, FR-110). `EVIDENCE` (002-shared-grc-foundation,
 * US1) is attachable only, not commentable — a future module adds its own
 * without widening this union's callers, only this union itself, exactly as
 * this comment already anticipated. `INCIDENT`/`PROBLEM` (008-incidents-
 * problems) were registered against both registries on the backend
 * (`IncidentParentRecordAccessor`/`ProblemParentRecordAccessor`) but never
 * added here — the exact "registered, never reachable" gap CLAUDE.md
 * §19.10 exists to catch.
 */
export type CollaborationEntityType = 'RISK' | 'EVIDENCE' | 'INCIDENT' | 'PROBLEM';

/** Mirrors `Comment` (platform.openapi.yaml, FR-095, FR-098, FR-102). `body` is plain text, never markup — see `CommentThread`'s own doc comment for the rendering-side guarantee. */
export interface Comment {
  readonly id: string;
  readonly entityType: CollaborationEntityType;
  readonly entityId: string;
  readonly body: string;
  readonly author: UserRef;
  readonly createdAt: string;
}

/** Mirrors `Attachment` (platform.openapi.yaml, FR-096 to FR-100, ADR-010) — metadata only; content is fetched exclusively through `contentUrl`, the authorizing download path. */
export interface Attachment {
  readonly id: string;
  readonly entityType: CollaborationEntityType;
  readonly entityId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedBy: UserRef;
  readonly createdAt: string;
  readonly contentUrl: string;
}

/** Mirrors `RiskControlLink` (risks.openapi.yaml, FR-076 to FR-078, ADR-008) — an explicit risk-to-control relationship carrying its own facts, not a generic link. */
export interface RiskControlLink {
  readonly id: string;
  readonly control: ReferenceDataRef;
  readonly linkedBy: UserRef;
  readonly linkedAt: string;
  readonly unlinkedBy: UserRef | null;
  readonly unlinkedAt: string | null;
}

/** Mirrors `RiskEntityLink` (risks.openapi.yaml) — a risk-to-process or risk-to-asset relationship. Unlike `RiskControlLink`, the contract does not expose who unlinked it. */
export interface RiskEntityLink {
  readonly id: string;
  readonly entity: ReferenceDataRef;
  readonly linkedBy: UserRef;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

/** Mirrors `LinkEntityRequest` (risks.openapi.yaml) — the body of every `POST /risks/{riskId}/controls|processes|assets`. */
export interface LinkEntityRequest {
  id: string;
}

/** Mirrors `ControlRef` (risks.openapi.yaml) — a control referenced from an assessment's `controlsConsidered`. Only `id` is populated until `Control` exists (US5); `code`/`name` are added by this same type once that endpoint resolves them. */
export interface ControlRef {
  readonly id: string;
  readonly code?: string;
  readonly name?: string;
}

/** Mirrors `RiskAssessment.levelChange` (risks.openapi.yaml, FR-066) — the movement relative to the assessment this one superseded. All members are `null` for the first assessment of a risk (no predecessor to compare against). */
export interface AssessmentLevelChange {
  readonly previousInherentLevel: RiskLevel | null;
  readonly previousResidualLevel: RiskLevel | null;
  readonly direction: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | null;
}

/**
 * Mirrors `RiskAssessment` (risks.openapi.yaml) — an immutable point-in-time
 * evaluation (FR-064, ADR-006, ADR-007). Every score/level field here is
 * derived exclusively by the backend `RiskScoringService` and arrives
 * already computed; nothing in `apps/web` ever recomputes one (ADR-006 —
 * "Score in the frontend for responsiveness" is explicitly forbidden).
 */
export interface RiskAssessment {
  readonly id: string;
  readonly assessedBy: UserRef;
  readonly assessedOn: string;
  /** The methodology version pinned at assessment time (FR-068) — never the currently active one once time has passed, so a later methodology change never rescores this record. */
  readonly methodologyVersion: { readonly id: string; readonly versionNumber: number };
  readonly inherentProbability: number;
  readonly inherentImpact: number;
  readonly inherentScore: number;
  readonly inherentLevel: RiskLevel;
  readonly residualProbability: number;
  readonly residualImpact: number;
  readonly residualScore: number;
  readonly residualLevel: RiskLevel;
  readonly controlsConsidered: readonly ControlRef[];
  readonly rationale: string | null;
  readonly previousAssessmentId: string | null;
  readonly levelChange: AssessmentLevelChange;
}

/**
 * Mirrors `CreateRiskAssessmentRequest` (risks.openapi.yaml) —
 * `POST /risks/{riskId}/assessments`. Deliberately excludes `inherentScore`,
 * `inherentLevel`, `residualScore` and `residualLevel` — the API rejects an
 * unknown property with `additionalProperties: false` (FR-062, FR-063), and
 * computing any of them client-side is exactly what ADR-006 forbids. This
 * type is the compile-time half of that guarantee: there is no field here to
 * accidentally populate with a locally computed value.
 */
export interface CreateRiskAssessmentRequest {
  assessedOn?: string;
  inherentProbability: number;
  inherentImpact: number;
  residualProbability: number;
  residualImpact: number;
  controlIdsConsidered?: readonly string[];
  rationale?: string | null;
  /** The methodology version the client scored against (US4 AS5, FR-068). Omit to use the active version; a stale, no-longer-active id is refused with 422 rather than silently rescored. */
  methodologyVersionId?: string | null;
  nextReviewOn?: string | null;
}

/** Mirrors `ScalePoint` (platform.openapi.yaml) — one ordered level of a `RiskMethodologyVersion` axis. */
export interface ScalePoint {
  readonly value: number;
  readonly label: string;
  readonly description?: string | null;
}

/** Mirrors `MatrixCell` (platform.openapi.yaml) — one (probability, impact) combination's pre-derived score/level. */
export interface MethodologyMatrixCell {
  readonly probability: number;
  readonly impact: number;
  readonly score: number;
  readonly level: RiskLevel;
}

/** Mirrors `LevelBand` (platform.openapi.yaml) — a contiguous score range mapped to a `RiskLevel`. */
export interface LevelBand {
  readonly level: RiskLevel;
  readonly minScore: number;
  readonly maxScore: number;
}

/**
 * Mirrors `RiskMethodologyVersion` (platform.openapi.yaml) —
 * `GET /risk-methodology`. FR-061: an organization's configured scales and
 * matrix shape are never assumed to be a fixed 5×5 — every screen that
 * renders a matrix or a scale (the assessment form, the assessment section)
 * reads it from this record rather than hardcoding one.
 */
export interface RiskMethodologyVersion {
  readonly id: string;
  readonly methodologyName: string;
  readonly versionNumber: number;
  readonly probabilityScale: readonly ScalePoint[];
  readonly impactScale: readonly ScalePoint[];
  readonly matrix: readonly MethodologyMatrixCell[];
  readonly levelBands: readonly LevelBand[];
  readonly effectiveFrom: string;
  readonly isActive: boolean;
  readonly createdBy: UserRef;
}

/** Mirrors `CreateRiskRequest` (risks.openapi.yaml) — `POST /risks`. `additionalProperties: false` on the server: never add a field here that is not in the contract. */
export interface CreateRiskRequest {
  title: string;
  description: string;
  categoryId?: string | null;
  typeId?: string | null;
  originId?: string | null;
  orgUnitId: string;
  ownerUserId: string;
  responsibleUserId?: string | null;
  identifiedOn?: string;
  nextReviewOn?: string | null;
  causes?: readonly string[];
  consequences?: readonly string[];
}

/** Mirrors `UpdateRiskRequest` (risks.openapi.yaml) — `PATCH /risks/{riskId}`. Partial: omitted properties are left unchanged server-side. */
export interface UpdateRiskRequest {
  title?: string;
  description?: string;
  categoryId?: string | null;
  typeId?: string | null;
  originId?: string | null;
  orgUnitId?: string;
  ownerUserId?: string;
  responsibleUserId?: string | null;
  identifiedOn?: string;
  nextReviewOn?: string | null;
}

/** Mirrors `ReplaceRiskStatementsRequest` (risks.openapi.yaml) — `PUT /risks/{riskId}/causes|consequences`. */
export interface ReplaceRiskStatementsRequest {
  items: readonly string[];
}

// ---------------------------------------------------------------------
// Lifecycle and approvals (US6, T158-T162, FR-029/FR-029a-d, FR-079 to
// FR-085, ADR-006)
// ---------------------------------------------------------------------

/**
 * Mirrors `Approval` (risks.openapi.yaml) — a request for, and decision on,
 * a transition requiring segregation of duties (FR-029b). The requesting
 * and deciding users always differ once `status` is no longer `PENDING`
 * (FR-029a) — enforced server-side, never assumed here.
 */
export interface Approval {
  readonly id: string;
  /** The gated transition, e.g. `"UNDER_TREATMENT->ACCEPTED"` — display only; never parsed. */
  readonly requestedTransition: string;
  readonly requestedBy: UserRef;
  readonly requestedAt: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly decidedBy: UserRef | null;
  readonly decidedAt: string | null;
  readonly justification: string | null;
}

/**
 * Mirrors one entry of `RiskLifecycleState.availableTransitions`
 * (risks.openapi.yaml) — a transition valid from the current state AND
 * permitted to this caller (FR-080, FR-082). Advisory: the server
 * re-evaluates the same declarative transition table on every
 * `POST /transitions|/approvals` (FR-081, ADR-006) — this shape is never
 * used to decide whether an action is allowed, only whether to render it.
 */
export interface AvailableRiskTransition {
  readonly toStatus: RiskStatus;
  readonly requiredPermission: string;
  /** True for transitions into `ACCEPTED`/`CLOSED` in this release — must be requested via `POST /approvals`, never applied directly (FR-029). */
  readonly requiresApproval: boolean;
  readonly preconditionsMet: boolean;
  /** What is missing, already phrased for display (FR-081, US6 AS3) — never re-derived client-side. */
  readonly unmetPreconditions?: readonly string[];
}

/** Mirrors `RiskLifecycleState` (risks.openapi.yaml) — `GET /risks/{riskId}/lifecycle` (FR-080, FR-082, ADR-006). */
export interface RiskLifecycleState {
  readonly status: RiskStatus;
  /** The pending-approval condition on the risk, if any — a condition, not a lifecycle state of its own (FR-029c). */
  readonly pendingApproval: Approval | null;
  readonly availableTransitions: readonly AvailableRiskTransition[];
  /** Every status this risk's own transition history proves it passed through (F-CV-3) — computed server-side from the append-only transition log, always includes `DRAFT`. Never inferred client-side from `status` alone: that inference is exactly what made an ARCHIVED risk's own past `UNDER_TREATMENT` step read as "never happened" instead of "not available now". */
  readonly traversedStatuses: readonly RiskStatus[];
}

/** Mirrors `TransitionRiskRequest` (risks.openapi.yaml) — `POST /risks/{riskId}/transitions`. `additionalProperties: false` on the server: never add a field here that is not in the contract. */
export interface TransitionRiskRequest {
  toStatus: RiskStatus;
  justification?: string;
}

/** Mirrors `RiskLifecycleTransition` (risks.openapi.yaml) — an append-only record of a state change (FR-083). */
export interface RiskLifecycleTransition {
  readonly id: string;
  readonly fromStatus: RiskStatus;
  readonly toStatus: RiskStatus;
  readonly performedBy: UserRef;
  readonly performedAt: string;
  readonly justification: string | null;
  /** The approval that authorized this transition, for gated transitions; `null` otherwise. */
  readonly approvalId: string | null;
}

/** Mirrors `RequestApprovalRequest` (risks.openapi.yaml) — `POST /risks/{riskId}/approvals`. Only `ACCEPTED`/`CLOSED` are approval-gated in this release (FR-029). */
export interface RequestApprovalRequest {
  toStatus: 'ACCEPTED' | 'CLOSED';
  justification?: string;
}

/** Mirrors `ApprovalDecisionRequest` (risks.openapi.yaml) — `POST /risks/{riskId}/approvals/{approvalId}/decision`. */
export interface ApprovalDecisionRequest {
  decision: 'APPROVED' | 'REJECTED';
  justification?: string;
}

/** Mirrors `VersionConflictProblem` (risks.openapi.yaml) — the `409` body on a stale `If-Match` (FR-103, ADR-013). */
export interface VersionConflictProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  correlationId?: string;
  currentVersion: number;
  currentStatus: RiskStatus;
  modifiedAt?: string;
  modifiedBy?: UserRef;
}

/** Mirrors the `sort` enum of `GET /risks` (risks.openapi.yaml, FR-087) — the only fields the server accepts for ordering the register. */
export type RiskRegisterSortField =
  | 'code'
  | 'title'
  | 'riskLevel'
  | 'status'
  | 'owner'
  | 'nextReviewOn'
  | 'identifiedOn'
  | 'updatedAt';

export type SortDirection = 'asc' | 'desc';

/** Which derived level (`riskLevelBasis`) a `riskLevel` filter/sort applies to (ADR-006). Server default is `RESIDUAL`. */
export type RiskLevelBasis = 'RESIDUAL' | 'INHERENT';

/** Mirrors the query parameters of `GET /risks` (risks.openapi.yaml, FR-086 to FR-090). */
export interface RiskRegisterQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: readonly RiskStatus[];
  riskLevel?: readonly RiskLevel[];
  riskLevelBasis?: RiskLevelBasis;
  categoryId?: readonly string[];
  orgUnitId?: readonly string[];
  includeDescendants?: boolean;
  ownerUserId?: readonly string[];
  overdueReview?: boolean;
  overdueTreatment?: boolean;
  sort?: RiskRegisterSortField;
  direction?: SortDirection;
}

// ---------------------------------------------------------------------
// History and audit (T169-T171, US7, FR-033 to FR-037, FR-105, ADR-007)
// ---------------------------------------------------------------------

/** Mirrors `RiskHistoryEntryType` (risks.openapi.yaml). `RiskHistoryQueryService` currently only ever emits `ASSESSMENT`, `OWNERSHIP_CHANGE`, `TREATMENT_DECISION`, `LIFECYCLE_TRANSITION` and `APPROVAL` (see that service's own header comment) — the other four are declared by the contract for forward compatibility with entry kinds no source produces yet. Kept as the full union here (not a narrower one) so a future backend addition is a compile error to ignore, not a silent gap (F-1's own reasoning applied to this enum). */
export type RiskHistoryEntryType =
  | 'ASSESSMENT'
  | 'LEVEL_CHANGE'
  | 'OWNERSHIP_CHANGE'
  | 'TREATMENT_DECISION'
  | 'TREATMENT_ACTION'
  | 'CONTROL_LINK'
  | 'LIFECYCLE_TRANSITION'
  | 'APPROVAL'
  | 'FIELD_CHANGE';

/**
 * Mirrors `RiskHistoryEntry` (risks.openapi.yaml) plus the additive `id`/
 * `assessedOn` fields `risk-history-entry-response.mapper.ts` documents as
 * beyond the contract's declared properties (that schema sets no
 * `additionalProperties: false`).
 *
 * `occurredAt` and `assessedOn` are NOT interchangeable (F-9,
 * `docs/deferred-findings.md`): `occurredAt` is the instant the platform
 * RECORDED this entry — always present, and what the server orders the
 * merged timeline by. `assessedOn` is the date an ASSESSOR asserts and can
 * backdate — present only on `ASSESSMENT` entries, `null` for every other
 * type. `RiskHistorySection` must never flatten these into one value.
 */
export interface RiskHistoryEntry {
  readonly id: string;
  readonly type: RiskHistoryEntryType;
  readonly occurredAt: string;
  readonly assessedOn: string | null;
  readonly actor: UserRef;
  readonly summary: string;
  readonly previousValue: string | null;
  readonly newValue: string | null;
  readonly referenceId: string | null;
}

/** Mirrors `AuditEvent.outcome` (risks.openapi.yaml, FR-037). */
export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED';

/**
 * Mirrors `AuditEvent` (risks.openapi.yaml, FR-033 to FR-037) — one
 * immutable audit entry. `action`/`entityType` are technical identifiers
 * (CLAUDE.md §11.1) and are never translated for display.
 */
export interface AuditEvent {
  readonly id: string;
  readonly occurredAt: string;
  /** `null` only for a genuine pre-authentication event — `actorLabel` is the recorded display name regardless (so history reads correctly after a rename). */
  readonly actor: UserRef | null;
  readonly actorLabel: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  /** Allow-listed fields only (FR-035) — secrets, credentials and session identifiers are never eligible. */
  readonly previousValues: Record<string, unknown> | null;
  readonly newValues: Record<string, unknown> | null;
  readonly outcome: AuditOutcome;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly correlationId: string;
}

/** A page envelope, mirroring `PageMeta` (risks.openapi.yaml). */
export interface Page<T> {
  data: readonly T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Front H (`SearchablePicker`): what a registry-lookup function returns —
 * the current page's rows plus whether more exist server-side than fit in
 * it. `isPartial` is derived from the SAME page (`data.length <
 * meta.total`), never a second request.
 */
export interface RegistrySearchResult<T> {
  readonly data: readonly T[];
  readonly isPartial: boolean;
}

/**
 * 013-incidents-problems-reverse-links — READ-ONLY reverse of
 * `IncidentRiskLink`/`ProblemRiskLink` (`GET /risks/{riskId}/incidents`,
 * `GET /risks/{riskId}/problems`). `modules/risk` never writes either
 * table — `POST`/`DELETE /incidents/{incidentId}/risks` and
 * `POST`/`DELETE /problems/{problemId}/risks` own those write paths.
 * `IncidentRef`/`ProblemRef` are deliberately minimal (id/code/title/
 * status only, ADR-020 part 4) — never the full `Incident`/`Problem`
 * shape those modules' own contracts declare.
 */
export type IncidentStatusRef = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type ProblemStatusRef = 'OPEN' | 'IN_ANALYSIS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface IncidentRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatusRef;
}

export interface ProblemRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: ProblemStatusRef;
}

/** `linkedBy` here carries no `email` (`{id, fullName}` only) — the shape
 * `IncidentRiskLink`/`ProblemRiskLink` (risks.openapi.yaml) actually
 * declare, unlike `RiskControlLink`'s own `UserRef`. */
export interface LinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface RiskIncidentLink {
  readonly id: string;
  readonly incident: IncidentRef;
  readonly linkedBy: LinkUserRef;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

export interface RiskProblemLink {
  readonly id: string;
  readonly problem: ProblemRef;
  readonly linkedBy: LinkUserRef;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}
