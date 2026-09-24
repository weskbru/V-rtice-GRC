import { describe, expect, it } from 'vitest';

import { availableTransitions } from '../../status';

import { buildActionLifecycleTrack } from './action-lifecycle-track';

import type { ActionStatus } from '../../types';

function facts(
  status: ActionStatus,
  overrides: { completedAt?: string | null } = {},
): Pick<{ status: ActionStatus; completedAt: string | null }, 'status' | 'completedAt'> {
  return { status, completedAt: overrides.completedAt ?? null };
}

function nodeState(
  model: ReturnType<typeof buildActionLifecycleTrack>,
  status: ActionStatus,
): string | undefined {
  return model.main.find((node) => node.status === status)?.state;
}

describe('buildActionLifecycleTrack', () => {
  it('marks OPEN as current, IN_PROGRESS available and COMPLETED unavailable, for a fresh OPEN action', () => {
    const action = facts('OPEN');
    const model = buildActionLifecycleTrack(action, availableTransitions('OPEN'));

    expect(nodeState(model, 'OPEN')).toBe('current');
    expect(nodeState(model, 'IN_PROGRESS')).toBe('available');
    expect(nodeState(model, 'COMPLETED')).toBe('unavailable');
    expect(model.cancelled).toBeNull();
  });

  it('NEVER marks IN_PROGRESS as completed, even once the action has moved well past it', () => {
    const completed = facts('COMPLETED', { completedAt: '2026-01-02T10:00:00.000Z' });
    expect(
      nodeState(
        buildActionLifecycleTrack(completed, availableTransitions('COMPLETED')),
        'IN_PROGRESS',
      ),
    ).not.toBe('completed');
  });

  it('marks OPEN "completed" once the action has moved past it, since every action is born OPEN', () => {
    const model = buildActionLifecycleTrack(
      facts('IN_PROGRESS'),
      availableTransitions('IN_PROGRESS'),
    );
    expect(nodeState(model, 'OPEN')).toBe('completed');
  });

  it('never marks COMPLETED "completed" without completedAt present — an action that has never completed', () => {
    const neverCompleted = facts('CANCELLED');
    expect(
      nodeState(
        buildActionLifecycleTrack(neverCompleted, availableTransitions('CANCELLED')),
        'COMPLETED',
      ),
    ).not.toBe('completed');
  });

  it('marks COMPLETED "current" (never merely "completed") when it is the action’s actual status', () => {
    const completed = facts('COMPLETED', { completedAt: '2026-01-02T10:00:00.000Z' });
    const model = buildActionLifecycleTrack(completed, availableTransitions('COMPLETED'));
    expect(nodeState(model, 'COMPLETED')).toBe('current');
  });

  it('renders the CANCELLED node ONLY when the action’s current status is CANCELLED', () => {
    const cancelled = facts('CANCELLED');
    const cancelledModel = buildActionLifecycleTrack(cancelled, availableTransitions('CANCELLED'));
    expect(cancelledModel.cancelled).toEqual({ status: 'CANCELLED', state: 'current' });

    expect(
      buildActionLifecycleTrack(facts('OPEN'), availableTransitions('OPEN')).cancelled,
    ).toBeNull();
    expect(
      buildActionLifecycleTrack(facts('IN_PROGRESS'), availableTransitions('IN_PROGRESS'))
        .cancelled,
    ).toBeNull();
  });

  it('marks OPEN "completed" (never "current") once the action has been cancelled, since OPEN still provably happened first', () => {
    const cancelled = facts('CANCELLED');
    const model = buildActionLifecycleTrack(cancelled, availableTransitions('CANCELLED'));
    expect(nodeState(model, 'OPEN')).toBe('completed');
    expect(nodeState(model, 'IN_PROGRESS')).toBe('unavailable');
    expect(nodeState(model, 'COMPLETED')).toBe('unavailable');
  });

  it('on a reopened action, reads exactly like a fresh OPEN action — completedAt is cleared by the server, so COMPLETED is "unavailable", never "completed"', () => {
    const reopened = facts('OPEN', { completedAt: null });
    const model = buildActionLifecycleTrack(reopened, availableTransitions('OPEN'));

    expect(nodeState(model, 'OPEN')).toBe('current');
    expect(nodeState(model, 'IN_PROGRESS')).toBe('available');
    expect(nodeState(model, 'COMPLETED')).toBe('unavailable');
    expect(model.cancelled).toBeNull();
  });

  it('(defensive, not a real scenario) if completedAt and OPEN were ever both present, does not drop the fact — COMPLETED still reads "completed"', () => {
    const hypothetical = facts('OPEN', { completedAt: '2026-01-02T10:00:00.000Z' });
    const model = buildActionLifecycleTrack(hypothetical, availableTransitions('OPEN'));

    expect(nodeState(model, 'OPEN')).toBe('current');
    expect(nodeState(model, 'COMPLETED')).toBe('completed');
  });
});
