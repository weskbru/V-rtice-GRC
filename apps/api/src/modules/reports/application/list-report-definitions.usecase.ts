import { Injectable } from '@nestjs/common';

import { ReportDefinitionRepositoryPort } from '../domain/ports/report-definition-repository.port';
import { ReportReferenceDataPort } from '../domain/ports/report-reference-data.port';

import { resolveReportCreatedByRef, type ReportCreatedByRef } from './resolve-report-created-by';

import type { ReportDefinitionRecord } from '../domain/report-definition.entity';

export interface ListReportDefinitionsInput {
  readonly page: number;
  readonly pageSize: number;
  readonly isActive: boolean | undefined;
}

export interface ReportDefinitionWithCreatedBy {
  readonly record: ReportDefinitionRecord;
  readonly createdBy: ReportCreatedByRef;
}

export interface ListReportDefinitionsResult {
  readonly items: readonly ReportDefinitionWithCreatedBy[];
  readonly total: number;
}

@Injectable()
export class ListReportDefinitionsUseCase {
  constructor(
    private readonly definitionRepository: ReportDefinitionRepositoryPort,
    private readonly referenceData: ReportReferenceDataPort,
  ) {}

  async execute(input: ListReportDefinitionsInput): Promise<ListReportDefinitionsResult> {
    const page = await this.definitionRepository.list({
      page: input.page,
      pageSize: input.pageSize,
      isActive: input.isActive,
    });

    const items = await Promise.all(
      page.items.map(async (record) => ({
        record,
        createdBy: await resolveReportCreatedByRef(this.referenceData, record.createdByUserId),
      })),
    );

    return { items, total: page.total };
  }
}
