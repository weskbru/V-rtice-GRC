/**
 * T029-T031/003-controls-management, User Story 2 — port for the generic
 * `Approval` table, scoped by THIS workstream's own two call sites
 * (`RequestControlAssessmentAttestationUseCase`/
 * `DecideControlAssessmentAttestationUseCase`) to `entityType:
 * 'CONTROL_ASSESSMENT'`. Mirrors
 * `modules/risk/domain/ports/approval-repository.port.ts` exactly — see
 * that file's header for the full rationale this one does not repeat.
 * Declared as its own port, in this module, rather than a shared
 * cross-module "approval port" — `Approval` is a generic table but has no
 * single owning module (research.md D-3: "acrescentar ... um caso de uso,
 * exatamente como a plataforma já faz para aprovações de risco"), and each
 * consumer to date (`modules/risk`, now `modules/controls`) declares its
 * own narrow port against it, exactly like `modules/risk`'s.
 *
 * `infrastructure/control-assessment-approval.repository.ts` is the only
 * implementation.
 */
import type { ControlUserRef } from './control-assessment-repository.port';
import type { ApprovableEntityType, ApprovalStatus } from '@prisma/client';

export interface ControlAssessmentApprovalRecord {
  readonly id: string;
  readonly entityType: ApprovableEntityType;
  readonly entityId: string;
  readonly requestedBy: ControlUserRef;
  readonly requestedAt: Date;
  readonly status: ApprovalStatus;
  readonly decidedBy: ControlUserRef | undefined;
  readonly decidedAt: Date | undefined;
  readonly justification: string | undefined;
}

export interface CreateControlAssessmentApprovalInput {
  readonly entityId: string;
  readonly requestedByUserId: string;
  readonly justification: string | null;
}

export interface DecideControlAssessmentApprovalInput {
  readonly id: string;
  readonly decidedByUserId: string;
  readonly status: Exclude<ApprovalStatus, 'PENDING'>;
  readonly justification: string | null;
}

export abstract class ControlAssessmentApprovalRepositoryPort {
  /** Pure insert, `entityType` always `'CONTROL_ASSESSMENT'` — the caller
   * has already verified D-8 (no existing attestation lifecycle for this
   * assessment) before this is ever called. */
  abstract create(
    input: CreateControlAssessmentApprovalInput,
  ): Promise<ControlAssessmentApprovalRecord>;

  abstract findPendingByEntityId(
    assessmentId: string,
  ): Promise<ControlAssessmentApprovalRecord | undefined>;

  /** Single-row lookup by the approval's own id — used by the presentation
   * layer to resolve `ControlAssessmentRecord.approvalId` into the full
   * `ControlAssessmentAttestation` response shape (`GET .../assessments`/
   * `.../assessments/{id}`). `undefined` if it does not exist. */
  abstract findById(id: string): Promise<ControlAssessmentApprovalRecord | undefined>;

  /** D-8 — every attestation ever requested/decided for `assessmentId`
   * (at most one, by construction) — used to distinguish "never
   * requested" (404) from "already decided" (409) when no PENDING row
   * exists. */
  abstract listByEntityId(
    assessmentId: string,
  ): Promise<readonly ControlAssessmentApprovalRecord[]>;

  /** The ONLY mutation this port performs — mirrors
   * `ApprovalRepositoryPort.decide`'s own "append-only" guarantee, backed
   * by the SAME `approvals_append_only` database trigger. */
  abstract decide(
    input: DecideControlAssessmentApprovalInput,
  ): Promise<ControlAssessmentApprovalRecord>;
}
