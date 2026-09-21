/**
 * T028/003-controls-management, User Story 2 — port for the immutable
 * `control_assessments` table (data-model.md §2). There is deliberately no
 * `update`/`delete` method on this port — FR-010 forbids both, and the
 * absence of a mutation method here is itself part of the enforcement
 * (mirrors `RiskAssessmentRepositoryPort`'s own "no update/no delete path
 * exists" convention). `attest` is the ONE exception: it fills exactly
 * `attestedAt`/`attestedByUserId` on an APPROVED attestation decision —
 * every other column, once written by `create`, never changes again.
 *
 * `infrastructure/control-assessment.repository.ts` is the only
 * implementation.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ControlAssessmentForEffectiveness } from '../control-effectiveness.service';
import type { ControlAssessmentResult } from '@prisma/client';

export interface ControlUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

/** One `ControlAssessment`, exactly as the presentation layer needs it —
 * `attestedAt`/`attestedByUserId` are `undefined` until an `APPROVED`
 * attestation decision fills them (data-model.md §2). The pending/decided
 * attestation LIFECYCLE itself (`ControlAssessmentAttestation`,
 * `PENDING`/`APPROVED`/`REJECTED`) is a separate concept, read from
 * `ControlAssessmentApprovalRepositoryPort` — this record only ever
 * reflects the assessment's OWN, immutable-except-for-attestation columns. */
export interface ControlAssessmentRecord {
  readonly id: string;
  readonly controlId: string;
  readonly assessedOn: Date;
  readonly assessor: ControlUserRef;
  readonly result: ControlAssessmentResult;
  readonly conclusion: string;
  readonly approvalId: string | undefined;
  readonly attestedAt: Date | undefined;
  readonly attestedByUserId: string | undefined;
  readonly createdAt: Date;
}

export interface CreateControlAssessmentInput {
  readonly controlId: string;
  readonly assessedOn: Date;
  readonly assessorUserId: string;
  readonly result: ControlAssessmentResult;
  readonly conclusion: string;
}

/** The join this workstream's `ActionOriginAccessor`/`EvidenceSubjectAccessor`
 * need to resolve a bare assessment id (no `controlId` in scope, since
 * `Action.originId`/`EvidenceLink.subjectId` carry only the assessment's
 * own id) back to its parent control's organizational unit and display
 * label (data-model.md §7, research.md D-5). */
export interface ControlAssessmentOriginLookup {
  readonly assessmentId: string;
  readonly controlId: string;
  readonly controlOrgUnitId: string;
  readonly controlCode: string;
  readonly assessedOn: Date;
}

export abstract class ControlAssessmentRepositoryPort {
  /** Pure insert — no scope predicate: the caller
   * (`CreateControlAssessmentUseCase`) has already resolved and
   * scope-checked the parent `Control` before this is ever called (same
   * reasoning as `RiskAssessmentRepositoryPort.create`). */
  abstract create(input: CreateControlAssessmentInput): Promise<ControlAssessmentRecord>;

  /** Single-row lookup by `(controlId, id)` — `undefined` if it does not
   * exist or belongs to a different control. */
  abstract findById(controlId: string, id: string): Promise<ControlAssessmentRecord | undefined>;

  /** Every assessment for `controlId`, newest first by `(assessedOn DESC,
   * createdAt DESC)` — the exact ordering `control_assessments`'s own
   * index and `ControlEffectivenessService#mostRecent` both use
   * (data-model.md §2). */
  abstract listByControl(
    controlId: string,
    page: number,
    pageSize: number,
  ): Promise<{ readonly items: readonly ControlAssessmentRecord[]; readonly total: number }>;

  /** Every assessment for `controlId` (attested or not, unpaginated) —
   * fed to `calculateControlEffectiveness` (D-2) by
   * `DecideControlAssessmentAttestationUseCase` to compute the
   * before/after effectiveness an `APPROVED` decision may change
   * (FR-020). */
  abstract listAllForEffectiveness(
    controlId: string,
  ): Promise<readonly ControlAssessmentForEffectiveness[]>;

  /**
   * FR-016/D-3 — fills `approvalId` on `requestControlAssessmentAttestation`
   * (before any decision exists). The ONLY write besides `create`/`attest`
   * this port ever performs.
   */
  abstract setApprovalId(id: string, approvalId: string): Promise<void>;

  /**
   * FR-020 — fills `attestedAt`/`attestedByUserId` on an `APPROVED`
   * attestation decision. Never called for `REJECTED` (data-model.md §4:
   * "REJECTED registra a decisão sem atestar a verificação").
   */
  abstract attest(id: string, attestedAt: Date, attestedByUserId: string): Promise<void>;

  /** Task C — resolves a bare assessment id to its parent control's scope
   * and label, for `ControlAssessmentActionOriginAccessor`. `undefined` if
   * the assessment does not exist at all (never scope-filtered here — the
   * caller applies `isOrgUnitWithinScope` itself, exactly like
   * `FindingActionOriginAccessor`'s underlying `GetFindingUseCase` does
   * internally). */
  abstract findForOrigin(assessmentId: string): Promise<ControlAssessmentOriginLookup | undefined>;

  /** Task C, `ActionOriginAccessor.listOriginIdsInScope` — every
   * assessment id whose parent control's CURRENT organizational unit is
   * included in `scope.unitIds`, in one query (never one call per
   * candidate id). */
  abstract listAssessmentIdsInScope(scope: ScopeFilter): Promise<readonly string[]>;
}
