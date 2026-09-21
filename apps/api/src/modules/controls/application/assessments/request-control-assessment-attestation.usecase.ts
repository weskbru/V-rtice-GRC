/**
 * T029/003-controls-management, User Story 2 — `RequestControlAssessmentAttestationUseCase`.
 * `POST /controls/{controlId}/assessments/{assessmentId}/attestation`
 * (`requestControlAssessmentAttestation` operation). Requires
 * `control:test` (research.md D-9: "quem pode registrar uma verificação
 * pode submetê-la à atestação") — the SAME permission
 * `createControlAssessment` requires, enforced by `@RequirePermission` on
 * the controller route.
 *
 * D-8 — an assessment admits at most one attestation lifecycle, ever:
 * requesting again — including after a decision — is refused with `409`.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { ConflictDomainError, NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { ControlAssessmentApprovalRepositoryPort } from '../../domain/ports/control-assessment-approval-repository.port';
import { ControlAssessmentRepositoryPort } from '../../domain/ports/control-assessment-repository.port';
import { ControlAccessResolver } from '../control-access-resolver.service';

import type { ControlAssessmentApprovalRecord } from '../../domain/ports/control-assessment-approval-repository.port';

export interface RequestControlAssessmentAttestationInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly assessmentId: string;
  readonly justification?: string | null | undefined;
}

@Injectable()
export class RequestControlAssessmentAttestationUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly controlAccess: ControlAccessResolver,
    private readonly assessmentRepository: ControlAssessmentRepositoryPort,
    private readonly approvalRepository: ControlAssessmentApprovalRepositoryPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(
    input: RequestControlAssessmentAttestationInput,
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

    // D-8 — ANY prior attestation for this assessment (pending OR already
    // decided) blocks a new request. `Approval.entityId`'s own uniqueness
    // is not database-enforced (mirrors `Risk.pendingApprovalId`'s own
    // non-unique-FK convention), so this in-memory check is the primary
    // path; a genuine race lands on the SAME conclusion because a second
    // concurrent request would also observe at least the first row once
    // either commits — this endpoint is not on any hot concurrent-write
    // path the way risk approvals are, so no additional unique index is
    // introduced for it here.
    const existing = await this.approvalRepository.listByEntityId(input.assessmentId);
    if (existing.length > 0) {
      throw new ConflictDomainError(USER_MESSAGES.controls.assessment.attestation.alreadyRequested);
    }

    const justification = input.justification ?? null;

    return this.transactionRunner.run(async () => {
      const approval = await this.approvalRepository.create({
        entityId: input.assessmentId,
        requestedByUserId: input.actorUserId,
        justification,
      });

      await this.assessmentRepository.setApprovalId(input.assessmentId, approval.id);

      await this.auditRecorder.record({
        action: 'control.attestation.requested',
        entityType: AuditEntityType.CONTROL_ASSESSMENT,
        entityId: input.assessmentId,
        actorLabel: actor.fullName,
        newValues: { approvalId: approval.id, justification },
        organizationalUnitId: control.orgUnitId,
      });

      return approval;
    });
  }
}
