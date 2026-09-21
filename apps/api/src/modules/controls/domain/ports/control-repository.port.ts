/**
 * T020/003-controls-management — port for persisting and reading `Control`
 * records (operations 1-6 of `contracts/controls.openapi.yaml`). The
 * create/read/update/transition use cases depend on this abstract class,
 * never on the Prisma-backed implementation directly (ADR-011) — the same
 * discipline `RiskRepositoryPort` establishes for Risk.
 *
 * `infrastructure/control.repository.ts` is the only implementation. Every
 * type here is a plain domain-level shape, never a re-export of a Prisma
 * model (ADR-009).
 *
 * `effectiveness` on `ControlRecord` is computed by the repository at read
 * time, via the single calculator (`domain/control-effectiveness.service.ts`,
 * D-2) fed by a fresh scoped read of `control_assessments` — it is never a
 * column this port's `Create*`/`Update*` input shapes accept, matching
 * FR-012's "não pode existir como campo editável".
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  ControlAssessmentForEffectiveness,
  ControlEffectiveness,
} from '../control-effectiveness.service';
import type { ControlFrequency, ControlNature, ControlStatus, ControlType } from '@prisma/client';

export interface ControlOrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ControlUserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

/** One `Control`, exactly as the presentation layer's mapper needs it
 * (every relation already resolved, mirroring `RiskRecord`'s convention).
 * `effectiveness` is derived (data-model.md §3) — never read from a
 * column. */
export interface ControlRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  /** `null` for the vanishingly rare legacy control that predates even the
   * Fase 1 minimal registry's own scoping expectations (`org_unit_id` is
   * nullable on the column — data-model.md §9). Every control created
   * under THIS phase always has one (`CreateControlRequest.orgUnitId` is
   * required); this is a genuine "não com valor arbitrado" case, not a
   * gap in this task's own write path. */
  readonly orgUnit: ControlOrgUnitRefRecord | null;
  /** `undefined` until assigned (FR-005, edge case "controle sem dono"). */
  readonly owner: ControlUserRefRecord | undefined;
  readonly nature: ControlNature | undefined;
  readonly type: ControlType | undefined;
  readonly frequency: ControlFrequency | undefined;
  readonly status: ControlStatus;
  readonly effectiveness: ControlEffectiveness;
  readonly retiredAt: Date | undefined;
  readonly retiredBy: ControlUserRefRecord | undefined;
  readonly retirementReason: string | undefined;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateControlRecordInput {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly orgUnitId: string;
  readonly ownerUserId: string | undefined;
  readonly nature: ControlNature | undefined;
  readonly type: ControlType | undefined;
  readonly frequency: ControlFrequency | undefined;
}

/** `undefined` = leave unchanged; `null` = clear (only meaningful for the
 * nullable fields) — mirrors `UpdateControlRequest`'s partial-update
 * semantics (`contracts/controls.openapi.yaml`: "omitted properties are
 * left unchanged"). */
export interface UpdateControlChanges {
  readonly name?: string;
  readonly description?: string;
  readonly orgUnitId?: string;
  readonly ownerUserId?: string | null;
  readonly nature?: ControlNature | null;
  readonly type?: ControlType | null;
  readonly frequency?: ControlFrequency | null;
}

/**
 * The write a lifecycle transition applies to `controls` in the SAME
 * conditional update as the optimistic-lock check (ADR-013), mirroring
 * `RiskLifecycleUpdateChanges`'s shape. `isActive` is ALWAYS supplied,
 * computed by the caller from `isActiveForControlStatus` (data-model.md
 * §1's single sync point) — this port never derives it itself, so there is
 * exactly one place in the codebase that decides what `isActive` must be
 * for a given `status`.
 */
export interface ApplyControlTransitionChanges {
  readonly status: ControlStatus;
  readonly isActive: boolean;
  /** Set only when `status` is being set to `RETIRED` (FR-006). */
  readonly retiredAt?: Date;
  readonly retiredByUserId?: string;
  readonly retirementReason?: string;
}

export type ControlUpdateResult =
  | { readonly outcome: 'UPDATED'; readonly record: ControlRecord }
  | { readonly outcome: 'NOT_FOUND' }
  | {
      readonly outcome: 'VERSION_CONFLICT';
      readonly currentVersion: number;
      readonly currentStatus: ControlStatus;
    };

export abstract class ControlRepositoryPort {
  abstract create(input: CreateControlRecordInput, referenceDate: Date): Promise<ControlRecord>;

  /** `undefined` when the control does not exist OR exists outside `scope`
   * — the two are indistinguishable by design (FR-007). */
  abstract findById(
    scope: ScopeFilter,
    id: string,
    referenceDate: Date,
  ): Promise<ControlRecord | undefined>;

  /** An UNSCOPED lookup of `id`'s CURRENT `orgUnitId`, ignoring `scope`
   * entirely — used EXCLUSIVELY on the refusal path, after a scoped lookup
   * already returned nothing, so `OrgScopeEnforcerService
   * .assertExistingRecordAccessible` can tell "does not exist" apart from
   * "exists outside scope" (F-38's mechanism, mirrored from
   * `RiskRepositoryPort.findOrgUnitIdUnscoped`). */
  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  /**
   * Applies `changes` iff the row is within `scope` AND its current
   * `version` equals `expectedVersion` — the same race-free single
   * conditional `UPDATE ... WHERE id = ? AND version = ? AND <scope>`
   * mechanism `RiskRepository.updateWithVersion` documents (ADR-013).
   */
  abstract updateWithVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: UpdateControlChanges,
    referenceDate: Date,
  ): Promise<ControlUpdateResult>;

  /** Identical conditional-update mechanism as `updateWithVersion`, against
   * the disjoint `status`/`isActive`/`retiredAt`/`retiredByUserId`/
   * `retirementReason` fields (ADR-013, FR-085's "at most one applied
   * transition" equivalent for Controls). */
  abstract applyLifecycleTransition(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: ApplyControlTransitionChanges,
    referenceDate: Date,
  ): Promise<ControlUpdateResult>;

  /** Every assessment `control_assessments` holds for `controlId`
   * (attested or not — the domain calculator itself discards the
   * unattested ones, `control-effectiveness.service.ts`'s own header),
   * used to compute `ControlRecord.effectiveness`. No scope predicate: the
   * caller has already scope-checked the parent `Control` before this is
   * ever invoked, the same reasoning `RiskAssessmentRepositoryPort.create`
   * documents. */
  abstract listAssessmentsForEffectiveness(
    controlId: string,
  ): Promise<readonly ControlAssessmentForEffectiveness[]>;
}
