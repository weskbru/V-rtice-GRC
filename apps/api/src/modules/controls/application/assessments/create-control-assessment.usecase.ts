/**
 * T028/003-controls-management, User Story 2 — `CreateControlAssessmentUseCase`.
 * `POST /controls/{controlId}/assessments`
 * (`contracts/controls.openapi.yaml`'s `createControlAssessment`
 * operation). Requires `control:test` (research.md D-9), enforced by
 * `@RequirePermission` on the controller route.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import {
  assertAssessedOnNotInFuture,
  assertControlAcceptsNewAssessment,
} from '../../domain/control-assessment.entity';
import { ControlAssessmentRepositoryPort } from '../../domain/ports/control-assessment-repository.port';
import { ControlAccessResolver } from '../control-access-resolver.service';

import type { ControlAssessmentRecord } from '../../domain/ports/control-assessment-repository.port';
import type { ControlAssessmentResult } from '@prisma/client';

export interface CreateControlAssessmentInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly assessedOn: Date;
  readonly result: ControlAssessmentResult;
  readonly conclusion: string;
}

@Injectable()
export class CreateControlAssessmentUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly controlAccess: ControlAccessResolver,
    private readonly assessmentRepository: ControlAssessmentRepositoryPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateControlAssessmentInput): Promise<ControlAssessmentRecord> {
    const actor = await this.controlAccess.resolveActor(input.actorUserId);
    const { control } = await this.controlAccess.resolveControl(input.actorUserId, input.controlId);

    assertAssessedOnNotInFuture(input.assessedOn, new Date());
    assertControlAcceptsNewAssessment(control.status);

    return this.transactionRunner.run(async () => {
      const assessment = await this.assessmentRepository.create({
        controlId: input.controlId,
        assessedOn: input.assessedOn,
        assessorUserId: input.actorUserId,
        result: input.result,
        conclusion: input.conclusion,
      });

      await this.auditRecorder.record({
        action: 'control.assessment.recorded',
        entityType: AuditEntityType.CONTROL_ASSESSMENT,
        entityId: assessment.id,
        actorLabel: actor.fullName,
        newValues: {
          controlId: input.controlId,
          assessedOn: input.assessedOn,
          result: input.result,
          conclusion: input.conclusion,
        },
        organizationalUnitId: control.orgUnitId,
      });

      return assessment;
    });
  }
}
