import type { IndicatorMetricScopeApplicability } from '../../../../shared/grc-ports/indicator-calculation.port';
import type { ReportRunItemResult, RunReportResult } from '../../application/run-report.usecase';
import type { IndicatorMetricKey } from '@prisma/client';

export interface ReportRunItemResponse {
  readonly metricKey: IndicatorMetricKey;
  readonly label: string;
  readonly available: boolean;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly value?: number;
  readonly valueByBucket?: Readonly<Record<string, number>>;
}

export interface ReportRunResultResponse {
  readonly reportId: string;
  readonly computedAt: string;
  readonly items: readonly ReportRunItemResponse[];
}

function toReportRunItemResponse(item: ReportRunItemResult): ReportRunItemResponse {
  return {
    metricKey: item.metricKey,
    label: item.label,
    available: item.available,
    scopeApplicability: item.scopeApplicability,
    ...(item.value !== undefined ? { value: item.value } : {}),
    ...(item.valueByBucket !== undefined ? { valueByBucket: { ...item.valueByBucket } } : {}),
  };
}

export function toReportRunResultResponse(result: RunReportResult): ReportRunResultResponse {
  return {
    reportId: result.reportId,
    computedAt: result.computedAt.toISOString(),
    items: result.items.map(toReportRunItemResponse),
  };
}
