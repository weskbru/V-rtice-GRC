/**
 * PharosGRC frontend — Controls Management types (T044).
 *
 * Hand-written against `specs/003-controls-management/contracts/
 * controls.openapi.yaml`, mirroring the same discipline `features/risks/
 * types.ts` established: every shape below names a real schema in that
 * contract, and every field that the contract marks `readOnly` (or
 * documents as server-computed) is modeled as response-only here — no
 * request type in this file can even express `code`, `status`, `version` or
 * `effectiveness`, exactly as the API rejects them as unknown properties.
 *
 * Deliberately self-contained: nothing here is imported from
 * `features/risks/types` (CLAUDE.md §2, §4, §19 — business modules must not
 * depend directly on each other; `RiskRef` below is the one exception the
 * contract itself makes, and it is declared locally rather than borrowed,
 * because ADR-020's `ControlDirectoryPort` boundary exposes only
 * `{id, code, title}` — never the risk's own domain model).
 */

/** Mirrors `enum ControlStatus` (data-model.md §1, D-6). `RETIRED` is terminal. */
export type ControlStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

/** Mirrors `enum ControlNature` (FR-001). */
export type ControlNature = 'MANUAL' | 'AUTOMATED';

/** Mirrors `enum ControlType` (FR-001). */
export type ControlType = 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE';

/** Mirrors `enum ControlFrequency` (D-7). A control may declare none, in which case it has no vencible effectiveness (FR-015). */
export type ControlFrequency =
  'CONTINUOUS' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

/** Mirrors `enum ControlAssessmentResult` (FR-009) — what an assessor records. */
export type ControlAssessmentResult = 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';

/**
 * Mirrors `enum ControlEffectiveness` (data-model.md §3, D-2) — the
 * control's DERIVED, current effectiveness, computed exclusively by
 * `ControlEffectivenessService` server-side (FR-012). No request body in
 * this file ever accepts this as input — see the module doc comment.
 */
export type ControlEffectiveness =
  'NOT_ASSESSED' | 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'EXPIRED';

/** Mirrors `ControlAssessmentAttestation.status`. */
export type AttestationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type SortDirection = 'asc' | 'desc';

/** Mirrors the `sort` enum of `GET /controls` — deliberately narrower than every filterable field: `nature`, `type` and `frequency` are filterable but not sortable (contract's own explanation). */
export type ControlRegisterSortField =
  'code' | 'name' | 'status' | 'effectiveness' | 'owner' | 'updatedAt';

/** Mirrors `UserRef` (controls.openapi.yaml). */
export interface UserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email?: string;
}

/** Mirrors `OrgUnitRef` (controls.openapi.yaml). */
export interface OrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `EntityRef` — one entry of the minimal process/asset registry (spec Assumptions). */
export interface EntityRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/**
 * Mirrors `RiskRef` — the minimum a control may know about a risk it
 * treats, reached through the Risk module's own API via `ControlDirectoryPort`
 * (ADR-020) — never the risk's domain model.
 */
export interface RiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

/** Mirrors `OrgUnitNode` (admin.openapi.yaml) — `GET /org-units`, reused identically to `features/risks/types.ts`'s own declaration (both mirror the same server schema; declaring it locally keeps this feature self-contained). */
export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

/** Mirrors `ControlSummary` (controls.openapi.yaml) — one catalog row; also the shape shared by `ControlDetail`. */
export interface ControlSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Server-truncated 200-character projection of the description, list previews only (never `description` itself, which appears only on `ControlDetail`). */
  readonly descriptionExcerpt: string | null;
  /**
   * `null` only for a control minted before this phase whose minimal Phase-1
   * record never carried an organizational unit (FR-003, US1 AS5 — "os
   * atributos que possui... nunca com valor arbitrado"). The published
   * `controls.openapi.yaml` declares this field required and non-nullable,
   * but the real, deliberately-written mapper
   * (`control-summary-response.mapper.ts`/`control-response.mapper.ts`)
   * returns `null` for exactly this legacy case — this type mirrors the
   * real implementation, per this project's own "contract + real
   * implementation, not just the contract's prose" discipline
   * (`docs/local-environment.md` D-14). Every render site must treat this
   * as an honest "not set", never crash on it.
   */
  readonly orgUnit: OrgUnitRef | null;
  /** `null` until assigned. Required to enter `ACTIVE` (FR-005); a control may exist without one in `DRAFT`. */
  readonly owner: UserRef | null;
  readonly nature: ControlNature | null;
  readonly type: ControlType | null;
  /** `null` means the control has no vencible effectiveness (FR-015). */
  readonly frequency: ControlFrequency | null;
  readonly status: ControlStatus;
  readonly effectiveness: ControlEffectiveness;
  readonly version: number;
  readonly updatedAt: string;
}

/** Mirrors `ControlDetail` (controls.openapi.yaml) — `GET /controls/{controlId}`. */
export interface ControlDetail extends ControlSummary {
  readonly description: string;
  readonly retiredAt: string | null;
  readonly retiredBy: UserRef | null;
  readonly retirementReason: string | null;
  readonly createdAt: string;
}

/** Mirrors `CreateControlRequest` — creates a `DRAFT` control. `code`/`status`/`effectiveness`/`version` are server-owned and never expressible here. */
export interface CreateControlRequest {
  name: string;
  description: string;
  orgUnitId: string;
  ownerUserId?: string | null;
  nature?: ControlNature | null;
  type?: ControlType | null;
  frequency?: ControlFrequency | null;
}

/** Mirrors `UpdateControlRequest` — partial; omitted properties are left unchanged server-side. Lifecycle status changes only through `POST /controls/{controlId}/transitions`. */
export interface UpdateControlRequest {
  name?: string;
  description?: string;
  orgUnitId?: string;
  ownerUserId?: string | null;
  nature?: ControlNature | null;
  type?: ControlType | null;
  frequency?: ControlFrequency | null;
}

/** Mirrors one entry of `ControlLifecycleState.availableTransitions` (D-6) — a transition valid from the current state AND permitted to this caller. Advisory: the server re-evaluates the same declarative table on every `POST /transitions` request. */
export interface AvailableControlTransition {
  readonly toStatus: ControlStatus;
  readonly requiredPermission: string;
  readonly preconditionsMet: boolean;
  readonly unmetPreconditions?: readonly string[];
}

/** Mirrors `ControlLifecycleState` (controls.openapi.yaml) — `GET /controls/{controlId}/lifecycle`. */
export interface ControlLifecycleState {
  readonly status: ControlStatus;
  readonly availableTransitions: readonly AvailableControlTransition[];
}

/** Mirrors `TransitionControlRequest` — `justification` required when `toStatus` is `RETIRED` (US1 AS3). */
export interface TransitionControlRequest {
  toStatus: ControlStatus;
  justification?: string;
}

/** Mirrors `ControlLifecycleTransition` — an append-only record of a state change. */
export interface ControlLifecycleTransition {
  readonly id: string;
  readonly fromStatus: ControlStatus;
  readonly toStatus: ControlStatus;
  readonly performedBy: UserRef;
  readonly performedAt: string;
  readonly justification: string | null;
}

/** Mirrors `ControlAssessmentAttestation` — the attestation lifecycle of one assessment, through the platform's existing generic approval mechanism (`ApprovableEntityType.CONTROL_ASSESSMENT`). At most one exists per assessment. */
export interface ControlAssessmentAttestation {
  readonly id: string;
  readonly status: AttestationStatus;
  readonly requestedBy: UserRef;
  readonly requestedAt: string;
  readonly decidedBy: UserRef | null;
  readonly decidedAt: string | null;
  readonly justification: string | null;
}

/** Mirrors `ControlAssessment` (controls.openapi.yaml) — an immutable point-in-time verification (FR-010). Never updated; a new assessment succeeds this one. */
export interface ControlAssessment {
  readonly id: string;
  readonly assessedOn: string;
  readonly assessor: UserRef;
  readonly result: ControlAssessmentResult;
  readonly conclusion: string;
  /** `null` until `POST .../attestation` has been called for this assessment. */
  readonly attestation: ControlAssessmentAttestation | null;
  readonly createdAt: string;
}

/** Mirrors `CreateControlAssessmentRequest` — the assessor is taken from the session; there is no attestation field here (FR-016). */
export interface CreateControlAssessmentRequest {
  assessedOn: string;
  result: ControlAssessmentResult;
  conclusion: string;
}

/** Mirrors `ControlAssessmentAttestationDecisionRequest` — `POST .../attestation/decision`. */
export interface ControlAssessmentAttestationDecisionRequest {
  decision: 'APPROVED' | 'REJECTED';
  justification?: string;
}

interface RelationshipLinkBase {
  readonly id: string;
  readonly linkedBy: UserRef;
  readonly linkedAt: string;
  readonly unlinkedBy: UserRef | null;
  readonly unlinkedAt: string | null;
}

/** Mirrors `ControlProcessLink` (controls.openapi.yaml, ADR-008). */
export interface ControlProcessLink extends RelationshipLinkBase {
  readonly process: EntityRef;
}

/** Mirrors `ControlAssetLink` (controls.openapi.yaml, ADR-008). */
export interface ControlAssetLink extends RelationshipLinkBase {
  readonly asset: EntityRef;
}

/** Mirrors `ControlRiskLink` (controls.openapi.yaml, ADR-020) — `RiskControlLink` read from the control side; read-only here by design (FR-021). */
export interface ControlRiskLink extends RelationshipLinkBase {
  readonly risk: RiskRef;
}

/** Mirrors `LinkEntityRequest` — the body of `POST /controls/{controlId}/processes|assets`. */
export interface LinkEntityRequest {
  id: string;
}

/** Mirrors `VersionConflictProblem` — the `409` body on a stale `If-Match` (ADR-013 equivalent for Controls). */
export interface VersionConflictProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  correlationId?: string;
  currentVersion: number;
  currentStatus: ControlStatus;
  modifiedAt?: string;
  modifiedBy?: UserRef;
}

/** Mirrors the query parameters of `GET /controls`. */
export interface ControlRegisterQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: readonly ControlStatus[];
  effectiveness?: readonly ControlEffectiveness[];
  nature?: readonly ControlNature[];
  type?: readonly ControlType[];
  frequency?: readonly ControlFrequency[];
  orgUnitId?: readonly string[];
  ownerUserId?: readonly string[];
  sort?: ControlRegisterSortField;
  direction?: SortDirection;
}

/** A page envelope, mirroring `PageMeta` (controls.openapi.yaml). */
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

/** Mirrors the minimal process/asset registry entries `GET /processes|/assets` return (spec Assumptions) — the picker options for the relationship sections. */
export interface RegistryItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly orgUnitId: string | null;
  readonly isActive: boolean;
}
