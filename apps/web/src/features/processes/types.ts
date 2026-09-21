/**
 * PharosGRC frontend — Process Management types (T045, 006-assets-processes).
 *
 * Hand-written against `specs/006-assets-processes/contracts/
 * processes.openapi.yaml`, which the contract's own top-level description
 * states is "identical in form" to `assets.openapi.yaml` (FR-020) — the only
 * differences are the resource name and the `PRC` code prefix. This file
 * mirrors `features/assets/types.ts` shape-for-shape for that reason, and
 * mirrors the same discipline `features/controls/types.ts`/`features/audit-
 * engagements/types.ts` already established: every shape below names a real
 * schema in the contract, and every field the contract marks `readOnly` (or
 * documents as server-computed — `id`, `code`, `orgUnit`, `isActive`,
 * `updatedAt`, `createdAt`, `risks`, `controls`) is response-only here. No
 * request type in this file can even express `code` or `isActive`
 * (invariant A6, data-model.md §4) — exactly as the global validation pipe
 * rejects them as unknown properties.
 *
 * **No optimistic locking, deliberately.** `processes` carries no `version`
 * column, and this contract's own top-level description explains why it
 * "deliberately does not invent one": no operation declares `If-Match`, no
 * response declares `ETag`, and no response uses `409` for a version
 * conflict. Consequently this file declares no `VersionConflictProblem` and
 * no `*WithEtag`/`*WithVersion` wrapper type — unlike `features/controls/
 * types.ts`'s `ControlWithVersion` or `features/audit-engagements/types.ts`'s
 * `AuditEngagementWithEtag`. `features/processes/api.ts` uses only the
 * plain, non-`WithMeta` methods of `apiClient`.
 *
 * Deliberately self-contained (CLAUDE.md §2, §4, §19 — business modules must
 * not depend directly on each other): `OrgUnitRef`, `RiskRef`, `ControlRef`
 * and `OrgUnitNode` below are declared locally rather than imported from
 * `features/assets/types`/`features/controls/types`/`features/risks/types`,
 * exactly as those modules' own files each declare their own local copy
 * instead of importing one another's.
 */

export type SortDirection = 'asc' | 'desc';

/** Mirrors the `sort` enum of `GET /processes` (`listProcessCatalog`). */
export type ProcessListSortField = 'code' | 'name' | 'updatedAt';

/** Mirrors `OrgUnitRef` (processes.openapi.yaml) — `{id, code, name}`, the same shape `features/controls/types.ts`'s/`features/risks/types.ts`'s own `OrgUnitRef` carries. Distinct from `features/audit-engagements/types.ts`'s `{id, name}` copy (that contract's own, narrower schema) — see this module's own `types.test.ts` for the compile-time regression this distinction guards against. */
export interface OrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `RiskRef` (processes.openapi.yaml, ADR-020 part 4) — the minimal, read-only projection of a `Risk` this API ever shows: id, code and title only, never status, owner or risk level. */
export interface RiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

/** Mirrors `ControlRef` (processes.openapi.yaml, ADR-020 part 4) — id, code and name only, never status, owner or effectiveness. */
export interface ControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `OrgUnitNode` (admin.openapi.yaml) — `GET /org-units`, reused identically to `features/controls/types.ts`'s/`features/assets/types.ts`'s own declaration (all mirror the same server schema; declaring it locally keeps this feature self-contained). */
export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

/** Mirrors `ProcessSummary` (processes.openapi.yaml) — one catalog row; also the shape shared by `ProcessDetail`. */
export interface ProcessSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Server-truncated 200-character projection of the description, list previews only (never `description` itself, which appears only on `ProcessDetail`). `null` when the process has no description. */
  readonly descriptionExcerpt: string | null;
  /**
   * REQUIRED property, NULLABLE value — deliberately, per the contract's own
   * comment on this field. `null` only for a process minted before this
   * module existed, whose minimal registry row never carried an
   * organizational unit (data-model.md §1/§6, research.md D-2). `NULL` is
   * invisible to any scope-by-unit caller — never an invented unit. Every
   * render site must treat this as an honest "not set", never crash on it.
   */
  readonly orgUnit: OrgUnitRef | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

/** Mirrors `ProcessDetail` (processes.openapi.yaml) — `GET /processes/{processId}`. No `version` field: see this file's own header comment. */
export interface ProcessDetail extends ProcessSummary {
  /** Stored intact regardless of length. `null` when none was recorded. */
  readonly description: string | null;
  readonly createdAt: string;
  /**
   * The risks this process is CURRENTLY linked to (FR-008) — active
   * `RiskProcessLink`s only, read from the process's own side. Read-only
   * here by design: created and withdrawn only from the Risk module's own
   * contract (`POST`/`DELETE /risks/{riskId}/processes`). A withdrawn link
   * is never included here.
   */
  readonly risks: readonly RiskRef[];
  /**
   * The controls this process is CURRENTLY linked to (FR-008) — active
   * `ControlProcessLink`s only. Read-only here by design: created and
   * withdrawn only from the Control module's own contract (`POST`/`DELETE
   * /controls/{controlId}/processes`).
   */
  readonly controls: readonly ControlRef[];
}

/** Mirrors `CreateProcessRequest` — creates an active process. `code` and `isActive` are server-owned and never expressible here (invariant A6). */
export interface CreateProcessRequest {
  name: string;
  description?: string;
  /** Required (invariant A1). Must lie inside the caller's authorized organizational scope, or refused with `422` (invariant A2). */
  orgUnitId: string;
}

/** Mirrors `UpdateProcessRequest` — partial; omitted properties are left unchanged server-side. `code` and `isActive` are read-only and rejected if supplied — situation changes only through `POST /processes/{processId}/deactivate` and `.../reactivate`. */
export interface UpdateProcessRequest {
  name?: string;
  description?: string;
  /** Reassignment is refused with `422` if the target unit does not exist or lies outside the caller's authorized scope (invariant A2). */
  orgUnitId?: string;
}

/** Mirrors the query parameters of `GET /processes`. */
export interface ProcessListQuery {
  page: number;
  pageSize: number;
  /** Case-insensitive text search across process code and name. */
  q?: string;
  /** Always intersected with the caller's own authorized scope server-side — narrows the result, never widens it. */
  orgUnitId?: readonly string[];
  /** Omitted returns both active and inactive processes. */
  isActive?: boolean;
  sort?: ProcessListSortField;
  direction?: SortDirection;
}

/** A page envelope, mirroring `PageMeta` (processes.openapi.yaml). */
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
 * 013-incidents-problems-reverse-links — READ-ONLY reverse of
 * `IncidentProcessLink` (`GET /processes/{processId}/incidents`).
 * `modules/processes` never writes this table —
 * `POST`/`DELETE /incidents/{incidentId}/processes` on the Incident side
 * owns that write path. `IncidentRef` is deliberately minimal
 * (id/code/title/status only, ADR-020 part 4) — never the full `Incident`
 * shape `incidents.openapi.yaml` declares.
 */
export type IncidentStatusRef = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface IncidentRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatusRef;
}

export interface LinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface ProcessIncidentLink {
  readonly id: string;
  readonly incident: IncidentRef;
  readonly linkedBy: LinkUserRef;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}
