import { IndicatorMetricKey } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  getIndicatorMetricCatalogEntry,
  INDICATOR_METRIC_CATALOG,
  type IndicatorMetricScopeApplicability,
  type IndicatorMetricShape,
} from '../../src/modules/indicators/domain/indicator-metric-catalog';

describe('INDICATOR_METRIC_CATALOG (T012, data-model.md §3)', () => {
  it('has exactly one entry per IndicatorMetricKey enum value — no more, no fewer', () => {
    const expectedKeys: readonly string[] = Object.values(IndicatorMetricKey).sort();
    const actualKeys: readonly string[] = Object.keys(INDICATOR_METRIC_CATALOG).sort();

    const missing = expectedKeys.filter((key) => !actualKeys.includes(key));
    const unexpected = actualKeys.filter((key) => !expectedKeys.includes(key));

    expect(missing, `missing: ${missing.join(', ')}`).toHaveLength(0);
    expect(unexpected, `unexpected: ${unexpected.join(', ')}`).toHaveLength(0);
    expect(actualKeys).toEqual(expectedKeys);
  });

  it('covers all eleven values documented in data-model.md §3 today', () => {
    expect(Object.values(IndicatorMetricKey)).toHaveLength(11);
    expect(Object.keys(INDICATOR_METRIC_CATALOG)).toHaveLength(11);
  });

  it('has exactly one ORGANIZATION_WIDE key — COMPLIANCE_PERCENTAGE (research.md D-8)', () => {
    const orgWideKeys = Object.entries(INDICATOR_METRIC_CATALOG)
      .filter(([, entry]) => entry.scopeApplicability === 'ORGANIZATION_WIDE')
      .map(([key]) => key);

    expect(orgWideKeys).toEqual(['COMPLIANCE_PERCENTAGE']);
  });

  it('assigns every non-Compliance key ORGANIZATIONAL_UNIT scope applicability', () => {
    for (const [key, entry] of Object.entries(INDICATOR_METRIC_CATALOG)) {
      if (key === 'COMPLIANCE_PERCENTAGE') {
        continue;
      }
      expect(entry.scopeApplicability satisfies IndicatorMetricScopeApplicability).toBe(
        'ORGANIZATIONAL_UNIT',
      );
    }
  });

  it('assigns the four documented BY_BUCKET keys, and SINGLE_VALUE to every other key', () => {
    const byBucketKeys = Object.entries(INDICATOR_METRIC_CATALOG)
      .filter(([, entry]) => entry.shape === 'BY_BUCKET')
      .map(([key]) => key)
      .sort();

    expect(byBucketKeys).toEqual(
      [
        'FINDING_OPEN_COUNT_BY_SEVERITY',
        'INCIDENT_OPEN_COUNT_BY_SEVERITY',
        'PROBLEM_OPEN_COUNT_BY_SEVERITY',
        'RISK_TOTAL_BY_LEVEL',
      ].sort(),
    );

    const singleValueKeys = Object.entries(INDICATOR_METRIC_CATALOG)
      .filter(([, entry]) => entry.shape === 'SINGLE_VALUE')
      .map(([key]) => key);
    expect(singleValueKeys).toHaveLength(7);

    for (const entry of Object.values(INDICATOR_METRIC_CATALOG)) {
      const shape: IndicatorMetricShape = entry.shape;
      expect(['SINGLE_VALUE', 'BY_BUCKET']).toContain(shape);
    }
  });

  it('getIndicatorMetricCatalogEntry returns the same object the map holds, for every key', () => {
    for (const key of Object.values(IndicatorMetricKey)) {
      expect(getIndicatorMetricCatalogEntry(key)).toBe(INDICATOR_METRIC_CATALOG[key]);
    }
  });

  it('every entry declares a non-empty sourcePermission identifier', () => {
    for (const [key, entry] of Object.entries(INDICATOR_METRIC_CATALOG)) {
      expect(entry.sourcePermission, `sourcePermission missing for ${key}`).toMatch(
        /^[a-z-]+:view$/,
      );
    }
  });
});
