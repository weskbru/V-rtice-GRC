/**
 * PharosGRC frontend — Audit Engagement types (T075, 005-audit-findings).
 *
 * Hand-written against `specs/005-audit-findings/contracts/audit.openapi.yaml`
 * (13 of its 20 operations — see the module-boundary note below), mirroring
 * the same discipline `features/controls/types.ts`/`features/compliance/
 * types.ts` already established: every shape names a real schema in that
 * contract, and every field the contract marks `readOnly` (or documents as
 * server-computed — `code`, `status`, `version`, `startedAt`/`startedBy`,
 * `completedAt`/`completedBy`, `cancelledAt`/`cancelledBy`/
 * `cancellationJustification`) is response-only here — no request type in
 * this file can even express them, exactly as the API rejects them as
 * unknown properties.
 *
 * Deliberately self-contained (CLAUDE.md §2, §4, §19 — business modules must
 * not depend directly on each other): `UserRef`, `OrgUnitRef`, `ControlRef`
 * and `RiskRef` below are declared locally rather than imported from
 * `features/risks/types`/`features/controls/types`, exactly like
 * `features/controls/types.ts`'s own `RiskRef` is declared locally instead
 * of imported. The one exception is the `FindingCategory`/`FindingOrigin`/
 * `FindingSeverity`/`FindingPriority`/`FindingStatus` unions used by
 * `FindingSummary` below: these are imported from `@/lib/messages/findings`,
 * the shared pt-BR message catalog (not a business module — see that
 * catalog's own header, and `features/findings/types.ts`'s identical
 * import), so the enum and its translation can never drift apart.
 *
 * Module-boundary note (T075's own instruction): the contract's other 7
 * operations — `startFindingRemediation`, `listFindingControlLinks`,
 * `linkFindingToControl`, `unlinkFindingFromControl`, `listFindingRiskLinks`,
 * `linkFindingToRisk`, `unlinkFindingFromRisk` — all route under
 * `/findings/{findingId}/...`, not `/audits/...`. Following the same
 * URL-root-owns-the-client rule `features/controls/api.ts` already applies
 * to `GET /controls/{controlId}/risks|processes` (Control is the URL root,
 * so Control's own file hosts the call even though the link's other side is
 * a different module), those 7 operations and their supporting types live in
 * `features/findings/{types,api}.ts` instead of here — see that module's own
 * files for the one-line decision comment.
 *
 * `FindingSummary` below is this file's own local, minimal copy of the
 * contract's `FindingSummary` schema — deliberately duplicated in
 * `features/findings/types.ts` too (for the `start-remediation` response),
 * exactly like the contract itself duplicates `FindingStatus` rather than
 * cross-referencing `grc-foundation.openapi.yaml` ("no precedent for that in
 * this codebase — 003/004 each define their own local copies of referenced
 * enums/summaries instead").
 */
import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingStatus,
} from '@/lib/messages/findings';

export type { FindingCategory, FindingOrigin, FindingPriority, FindingSeverity, FindingStatus };

/**
 * Mirrors `enum AuditEngagementStatus` (research.md D-3, amended by FR-004a).
 * Four states, four forward edges, no way back: `PLANNING` -> `IN_PROGRESS`
 * or `CANCELLED`; `IN_PROGRESS` -> `COMPLETED` or `CANCELLED`; `COMPLETED`
 * and `CANCELLED` are both terminal.
 */
export type AuditEngagementStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type SortDirection = 'asc' | 'desc';

/** Mirrors the `sort` enum of `GET /audits`. */
export type AuditEngagementListSortField = 'code' | 'periodStart' | 'updatedAt';

/** Mirrors `enum AuditScopeTargetType` — the three variants an engagement's scope may reference (FR-005). */
export type AuditScopeTargetType = 'FRAMEWORK_VERSION' | 'REQUIREMENT' | 'CONTROL';

/** Mirrors `UserRef` (audit.openapi.yaml). */
export interface UserRef {
  readonly id: string;
  readonly fullName: string;
}

/** Mirrors `OrgUnitRef` (audit.openapi.yaml) — `{id, name}` only, no `code` (the same shape `features/findings/types.ts`'s own `OrgUnitRef` carries, distinct from the RISKS-domain one — assurance-audit Fix 3 precedent). */
export interface OrgUnitRef {
  readonly id: string;
  readonly name: string;
}

/** Mirrors `ControlRef` (audit.openapi.yaml, ADR-020 part 4) — the minimal, read-only projection of a `Control` this API ever shows: id, code and name only, never status, owner or effectiveness. */
export interface ControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `RiskRef` (audit.openapi.yaml, ADR-020 part 4). */
export interface RiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

/** Mirrors `AuditEngagement` (audit.openapi.yaml). */
export interface AuditEngagement {
  readonly id: string;
  readonly code: string;
  objective: string;
  periodStart: string;
  periodEnd: string;
  readonly orgUnit: OrgUnitRef;
  readonly leadAuditor: UserRef;
  readonly status: AuditEngagementStatus;
  readonly startedAt: string | null;
  readonly startedBy: UserRef | null;
  readonly completedAt: string | null;
  readonly completedBy: UserRef | null;
  /** FR-004a. Set only when `status` is `CANCELLED`. */
  readonly cancelledAt: string | null;
  readonly cancelledBy: UserRef | null;
  /** FR-004a. Null unless `status` is `CANCELLED`. */
  readonly cancellationJustification: string | null;
  /** Optimistic-locking version, scoped to this record alone (research.md D-18 — `Finding` predates this convention and was never retrofitted). */
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirrors `CreateAuditEngagementRequest`. `code`/`status`/`version` and every lifecycle timestamp are server-owned and never expressible here. */
export interface CreateAuditEngagementRequest {
  objective: string;
  periodStart: string;
  periodEnd: string;
  orgUnitId: string;
  leadAuditorUserId: string;
}

/** Mirrors `UpdateAuditEngagementRequest` — partial; permitted only while `status = PLANNING` (`422` otherwise). Omitted properties are left unchanged server-side. */
export interface UpdateAuditEngagementRequest {
  objective?: string;
  periodStart?: string;
  periodEnd?: string;
  orgUnitId?: string;
  leadAuditorUserId?: string;
}

/** Mirrors `CancelAuditEngagementRequest` (FR-004a) — `justification` is required and non-blank. */
export interface CancelAuditEngagementRequest {
  justification: string;
}

/** Mirrors `VersionConflictProblem` — the `409` body on a stale `If-Match`. Unlike `controls`'s own copy, this schema carries no `currentStatus` (not declared by this contract). */
export interface VersionConflictProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  correlationId?: string;
  currentVersion: number;
  modifiedAt?: string;
  modifiedBy?: UserRef;
}

/** Mirrors the query parameters of `GET /audits`. */
export interface AuditEngagementListQuery {
  page: number;
  pageSize: number;
  status?: AuditEngagementStatus;
  orgUnitId?: string;
  leadAuditorUserId?: string;
  sort?: AuditEngagementListSortField;
  direction?: SortDirection;
}

/** A page envelope, mirroring `PageMeta` (audit.openapi.yaml). */
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
 * Mirrors `AuditScopeTargetRef` — a minimal, precomputed label for the
 * scoped target, never the referenced entity's own full domain shape
 * (ADR-020 part 4).
 */
export interface AuditScopeTargetRef {
  readonly id: string;
  readonly label: string;
}

/** Mirrors `AuditScopeEntry` (audit.openapi.yaml) — one row of `GET /audits/{auditId}/scope`, any of the three target variants. */
export interface AuditScopeEntry {
  readonly id: string;
  readonly targetType: AuditScopeTargetType;
  readonly target: AuditScopeTargetRef;
  readonly linkedAt: string;
  readonly linkedBy: UserRef;
}

/** Mirrors `AddFrameworkVersionScopeRequest`. */
export interface AddFrameworkVersionScopeRequest {
  frameworkVersionId: string;
}

/** Mirrors `AddRequirementScopeRequest`. */
export interface AddRequirementScopeRequest {
  requirementId: string;
}

/** Mirrors `AddControlScopeRequest`. */
export interface AddControlScopeRequest {
  controlId: string;
}

/**
 * Mirrors `FindingSummary` (audit.openapi.yaml) — this document's own
 * purpose-fit projection of `Finding`, not the exhaustive shape
 * `features/findings/types.ts`'s own `Finding` owns. See this file's own
 * header comment for why a second, independent local copy also lives in
 * `features/findings/types.ts` (the `start-remediation` response).
 */
export interface FindingSummary {
  readonly id: string;
  readonly code: string;
  title: string;
  description?: string;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly owner: UserRef;
  readonly status: FindingStatus;
  /** Null for a finding recorded manually (`POST /findings`); set, and never changeable afterward, for one produced by `createFindingFromEngagement` (SC-001). */
  readonly auditEngagementId: string | null;
  identifiedOn: string;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------
// Reference data (T076) — the create/edit form's org unit and lead auditor
// pickers, and the scope form's three cascading pickers. Declared locally
// rather than imported from `features/controls/types`/`features/compliance/
// types` for the same self-containment reason this file's own header
// explains for `UserRef`/`OrgUnitRef`/`ControlRef`/`RiskRef` above — every
// business module mirrors the server schema it actually calls, never
// reaches across a module boundary for a type another module happens to
// have declared first.
// ---------------------------------------------------------------------

/** Mirrors `OrgUnitNode` (admin.openapi.yaml) — `GET /org-units`, reused identically to `features/controls/types.ts`'s/`features/risks/types.ts`'s own declaration. */
export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

/**
 * Mirrors `Framework` (compliance.openapi.yaml) reduced to what a picker
 * needs — the scope form's first cascading step for both the "Versão de
 * framework" and "Requisito" variants (there is no flat, cross-framework
 * `/framework-versions` or `/requirements` listing endpoint in this API, so
 * the picker walks framework -> version -> (requirement) exactly the way a
 * human would browse the library, ADR-020).
 */
export interface FrameworkRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `FrameworkVersion` (compliance.openapi.yaml) reduced to what the scope form's version picker needs — only ever populated with `status: 'PUBLISHED'` entries (FR-006, research.md D-2: a draft version's requirements are never scopeable). */
export interface FrameworkVersionOption {
  readonly id: string;
  readonly label: string;
}

/** Mirrors `Requirement` (compliance.openapi.yaml) reduced to what the scope form's requirement picker needs. */
export interface RequirementOption {
  readonly id: string;
  readonly externalRef: string;
  readonly title: string;
}

/** Mirrors the query parameters of `GET /audits/{auditId}/findings`. */
export interface AuditEngagementFindingsQuery {
  page: number;
  pageSize: number;
  status?: FindingStatus;
}

/**
 * Mirrors `CreateFindingFromEngagementRequest` — the same fields as
 * `features/findings/types.ts`'s own `CreateFindingRequest`, minus
 * `orgUnitId`: deliberately absent here, never accepted, because it is
 * derived server-side from the engagement's own `orgUnitId` (a finding
 * produced by an engagement can never diverge from the unit being
 * examined).
 */
export interface CreateFindingFromEngagementRequest {
  title: string;
  description: string;
  recommendation?: string;
  category: FindingCategory;
  origin: FindingOrigin;
  severity: FindingSeverity;
  priority: FindingPriority;
  ownerUserId: string;
  identifiedOn: string;
}
