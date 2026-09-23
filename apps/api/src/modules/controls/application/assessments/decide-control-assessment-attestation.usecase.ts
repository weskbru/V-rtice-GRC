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

    const violations = checkAttestationSegregation({
      assessorUserId: assessment.assessor.id,
      controlOwnerUserId: control.ownerUserId,
      attesterUserId: input.actorUserId,
    });
    if (violations.length > 0) {
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
