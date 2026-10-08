import { describe, expect, it } from 'vitest';

import { bucketTotal, bucketValue, hasMetric, indexSummary, singleValue, sumOf } from './summary';

describe('dashboard summary lookups', () => {
  const index = indexSummary({
    metrics: [
      {
        metricKey: 'INCIDENT_OPEN_COUNT_BY_SEVERITY',
        shape: 'BY_BUCKET',
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        valueByBucket: { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 },
      },
      {
        metricKey: 'COMPLIANCE_PERCENTAGE',
        shape: 'SINGLE_VALUE',
        scopeApplicability: 'ORGANIZATION_WIDE',
      },
    ],
  });

  it('treats presence of a key as the permission answer', () => {
    expect(hasMetric(index, 'INCIDENT_OPEN_COUNT_BY_SEVERITY')).toBe(true);
    expect(hasMetric(index, 'CONTROL_INACTIVE_COUNT')).toBe(false);
  });

  it('keeps "no data" as undefined rather than coercing it to zero', () => {
    expect(singleValue(index, 'COMPLIANCE_PERCENTAGE')).toBeUndefined();
    expect(singleValue(index, 'CONTROL_INACTIVE_COUNT')).toBeUndefined();
  });

  it('reads one bucket, and totals the buckets the server sent', () => {
    expect(bucketValue(index, 'INCIDENT_OPEN_COUNT_BY_SEVERITY', 'CRITICAL')).toBe(4);
    expect(bucketTotal(index, 'INCIDENT_OPEN_COUNT_BY_SEVERITY')).toBe(10);
    expect(bucketTotal(index, 'PROBLEM_OPEN_COUNT_BY_SEVERITY')).toBeUndefined();
  });

  it('adds only the named statuses, and keeps an omitted block omitted', () => {
    const byStatus = { OPEN: 2, IN_ANALYSIS: 7, RESOLVED: 5, CLOSED: 9, CANCELLED: 1 };

    expect(sumOf(byStatus, ['OPEN', 'IN_ANALYSIS'])).toBe(9);
    expect(sumOf<'OPEN'>(undefined, ['OPEN'])).toBeUndefined();
  });

  it('builds an empty index from a missing summary', () => {
    expect(hasMetric(indexSummary(null), 'INCIDENT_OPEN_COUNT_BY_SEVERITY')).toBe(false);
  });
});
