import { describe, expect, it } from 'vitest';

import { availableIncidentTransitions } from './status';

import type { IncidentStatus } from './types';

describe('availableIncidentTransitions', () => {
  it('OPEN offers start (no required field) and cancel (requires cancellationReason)', () => {
    const options = availableIncidentTransitions('OPEN');
    const targets = options.map((option) => option.to);
    expect(targets).toEqual(['IN_PROGRESS', 'CANCELLED']);

    const start = options.find((option) => option.to === 'IN_PROGRESS');
    expect(start?.requiredField).toBeUndefined();
    expect(start?.confirmKey).toBeUndefined();

    const cancel = options.find((option) => option.to === 'CANCELLED');
    expect(cancel?.requiredField).toBe('cancellationReason');
    expect(cancel?.confirmKey).toBe('cancel');
  });

  it('IN_PROGRESS offers resolve (requires resolutionSummary) and cancel (requires cancellationReason)', () => {
    const options = availableIncidentTransitions('IN_PROGRESS');
    const targets = options.map((option) => option.to);
    expect(targets).toEqual(['RESOLVED', 'CANCELLED']);

    const resolve = options.find((option) => option.to === 'RESOLVED');
    expect(resolve?.requiredField).toBe('resolutionSummary');
    expect(resolve?.confirmKey).toBe('resolve');
  });

  it('RESOLVED offers close (confirmed, no required field) and reopen (requires reopenReason)', () => {
    const options = availableIncidentTransitions('RESOLVED');
    const targets = options.map((option) => option.to);
    expect(targets).toEqual(['CLOSED', 'IN_PROGRESS']);

    const close = options.find((option) => option.to === 'CLOSED');
    expect(close?.requiredField).toBeUndefined();
    expect(close?.confirmKey).toBe('close');

    const reopen = options.find((option) => option.to === 'IN_PROGRESS');
    expect(reopen?.requiredField).toBe('reopenReason');
    expect(reopen?.confirmKey).toBe('reopen');
  });

  it.each<IncidentStatus>(['CLOSED', 'CANCELLED'])(
    '%s is terminal — no transitions offered at all',
    (status) => {
      expect(availableIncidentTransitions(status)).toEqual([]);
    },
  );

  it('is a total function over every IncidentStatus (never throws, never returns undefined)', () => {
    const statuses: readonly IncidentStatus[] = [
      'OPEN',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
      'CANCELLED',
    ];
    for (const status of statuses) {
      expect(() => availableIncidentTransitions(status)).not.toThrow();
      expect(availableIncidentTransitions(status)).toBeDefined();
    }
  });
});
