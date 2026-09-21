/**
 * T026/004-compliance-management — port for persisting and reading
 * `Requirement` records (contract operations 11, 13, plus the internal
 * read/list use cases T027 also builds ahead of their own controller
 * wiring — T056, Fase 5). No `ScopeFilter` anywhere (research.md D-2).
 */
import type { RequirementComplianceState, FrameworkVersionStatus } from '@prisma/client';

export interface RequirementFrameworkVersionRef {
  readonly id: string;
  readonly label: string;
  readonly status: FrameworkVersionStatus;
}

export interface RequirementUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

/** The currently-active not-applicable declaration, embedded on
 * `Requirement.applicability` (contract schema
 * `RequirementApplicabilityDeclaration`) — `undefined` means applicable
 * (the default, FR-015 AS1). A minimal read-side projection, not the full
 * domain entity User Story 3 (T045, out of this workstream's own scope)
 * will own. */
export interface RequirementApplicabilityRef {
  readonly id: string;
  readonly justification: string;
  readonly declaredBy: RequirementUserRef;
  readonly declaredAt: Date;
}

/** One `Requirement`, exactly as the presentation layer's mapper needs it.
 * `complianceState` is ALWAYS computed fresh (research.md D-8) — see
 * `application/requirement-compliance-reader.service.ts` for how this
 * workstream gathers its (currently trivial) inputs. */
export interface RequirementRecord {
  readonly id: string;
  readonly frameworkVersion: RequirementFrameworkVersionRef;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
  readonly applicability: RequirementApplicabilityRef | undefined;
  readonly complianceState: RequirementComplianceState;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** The plain, undecorated row this module's own tables hold — before the
 * reader service (application layer) resolves `applicability`/
 * `complianceState` on top of it. Kept separate from `RequirementRecord`
 * so the repository never needs to know about `ControlDirectoryPort`/
 * `ControlEffectivenessPort` (D-9) — those belong to the application
 * layer, not to a Prisma-backed repository (ADR-011). */
export interface RequirementRow {
  readonly id: string;
  readonly frameworkVersion: RequirementFrameworkVersionRef;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateRequirementInput {
  readonly frameworkVersionId: string;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
  readonly createdByUserId: string;
}

/** `undefined` = leave unchanged. */
export interface UpdateRequirementChanges {
  readonly externalRef?: string;
  readonly title?: string;
  readonly description?: string;
}

export type RequirementUpdateResult =
  | { readonly outcome: 'UPDATED'; readonly row: RequirementRow }
  | { readonly outcome: 'NOT_FOUND' }
  | { readonly outcome: 'VERSION_CONFLICT'; readonly currentVersion: number };

export interface RequirementListPage {
  readonly items: readonly RequirementRow[];
  readonly total: number;
}

export abstract class RequirementRepositoryPort {
  abstract create(input: CreateRequirementInput): Promise<RequirementRow>;

  /** `undefined` when no requirement with this id exists — never filtered
   * by scope (research.md D-2). */
  abstract findById(id: string): Promise<RequirementRow | undefined>;

  abstract list(
    frameworkVersionId: string,
    page: number,
    pageSize: number,
  ): Promise<RequirementListPage>;

  /**
   * T036/T054/004-compliance-management — every requirement of a version,
   * unpaginated, ordered by `externalRef`. Used only by internal,
   * whole-version batch operations bounded to SC-008's own 500-requirement
   * scope: `ExecuteMappingMigrationUseCase` (must classify EVERY target
   * requirement, not one page of it) and
   * `GetFrameworkVersionComplianceSummaryUseCase` (must aggregate over
   * every requirement — research.md D-10's own "cabe inteiro em uma única
   * leitura"). Never exposed through `listRequirements` (`list` above),
   * which stays capped at 100 rows per page like every other listing in
   * this API.
   */
  abstract findAllByFrameworkVersion(
    frameworkVersionId: string,
  ): Promise<readonly RequirementRow[]>;

  /**
   * Applies `changes` iff the row's current `version` equals
   * `expectedVersion` — the same conditional-`UPDATE` mechanism every
   * other repository in this module uses. The parent version's `DRAFT`
   * status is checked by the USE CASE before this is ever called
   * (`isRequirementEditable`, `requirement.entity.ts`) — this method does
   * not re-check it; if the parent was published in the narrow race
   * between that check and this call, the
   * `requirements_immutable_after_publish` trigger (T006) rejects the
   * underlying `UPDATE` regardless, and the implementation translates that
   * rejection into `outcome: 'VERSION_CONFLICT'`-shaped safety rather than
   * letting a raw database error escape (see the implementation's own
   * comment for the exact detection).
   */
  abstract updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: UpdateRequirementChanges,
  ): Promise<RequirementUpdateResult>;

  /**
   * The currently-active not-applicable declaration for `requirementId`,
   * or `undefined` (applicable, the default). Reads
   * `requirement_applicability_declarations` directly — a table THIS
   * module owns (data-model.md §6), so this is an intra-module read, not
   * a cross-module boundary crossing; User Story 3 (T045, out of this
   * workstream's own scope) is what will add the WRITE path and the full
   * domain entity for this table. Used by
   * `application/requirement-compliance-reader.service.ts` to populate
   * both `Requirement.applicability` and the `applicability` input of
   * `calculateRequirementComplianceState` — always `undefined` today,
   * since no write path exists yet to populate a row.
   */
  abstract findActiveApplicability(
    requirementId: string,
  ): Promise<RequirementApplicabilityRef | undefined>;

  /** Batch form of `findActiveApplicability` — one query for every id in
   * `requirementIds` (research.md D-10's own "uma leitura em lote"), used
   * by `RequirementComplianceReaderService.deriveForMany` (a listing, or
   * the compliance-summary endpoint's whole-version aggregate) instead of
   * one call per row. An id with no active declaration is simply absent
   * from the map. */
  abstract findActiveApplicabilityMany(
    requirementIds: readonly string[],
  ): Promise<ReadonlyMap<string, RequirementApplicabilityRef>>;

  /**
   * The control ids currently linked to `requirementId`
   * (`requirement_control_links.unlinked_at IS NULL`) — reads a table THIS
   * module owns, the same reasoning as `findActiveApplicability` above.
   * User Story 2 (T032, out of this workstream's own scope) is what will
   * add the WRITE path. Used by the reader service to resolve, via
   * `ControlDirectoryPort`/`ControlEffectivenessPort` (research.md D-9),
   * the `linkedControls` input of `calculateRequirementComplianceState` —
   * always empty today, since no write path exists yet to populate a row.
   */
  abstract findActiveLinkedControlIds(requirementId: string): Promise<readonly string[]>;

  /** Batch form of `findActiveLinkedControlIds` — one query for every id
   * in `requirementIds`, used by `deriveForMany` for the identical reason
   * `findActiveApplicabilityMany` is. An id with no active link is simply
   * absent from the map. */
  abstract findActiveLinkedControlIdsMany(
    requirementIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
