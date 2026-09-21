/**
 * PharosGRC frontend — Compliance types (004-compliance-management).
 *
 * Hand-written against `specs/004-compliance-management/contracts/
 * compliance.openapi.yaml`, mirroring `features/controls/types.ts`'s own
 * discipline: every shape below names a real schema in that contract, and
 * every server-owned/derived field (`code`, `status`, `version`,
 * `complianceState`, `publishedAt`, `publishedBy`) is modeled as
 * response-only — no request type here can express it.
 *
 * ## Scope of this file
 *
 * All 23 contract operations are wired server-side, including
 * `listRequirements`/`getRequirement` (operations 10/12), requirement↔control
 * mapping, applicability declaration, mapping migration and the compliance
 * summary — this file models every one of them.
 *
 * Deliberately self-contained: nothing here is imported from
 * `features/controls/types` or `features/risks/types` (CLAUDE.md §2, §4,
 * §19 — business modules must not depend directly on each other). A control
 * referenced from this module (`ControlRef`, on a requirement-control link)
 * is modeled locally, in exactly the shape `ControlDirectoryPort` exposes it
 * through the API (ADR-020) — never imported from `features/controls`.
 */

/** Mirrors `enum FrameworkOrigin`. */
export type FrameworkOrigin = 'EXTERNAL_STANDARD' | 'INTERNAL_POLICY';

/** Mirrors `enum FrameworkVersionStatus` (research.md D-3) — `PUBLISHED` is terminal. */
export type FrameworkVersionStatus = 'DRAFT' | 'PUBLISHED';

/**
 * Mirrors `enum RequirementComplianceState` (data-model.md §7, FR-017 to
 * FR-020) — the requirement's DERIVED compliance state, computed exclusively
 * by `RequirementComplianceService` server-side. No request type in this
 * file ever accepts this as input — the contract rejects it as an unknown
 * property everywhere (research.md D-8).
 */
export type RequirementComplianceState =
  'NOT_APPLICABLE' | 'NOT_MET' | 'NOT_PROVEN' | 'PARTIALLY_MET' | 'COMPLIANT';

export type SortDirection = 'asc' | 'desc';

/** Mirrors `listFrameworks`'s own `sort` enum (`ListFrameworksQueryDto`). */
export type FrameworkListSortField = 'code' | 'name' | 'updatedAt';

/** Mirrors `UserRef`-shaped references used throughout this contract. */
export interface UserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email?: string;
}

/** Mirrors `Framework` (compliance.openapi.yaml) — the normative library's own root: a norm, without its versions. */
export interface Framework {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly origin: FrameworkOrigin;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirrors `CreateFrameworkRequest` — `code`/`version` are server-owned and never expressible here. */
export interface CreateFrameworkRequest {
  name: string;
  description: string;
  origin: FrameworkOrigin;
}

/** Mirrors `UpdateFrameworkRequest` — partial; `minProperties: 1` enforced by the server. */
export interface UpdateFrameworkRequest {
  name?: string;
  description?: string;
  origin?: FrameworkOrigin;
}

/** Mirrors `FrameworkVersion.framework` — the minimal parent reference embedded on a version. */
export interface FrameworkVersionFrameworkRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `FrameworkVersion` (compliance.openapi.yaml) — a revision of the norm; the thing that is actually measured. */
export interface FrameworkVersion {
  readonly id: string;
  readonly framework: FrameworkVersionFrameworkRef;
  readonly label: string;
  readonly status: FrameworkVersionStatus;
  readonly publishedAt: string | null;
  readonly publishedBy: UserRef | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirrors `CreateFrameworkVersionRequest` — `status`/`publishedAt`/`publishedBy`/`version` are server-owned. */
export interface CreateFrameworkVersionRequest {
  label: string;
}

/** Mirrors `UpdateFrameworkVersionRequest` — `label` is the version's only editable field, and only while `DRAFT` (FR-006). */
export interface UpdateFrameworkVersionRequest {
  label: string;
}

/** Mirrors `Requirement.frameworkVersion` — the minimal parent reference embedded on a requirement. */
export interface RequirementFrameworkVersionRef {
  readonly id: string;
  readonly label: string;
  readonly status: FrameworkVersionStatus;
}

/** Mirrors `RequirementApplicabilityDeclaration` as embedded on `Requirement.applicability` — `null` means applicable (the default). Declaring/revoking this is User Story 3's own scope, not built by this phase. */
export interface RequirementApplicability {
  readonly id: string;
  readonly justification: string;
  readonly declaredBy: UserRef;
  readonly declaredAt: string;
  readonly revokedBy: UserRef | null;
  readonly revokedAt: string | null;
}

/** Mirrors `Requirement` (compliance.openapi.yaml) — the clause itself. `applicability`/`complianceState` are always freshly derived (research.md D-8), never stored input. */
export interface Requirement {
  readonly id: string;
  readonly frameworkVersion: RequirementFrameworkVersionRef;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
  readonly applicability: RequirementApplicability | null;
  readonly complianceState: RequirementComplianceState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirrors `CreateRequirementRequest` — `complianceState`/`version` are server-owned and rejected as unknown properties (FR-017). */
export interface CreateRequirementRequest {
  externalRef: string;
  title: string;
  description: string;
}

/** Mirrors `UpdateRequirementRequest` — partial; `minProperties: 1` enforced by the server. */
export interface UpdateRequirementRequest {
  externalRef?: string;
  title?: string;
  description?: string;
}

/** Mirrors the query parameters of `GET /frameworks`. */
export interface FrameworkListQuery {
  page: number;
  pageSize: number;
  q?: string;
  origin?: readonly FrameworkOrigin[];
  sort?: FrameworkListSortField;
  direction?: SortDirection;
}

/** Mirrors the query parameters of `GET /frameworks/{frameworkId}/versions`. */
export interface FrameworkVersionListQuery {
  page: number;
  pageSize: number;
  status?: readonly FrameworkVersionStatus[];
}

/** Mirrors the query parameters of `GET .../versions/{versionId}/requirements`. */
export interface RequirementListQuery {
  page: number;
  pageSize: number;
  complianceState?: readonly RequirementComplianceState[];
}

/** A page envelope, mirroring `PageMeta` (compliance.openapi.yaml). */
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
 * Mirrors `ControlRef` — the minimum a requirement may know about a control
 * that satisfies it, read through `ControlDirectoryPort` (ADR-020 part 4),
 * never the control's own domain model from `features/controls`.
 */
export interface ControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `RequirementControlLink` (data-model.md §4, ADR-008) — the explicit N:M requirement↔control mapping. */
export interface RequirementControlLink {
  readonly id: string;
  readonly control: ControlRef;
  readonly linkedBy: UserRef;
  readonly linkedAt: string;
  readonly unlinkedBy: UserRef | null;
  readonly unlinkedAt: string | null;
}

/** Mirrors `LinkRequirementControlRequest`. */
export interface LinkRequirementControlRequest {
  controlId: string;
}

/** Mirrors `DeclareApplicabilityRequest` — `justification` is mandatory (FR-015). */
export interface DeclareApplicabilityRequest {
  justification: string;
}

/**
 * Mirrors `ComplianceSummary` — the version's calculated compliance state
 * (FR-020), aggregated from the same `RequirementComplianceState` every
 * requirement of the version reports individually (research.md D-8).
 */
export interface ComplianceSummary {
  readonly frameworkVersion: RequirementFrameworkVersionRef;
  readonly totalRequirements: number;
  readonly applicableRequirementCount: number;
  readonly counts: {
    readonly notApplicable: number;
    readonly notMet: number;
    readonly notProven: number;
    readonly partiallyMet: number;
    readonly compliant: number;
  };
  readonly compliancePercentage: number | null;
  readonly computedAt: string;
}

/** Mirrors `MappingMigrationOutcome` (data-model.md §5, research.md D-6). */
export type MappingMigrationOutcome = 'COPIED' | 'PENDING_DECISION' | 'SKIPPED_ALREADY_MAPPED';

/** The minimal requirement reference embedded in a mapping migration item. */
export interface MappingMigrationRequirementRef {
  readonly id: string;
  readonly externalRef: string;
  readonly title: string;
}

/** Mirrors `MappingMigrationCorrespondence` — the compliance manager's own decision, never inferred by the server (research.md D-6). */
export interface MappingMigrationCorrespondence {
  targetRequirementId: string;
  sourceRequirementIds: readonly string[];
}

/** Mirrors `ExecuteMappingMigrationRequest`. */
export interface ExecuteMappingMigrationRequest {
  sourceFrameworkVersionId: string;
  correspondences: readonly MappingMigrationCorrespondence[];
}

/** Mirrors `MappingMigrationItem` — one target requirement's outcome. */
export interface MappingMigrationItem {
  readonly targetRequirement: MappingMigrationRequirementRef;
  readonly sourceRequirements: readonly MappingMigrationRequirementRef[];
  readonly outcome: MappingMigrationOutcome;
  readonly copiedLinkCount: number;
}

/** Mirrors `MappingMigrationSummary`. */
export interface MappingMigrationSummary {
  readonly id: string;
  readonly sourceFrameworkVersion: RequirementFrameworkVersionRef;
  readonly targetFrameworkVersion: RequirementFrameworkVersionRef;
  readonly executedBy: UserRef;
  readonly executedAt: string;
  readonly itemCount: number;
  readonly copiedCount: number;
  readonly pendingDecisionCount: number;
  readonly skippedAlreadyMappedCount: number;
}

/** Mirrors `MappingMigrationDetail` — the full per-requirement outcome of one migration execution. */
export interface MappingMigrationDetail extends MappingMigrationSummary {
  readonly items: readonly MappingMigrationItem[];
}
