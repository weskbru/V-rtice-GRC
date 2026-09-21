import { describe, expect, it } from 'vitest';

import { availableProblemTransitions } from '../../status';

import { buildProblemLifecycleTrack } from './problem-lifecycle-track';

import type { ProblemDetail, ProblemStatus } from '../../types';

/**
 * Pure-logic evidence for the "Ciclo de vida" track model
 * (019-problem-detail-experience, Fase B) — the honesty constraints this
 * module exists to enforce (see its own header comment): `IN_ANALYSIS` is
 * NEVER marked completed, `CANCELLED` only ever appears as a node when the
 * problem's CURRENT status actually is `CANCELLED`, and `OPEN`/`RESOLVED`/
 * `CLOSED` are only "completed" when a real timestamp on the payload proves
 * it, never inferred from status order alone. Mirrors
 * `incident-lifecycle-track.test.ts`'s own coverage exactly, `IN_PROGRESS`
 * renamed to `IN_ANALYSIS` — see `problem-lifecycle-track.ts`'s own header
 * comment for why this is a second, independent copy rather than a shared
 * caller of that suite.
 */

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
    // OPEN -> IN_ANALYSIS is a legal, offered transition.
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

    // Defensive case: a CLOSED problem should always carry resolvedAt in
    // practice (CLOSED is only reachable from RESOLVED), but the model must
    // not silently assume it — only the timestamp itself proves the fact.
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

    // OPEN and IN_ANALYSIS both offer CANCELLED as a legal target transition
    // — that must never surface as a rendered node on a problem that has not
    // actually been cancelled.
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
