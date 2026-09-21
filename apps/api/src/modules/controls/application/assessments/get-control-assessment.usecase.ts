/**
 * T028/003-controls-management, User Story 2 — `GetControlAssessmentUseCase`.
 * `GET /controls/{controlId}/assessments/{assessmentId}`
 * (`getControlAssessment` operation). Requires `control:view` and scope.
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { ControlAssessmentRepositoryPort } from '../../domain/ports/control-assessment-repository.port';
import { ControlAccessResolver } from '../control-access-resolver.service';

import type { ControlAssessmentRecord } from '../../domain/ports/control-assessment-repository.port';

export interface GetControlAssessmentInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly assessmentId: string;
}

@Injectable()
export class GetControlAssessmentUseCase {
  constructor(
    private readonly controlAccess: ControlAccessResolver,
    private readonly assessmentRepository: ControlAssessmentRepositoryPort,
  ) {}

  async execute(input: GetControlAssessmentInput): Promise<ControlAssessmentRecord> {
    await this.controlAccess.resolveControl(input.actorUserId, input.controlId);

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
    return assessment;
  }
}
