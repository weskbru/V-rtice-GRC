/**
 * 009-indicators-reports, Fase 7 (T054) — `ListReportDefinitionsUseCase`
 * (`listReportDefinitions`). No `ScopeFilter` (research.md D-8, data-
 * model.md §8: "nenhum — catálogo compartilhado") — every caller with
 * `report:view` sees every configured `ReportDefinition`, paginated and
 * optionally filtered by `isActive`. Mirrors
 * `modules/indicators/application/list-indicator-definitions.usecase.ts`
 * exactly.
 */
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

    // A saved report catalog is small by construction (an operator-curated
    // set of named compositions, not a growing transactional table) — a
    // per-row lookup here is never an unbounded N+1, mirroring
    // `ListIndicatorDefinitionsUseCase`'s own identical reasoning (bounded
    // at eleven there; unbounded but operator-curated here).
    const items = await Promise.all(
      page.items.map(async (record) => ({
        record,
        createdBy: await resolveReportCreatedByRef(this.referenceData, record.createdByUserId),
      })),
    );

    return { items, total: page.total };
  }
}
