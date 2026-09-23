import { describe, expect, it } from 'vitest';

import { availableProblemTransitions } from '../../status';

import { buildProblemLifecycleTrack } from './problem-lifecycle-track';

import type { ProblemDetail, ProblemStatus } from '../../types';

function facts(
  status: ProblemStatus,
  overrides: { resolvedAt?: string | null; closedAt?: string | null } = {},
): Pick<ProblemDetail, 'status' | 'resolvedAt' | 'closedAt'> {
  return { status, resolvedAt: overrides.resolvedAt ?? null, closedAt: overrides.closedAt ?? null };
}

function nodeState(
  model: ReturnType<typeof buildProblemLifecycleTrack>,
  status: ProblemStatus,
): string | undefined {
  return model.main.find((node) => node.status === status)?.state;
}

describe('buildProblemLifecycleTrack', () => {
  it('marks OPEN as current, IN_ANALYSIS/RESOLVED/CLOSED as available/unavailable per the transition table, for a fresh OPEN problem', () => {
    const problem = facts('OPEN');
    const model = buildProblemLifecycleTrack(problem, availableProblemTransitions('OPEN'));

    expect(nodeState(model, 'OPEN')).toBe('current');
    expect(nodeState(model, 'IN_ANALYSIS')).toBe('available');
    expect(nodeState(model, 'RESOLVED')).toBe('unavailable');
    expect(nodeState(model, 'CLOSED')).toBe('unavailable');
    expect(model.cancelled).toBeNull();
  });

  it('NEVER marks IN_ANALYSIS as completed, even once the problem has moved well past it', () => {
    const resolved = facts('RESOLVED', { resolvedAt: '2026-01-02T10:00:00.000Z' });
    const closed = facts('CLOSED', {
      resolvedAt: '2026-01-02T10:00:00.000Z',
      closedAt: '2026-01-03T10:00:00.000Z',
    });

    expect(
      nodeState(
        buildProblemLifecycleTrack(resolved, availableProblemTransitions('RESOLVED')),
        'IN_ANALYSIS',
      ),
    ).not.toBe('completed');
    expect(
      nodeState(
        buildProblemLifecycleTrack(closed, availableProblemTransitions('CLOSED')),
        'IN_ANALYSIS',
      ),
    ).not.toBe('completed');
  });

  it('marks IN_ANALYSIS "available" (not "completed") when a RESOLVED problem offers reopen', () => {
    const resolved = facts('RESOLVED', { resolvedAt: '2026-01-02T10:00:00.000Z' });
    const model = buildProblemLifecycleTrack(resolved, availableProblemTransitions('RESOLVED'));
    expect(nodeState(model, 'IN_ANALYSIS')).toBe('available');
  });

  it('marks OPEN "completed" once the problem has moved past it, since every problem is born OPEN', () => {
    const model = buildProblemLifecycleTrack(
      facts('IN_ANALYSIS'),
      availableProblemTransitions('IN_ANALYSIS'),
    );
    expect(nodeState(model, 'OPEN')).toBe('completed');
  });

  it('marks RESOLVED "completed" only when resolvedAt is actually present, never inferred from being CLOSED', () => {
    const closedWithResolvedAt = facts('CLOSED', {
      resolvedAt: '2026-01-02T10:00:00.000Z',
      closedAt: '2026-01-03T10:00:00.000Z',
    });
    expect(
      nodeState(
        buildProblemLifecycleTrack(closedWithResolvedAt, availableProblemTransitions('CLOSED')),
        'RESOLVED',
      ),
    ).toBe('completed');

    const closedWithoutResolvedAt = facts('CLOSED', { closedAt: '2026-01-03T10:00:00.000Z' });
    expect(
      nodeState(
        buildProblemLifecycleTrack(closedWithoutResolvedAt, availableProblemTransitions('CLOSED')),
        'RESOLVED',
      ),
    ).not.toBe('completed');
  });

  it('renders the CANCELLED node ONLY when the problem’s current status is CANCELLED', () => {
    const cancelled = facts('CANCELLED');
    const cancelledModel = buildProblemLifecycleTrack(
      cancelled,
      availableProblemTransitions('CANCELLED'),
    );
    expect(cancelledModel.cancelled).toEqual({ status: 'CANCELLED', state: 'current' });

    const open = facts('OPEN');
    expect(
      buildProblemLifecycleTrack(open, availableProblemTransitions('OPEN')).cancelled,
    ).toBeNull();
    const inAnalysis = facts('IN_ANALYSIS');
    expect(
      buildProblemLifecycleTrack(inAnalysis, availableProblemTransitions('IN_ANALYSIS')).cancelled,
    ).toBeNull();
  });

  it('marks OPEN "completed" (never "current") once the problem has been cancelled, since OPEN still provably happened first', () => {
    const cancelled = facts('CANCELLED');
    const model = buildProblemLifecycleTrack(cancelled, availableProblemTransitions('CANCELLED'));
    expect(nodeState(model, 'OPEN')).toBe('completed');
    expect(nodeState(model, 'RESOLVED')).toBe('unavailable');
    expect(nodeState(model, 'CLOSED')).toBe('unavailable');
  });

  it('marks CLOSED "current" (never merely "completed") when it is the problem’s actual status', () => {
    const closed = facts('CLOSED', {
      resolvedAt: '2026-01-02T10:00:00.000Z',
      closedAt: '2026-01-03T10:00:00.000Z',
    });
    const model = buildProblemLifecycleTrack(closed, availableProblemTransitions('CLOSED'));
    expect(nodeState(model, 'CLOSED')).toBe('current');
  });
});
