/**
 * T028/003-controls-management, User Story 2 — `ListControlAssessmentsUseCase`.
 * `GET /controls/{controlId}/assessments` (`listControlAssessments`
 * operation). Requires `control:view` and scope.
 */
import { Injectable } from '@nestjs/common';

import { ControlAssessmentRepositoryPort } from '../../domain/ports/control-assessment-repository.port';
import { ControlAccessResolver } from '../control-access-resolver.service';

import type { ControlAssessmentRecord } from '../../domain/ports/control-assessment-repository.port';

export interface ListControlAssessmentsInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface ListControlAssessmentsResult {
  readonly items: readonly ControlAssessmentRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

@Injectable()
export class ListControlAssessmentsUseCase {
  constructor(
    private readonly controlAccess: ControlAccessResolver,
    private readonly assessmentRepository: ControlAssessmentRepositoryPort,
  ) {}

  async execute(input: ListControlAssessmentsInput): Promise<ListControlAssessmentsResult> {
    await this.controlAccess.resolveControl(input.actorUserId, input.controlId);

    const { items, total } = await this.assessmentRepository.listByControl(
      input.controlId,
      input.page,
      input.pageSize,
    );

    return { items, page: input.page, pageSize: input.pageSize, total };
  }
}
