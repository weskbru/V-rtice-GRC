import { describe, expect, it } from 'vitest';

import { buildReportItemMetricCardValue } from './report-metric-card-value';

import type { ReportRunItem } from './types';

/**
 * Pure-function evidence for `buildReportItemMetricCardValue` (009-indicators-reports, T061) —
 * the FR-026/SC-006 rule this task exists to enforce: an item with `available: false` maps to
 * `MetricCard`'s distinct `unavailable` state, never a `single`/`0`, and never throws even when
 * `value`/`valueByBucket` are both absent (the exact shape the server sends for that case).
 */
function baseItem(overrides: Partial<ReportRunItem>): ReportRunItem {
  return {
    metricKey: 'CONTROL_INACTIVE_COUNT',
    label: 'Controles inativos',
    available: true,
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    ...overrides,
  };
}

describe('buildReportItemMetricCardValue', () => {
  it("maps an unavailable item to MetricCard's unavailable state, never a zero", () => {
    const result = buildReportItemMetricCardValue(
      baseItem({ available: false, value: undefined, valueByBucket: undefined }),
    );

    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.unavailableLabel).toBe('Sem permissão para ver este item');
    }
  });

  it('ignores a stray value/valueByBucket on an unavailable item — availability wins', () => {
    const result = buildReportItemMetricCardValue(baseItem({ available: false, value: 0 }));

    expect(result.status).toBe('unavailable');
  });

  it('maps a single-value available item to a formatted single value', () => {
    const result = buildReportItemMetricCardValue(baseItem({ available: true, value: 4 }));

    expect(result).toEqual({ status: 'available', shape: 'single', value: '4' });
  });

  it('formats COMPLIANCE_PERCENTAGE with a % unit and at most one decimal place', () => {
    const result = buildReportItemMetricCardValue(
      baseItem({ metricKey: 'COMPLIANCE_PERCENTAGE', available: true, value: 87.456 }),
    );

    expect(result).toEqual({ status: 'available', shape: 'single', value: '87,5', unit: '%' });
  });

  it('maps a BY_BUCKET available item to one bucket entry per known level, in fixed order', () => {
    const result = buildReportItemMetricCardValue(
      baseItem({
        metricKey: 'RISK_TOTAL_BY_LEVEL',
        available: true,
        valueByBucket: { CRITICAL: 3, LOW: 2, MEDIUM: 0 },
      }),
    );

    expect(result.status).toBe('available');
    if (result.status === 'available' && result.shape === 'byBucket') {
      expect(result.buckets).toEqual([
        { level: 'LOW', count: 2 },
        { level: 'MEDIUM', count: 0 },
        { level: 'CRITICAL', count: 3 },
      ]);
    }
  });

  it('treats a SINGLE_VALUE item with no value as "no data yet", not a zero', () => {
    const result = buildReportItemMetricCardValue(
      baseItem({ available: true, value: undefined, valueByBucket: undefined }),
    );

    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.unavailableLabel).toBe('Sem dados calculados ainda');
    }
  });
});
