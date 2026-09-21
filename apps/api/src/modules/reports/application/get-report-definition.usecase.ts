/**
 * 009-indicators-reports, Fase 8 (T068 prep) — `GetReportDefinitionUseCase`
 * (`getReportDefinition`, `GET /reports/{reportId}`). No `ScopeFilter`
 * anywhere (research.md D-8, `ReportDefinitionRepositoryPort`'s own
 * header) — mirrors `modules/indicators/application/
 * get-indicator-definition.usecase.ts`'s identical shape.
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ReportDefinitionRepositoryPort } from '../domain/ports/report-definition-repository.port';
import { ReportReferenceDataPort } from '../domain/ports/report-reference-data.port';

import { resolveReportCreatedByRef } from './resolve-report-created-by';

import type { ReportCreatedByRef } from './resolve-report-created-by';
import type { ReportDefinitionRecord } from '../domain/report-definition.entity';

export interface GetReportDefinitionResult {
  readonly record: ReportDefinitionRecord;
  readonly createdBy: ReportCreatedByRef;
}

@Injectable()
export class GetReportDefinitionUseCase {
  constructor(
    private readonly definitionRepository: ReportDefinitionRepositoryPort,
    private readonly referenceData: ReportReferenceDataPort,
  ) {}

  async execute(reportId: string): Promise<GetReportDefinitionResult> {
    const record = await this.definitionRepository.findById(reportId);
    if (!record) {
      throw new NotFoundDomainError(USER_MESSAGES.reports.entityLabel, reportId);
    }

    const createdBy = await resolveReportCreatedByRef(this.referenceData, record.createdByUserId);
    return { record, createdBy };
  }
}
