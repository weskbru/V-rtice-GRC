/**
 * 009-indicators-reports, Fase 7 (T054) — maps `RunReportResult`
 * (application layer, T052) to the wire shape
 * `contracts/reports.openapi.yaml`'s `ReportRunResult`/`ReportRunItem`
 * schemas describe. ONE function per shape is the only place this happens
 * (ADR-009).
 *
 * `value`/`valueByBucket` are OMITTED entirely when absent — never sent as
 * `null` — because the contract's `ReportRunItem` schema types them as
 * plain `number`/`object` (not nullable) and lists neither in `required`:
 * the wire contract's own way of encoding "no value for this item" is
 * absence, not `null`. This differs from
 * `toIndicatorCurrentValueResponse`'s own `value: number | null` — that
 * schema DOES declare its fields nullable; this one does not (confirmed
 * directly against `contracts/reports.openapi.yaml`'s own `ReportRunItem`
 * definition, not assumed).
 */
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
