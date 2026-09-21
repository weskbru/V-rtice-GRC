/**
 * T030-T032/003-controls-management, User Story 2 — `DecideControlAssessmentAttestationUseCase`.
 * `POST /controls/{controlId}/assessments/{assessmentId}/attestation/decision`
 * (`decideControlAssessmentAttestation` operation). Requires
 * `control:approve`, DISTINCT from the `control:test` permission
 * `RequestControlAssessmentAttestationUseCase` requires (research.md D-9) —
 * enforced by `@RequirePermission` on the controller route.
 *
 * ## Segregation of duties — two invariants, checked and audited together
 *
 * `checkAttestationSegregation` (`domain/control-assessment-attestation.ts`)
 * evaluates C1 (assessor) and C2 (owner) independently and returns every
 * violation. BOTH are audited when both apply (FR-019) — a single merged
 * reason would not distinguish "tested it" from "owns it", and that
 * distinction is the whole point of the trail. The audit event fires
 * BEFORE the `ValidationDomainError` is thrown, inside the SAME
 * transaction as everything else this use case might otherwise have
 * written (there is nothing else to write on a refusal, but the
 * transaction boundary keeps this call site identical in shape to every
 * other use case's audit-then-return).
 *
 * ## Effectiveness before/after — computed here, never stored
 *
 * `ControlEffectivenessService#calculateControlEffectiveness` (D-2, the
 * single calculator) is called TWICE against the SAME `referenceDate`:
 * once against the assessment history as it stands BEFORE this decision,
 * once again after `attest()` has written `attestedAt`/`attestedByUserId`
 * — both reads inside the same transaction, so the "after" read reflects
 * this decision's own write. `control.effectiveness.changed` is emitted
 * ONLY when the two values differ (FR-020), carrying both.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import {
  ConflictDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import {
  checkAttestationSegregation,
  attestationSegregationMessage,
} from '../../domain/control-assessment-attestation';
import { calculateControlEffectiveness } from '../../domain/control-effectiveness.service';
import { ControlAssessmentApprovalRepositoryPort } from '../../domain/ports/control-assessment-approval-repository.port';
import { ControlAssessmentRepositoryPort } from '../../domain/ports/control-assessment-repository.port';
import { ControlAccessResolver } from '../control-access-resolver.service';

import type { ControlAssessmentApprovalRecord } from '../../domain/ports/control-assessment-approval-repository.port';

export interface DecideControlAssessmentAttestationInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly assessmentId: string;
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly justification?: string | null | undefined;
}

@Injectable()
export class DecideControlAssessmentAttestationUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly controlAccess: ControlAccessResolver,
    private readonly assessmentRepository: ControlAssessmentRepositoryPort,
    private readonly approvalRepository: ControlAssessmentApprovalRepositoryPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(
    input: DecideControlAssessmentAttestationInput,
  ): Promise<ControlAssessmentApprovalRecord> {
    const actor = await this.controlAccess.resolveActor(input.actorUserId);
    const { control } = await this.controlAccess.resolveControl(input.actorUserId, input.controlId);

    const assessment = await this.assessmentRepository.findById(
      input.controlId,
      input.assessmentId,
    );
    if (!assessment) {
      throw new NotFoundDomainError(
        USER_MESSAGES.controls.assessmentEntityLabel,
        input.assessmentId,
      );
    }

    const pending = await this.approvalRepository.findPendingByEntityId(input.assessmentId);
    if (!pending) {
      const existing = await this.approvalRepository.listByEntityId(input.assessmentId);
      if (existing.length > 0) {
        throw new ConflictDomainError(USER_MESSAGES.controls.assessment.attestation.alreadyDecided);
      }
      throw new NotFoundDomainError(
        USER_MESSAGES.controls.attestationEntityLabel,
        input.assessmentId,
      );
    }

    const justification = input.justification ?? null;

    // C1/C2 — checked BEFORE either write, for BOTH outcomes (FR-017,
    // FR-018: deciding at all — approving OR rejecting — is restricted,
    // not merely approving).
    const violations = checkAttestationSegregation({
      assessorUserId: assessment.assessor.id,
      controlOwnerUserId: control.ownerUserId,
      attesterUserId: input.actorUserId,
    });
    if (violations.length > 0) {
      // The audit write MUST commit even though the request itself is
      // refused — a `ValidationDomainError` thrown from INSIDE the same
      // `transactionRunner.run(...)` callback that performed the audit
      // insert would roll the insert back along with everything else
      // (Prisma's interactive transactions abort atomically on an
      // uncaught throw), silently losing the very audit trail FR-019
      // requires. Mirrors `AuditOrgScopeDenialRecorder`'s own documented
      // "dedicated, short-lived transaction for the audit write alone,
      // then the refusal is raised outside it" pattern.
      await this.transactionRunner.run(async () => {
        await this.auditRecorder.record({
          action: 'control.attestation.refused',
          entityType: AuditEntityType.CONTROL_ASSESSMENT,
          entityId: input.assessmentId,
          actorLabel: actor.fullName,
          newValues: { violatedRules: violations },
          organizationalUnitId: control.orgUnitId,
        });
      });
      const message = attestationSegregationMessage(violations);
      throw new ValidationDomainError(message, [{ field: 'decision', message }]);
    }

    if (input.decision === 'REJECTED') {
      return this.transactionRunner.run(async () => {
        const decided = await this.approvalRepository.decide({
          id: pending.id,
          decidedByUserId: input.actorUserId,
          status: 'REJECTED',
          justification,
        });

        await this.auditRecorder.record({
          action: 'control.attestation.rejected',
          entityType: AuditEntityType.CONTROL_ASSESSMENT,
          entityId: input.assessmentId,
          actorLabel: actor.fullName,
          newValues: { approvalId: decided.id, justification },
          organizationalUnitId: control.orgUnitId,
        });

        return decided;
      });
    }

    // APPROVED — compute effectiveness before, attest, compute after, and
    // audit both the attestation and (only if it changed) the derived
    // effectiveness.
    return this.transactionRunner.run(async () => {
      const before = await this.assessmentRepository.listAllForEffectiveness(input.controlId);
      const referenceDate = new Date();
      const previousEffectiveness = calculateControlEffectiveness(
        before,
        control.frequency ?? null,
        referenceDate,
      );

      const decided = await this.approvalRepository.decide({
        id: pending.id,
        decidedByUserId: input.actorUserId,
        status: 'APPROVED',
        justification,
      });
      await this.assessmentRepository.attest(input.assessmentId, referenceDate, input.actorUserId);

      await this.auditRecorder.record({
        action: 'control.assessment.attested',
        entityType: AuditEntityType.CONTROL_ASSESSMENT,
        entityId: input.assessmentId,
        actorLabel: actor.fullName,
        newValues: {
          approvalId: decided.id,
          attestedAt: referenceDate,
          attestedByUserId: input.actorUserId,
          justification,
        },
        organizationalUnitId: control.orgUnitId,
      });

      const after = await this.assessmentRepository.listAllForEffectiveness(input.controlId);
      const newEffectiveness = calculateControlEffectiveness(
        after,
        control.frequency ?? null,
        referenceDate,
      );

      if (newEffectiveness !== previousEffectiveness) {
        await this.auditRecorder.record({
          action: 'control.effectiveness.changed',
          entityType: AuditEntityType.CONTROL_ASSESSMENT,
          entityId: input.assessmentId,
          actorLabel: actor.fullName,
          newValues: { previousEffectiveness, newEffectiveness },
          organizationalUnitId: control.orgUnitId,
        });
      }

      return decided;
    });
  }
}
