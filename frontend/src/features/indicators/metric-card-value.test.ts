import { describe, expect, it } from 'vitest';

import {
  buildAvailableMetricCardValue,
  buildUnavailableMetricCardValue,
  metricScopeLabel,
} from './metric-card-value';

import type { IndicatorCurrentValue } from './types';

function currentValue(overrides: Partial<IndicatorCurrentValue>): IndicatorCurrentValue {
  return {
    metricKey: 'CONTROL_INACTIVE_COUNT',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    value: 3,
    valueByBucket: null,
    definition: null,
    computedAt: '2026-09-12T14:32:00.000Z',
    ...overrides,
  };
}

describe('buildAvailableMetricCardValue', () => {
  it('maps a SINGLE_VALUE metric to shape "single" as a plain integer', () => {
    const result = buildAvailableMetricCardValue(currentValue({ value: 7 }));

    expect(result).toEqual({ status: 'available', shape: 'single', value: '7' });
  });

  it('formats COMPLIANCE_PERCENTAGE with a "%" unit', () => {
    const result = buildAvailableMetricCardValue(
      currentValue({ metricKey: 'COMPLIANCE_PERCENTAGE', value: 87.456 }),
    );

    expect(result).toEqual({ status: 'available', shape: 'single', value: '87,5', unit: '%' });
  });

  it('maps a BY_BUCKET metric to shape "byBucket" in fixed LOW→CRITICAL order', () => {
    const result = buildAvailableMetricCardValue(
      currentValue({
        metricKey: 'RISK_TOTAL_BY_LEVEL',
        shape: 'BY_BUCKET',
        value: null,
        valueByBucket: { CRITICAL: 1, LOW: 5, HIGH: 0, MEDIUM: 2 },
      }),
    );

    expect(result.status).toBe('available');
    if (result.status !== 'available' || result.shape !== 'byBucket') {
      throw new Error('expected an available byBucket value');
    }
    expect(result.buckets).toEqual([
      { level: 'LOW', count: 5 },
      { level: 'MEDIUM', count: 2 },
      { level: 'HIGH', count: 0 },
      { level: 'CRITICAL', count: 1 },
    ]);
  });

  it('never renders a SINGLE_VALUE null (no data yet) as zero — "unavailable" instead', () => {
    const result = buildAvailableMetricCardValue(currentValue({ value: null }));

    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') throw new Error('expected unavailable');
    expect(result.unavailableLabel).toBeTruthy();
  });
});

describe('metricScopeLabel', () => {
  it('labels an ORGANIZATION_WIDE metric "Organização inteira" even for a UNIT-scoped caller', () => {
    expect(metricScopeLabel('ORGANIZATION_WIDE', false)).toBe('Escopo: Organização inteira');
  });

  it('labels an ORGANIZATION_WIDE metric "Organização inteira" for a GLOBAL-scoped caller too', () => {
    expect(metricScopeLabel('ORGANIZATION_WIDE', true)).toBe('Escopo: Organização inteira');
  });

  it("falls back to the caller's own scope for an ORGANIZATIONAL_UNIT metric", () => {
    expect(metricScopeLabel('ORGANIZATIONAL_UNIT', false)).toBe(
      'Escopo: Unidades organizacionais do seu escopo',
    );
    expect(metricScopeLabel('ORGANIZATIONAL_UNIT', true)).toBe('Escopo: Organização inteira');
  });
});

describe('buildUnavailableMetricCardValue', () => {
  it('gives distinct copy for a missing source permission vs. a load failure', () => {
    const sourcePermission = buildUnavailableMetricCardValue('sourcePermission');
    const loadFailed = buildUnavailableMetricCardValue('loadFailed');

    expect(sourcePermission.status).toBe('unavailable');
    expect(loadFailed.status).toBe('unavailable');
    if (sourcePermission.status !== 'unavailable' || loadFailed.status !== 'unavailable') {
      throw new Error('expected both unavailable');
    }
    expect(sourcePermission.unavailableLabel).not.toBe(loadFailed.unavailableLabel);
  });
});
