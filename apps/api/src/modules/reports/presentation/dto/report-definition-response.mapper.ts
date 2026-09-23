import type { ReportCreatedByRef } from '../../application/resolve-report-created-by';
import type { ReportDefinitionRecord } from '../../domain/report-definition.entity';
import type { IndicatorMetricKey } from '@prisma/client';

export interface ReportCreatedByResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface ReportDefinitionResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly metricKeys: readonly IndicatorMetricKey[];
  readonly isActive: boolean;
  readonly createdBy: ReportCreatedByResponse;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toReportDefinitionResponse(
  record: ReportDefinitionRecord,
  createdBy: ReportCreatedByRef,
): ReportDefinitionResponse {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    metricKeys: [...record.metricKeys],
    isActive: record.isActive,
    createdBy: { id: createdBy.id, fullName: createdBy.fullName },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
