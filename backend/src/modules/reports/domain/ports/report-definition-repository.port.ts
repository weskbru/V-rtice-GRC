import type { ReportDefinitionRecord } from '../report-definition.entity';
import type { IndicatorMetricKey } from '@prisma/client';

export interface CreateReportDefinitionInput {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly metricKeys: readonly IndicatorMetricKey[];
  readonly createdByUserId: string;
}

export interface ReportDefinitionListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly isActive: boolean | undefined;
}

export interface ReportDefinitionListPage {
  readonly items: readonly ReportDefinitionRecord[];
  readonly total: number;
}

export interface UpdateReportDefinitionChanges {
  readonly name?: string;
  readonly description?: string;
  readonly metricKeys?: readonly IndicatorMetricKey[];
  readonly isActive?: boolean;
}

export abstract class ReportDefinitionRepositoryPort {
  abstract findById(id: string): Promise<ReportDefinitionRecord | undefined>;

  abstract list(query: ReportDefinitionListQuery): Promise<ReportDefinitionListPage>;

  abstract create(input: CreateReportDefinitionInput): Promise<ReportDefinitionRecord>;

  abstract update(
    id: string,
    changes: UpdateReportDefinitionChanges,
  ): Promise<ReportDefinitionRecord | undefined>;
}
