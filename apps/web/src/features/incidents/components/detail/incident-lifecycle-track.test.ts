import { describe, expect, it } from 'vitest';

import { availableIncidentTransitions } from '../../status';

import { buildIncidentLifecycleTrack } from './incident-lifecycle-track';

import type { IncidentDetail, IncidentStatus } from '../../types';

function facts(
  status: IncidentStatus,
  overrides: { resolvedAt?: string | null; closedAt?: string | null } = {},
): Pick<IncidentDetail, 'status' | 'resolvedAt' | 'closedAt'> {
  return { status, resolvedAt: overrides.resolvedAt ?? null, closedAt: overrides.closedAt ?? null };
}

function nodeState(
  model: ReturnType<typeof buildIncidentLifecycleTrack>,
  status: IncidentStatus,
): string | undefined {
  return model.main.find((node) => node.status === status)?.state;
}

describe('buildIncidentLifecycleTrack', () => {
  it('marks OPEN as current, IN_PROGRESS/RESOLVED/CLOSED as available/unavailable per the transition table, for a fresh OPEN incident', () => {
    const incident = facts('OPEN');
    const model = buildIncidentLifecycleTrack(incident, availableIncidentTransitions('OPEN'));

    expect(nodeState(model, 'OPEN')).toBe('current');
    expect(nodeState(model, 'IN_PROGRESS')).toBe('available');
    expect(nodeState(model, 'RESOLVED')).toBe('unavailable');
    expect(nodeState(model, 'CLOSED')).toBe('unavailable');
    expect(model.cancelled).toBeNull();
  });

  it('NEVER marks IN_PROGRESS as completed, even once the incident has moved well past it', () => {
    const resolved = facts('RESOLVED', { resolvedAt: '2026-01-02T10:00:00.000Z' });
    const closed = facts('CLOSED', {
      resolvedAt: '2026-01-02T10:00:00.000Z',
      closedAt: '2026-01-03T10:00:00.000Z',
    });

    expect(
      nodeState(
        buildIncidentLifecycleTrack(resolved, availableIncidentTransitions('RESOLVED')),
        'IN_PROGRESS',
      ),
    ).not.toBe('completed');
    expect(
      nodeState(
        buildIncidentLifecycleTrack(closed, availableIncidentTransitions('CLOSED')),
        'IN_PROGRESS',
      ),
    ).not.toBe('completed');
  });

  it('marks IN_PROGRESS "available" (not "completed") when a RESOLVED incident offers reopen', () => {
    const resolved = facts('RESOLVED', { resolvedAt: '2026-01-02T10:00:00.000Z' });
    const model = buildIncidentLifecycleTrack(resolved, availableIncidentTransitions('RESOLVED'));
    expect(nodeState(model, 'IN_PROGRESS')).toBe('available');
  });

  it('marks OPEN "completed" once the incident has moved past it, since every incident is born OPEN', () => {
    const model = buildIncidentLifecycleTrack(
      facts('IN_PROGRESS'),
      availableIncidentTransitions('IN_PROGRESS'),
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
        buildIncidentLifecycleTrack(closedWithResolvedAt, availableIncidentTransitions('CLOSED')),
        'RESOLVED',
      ),
    ).toBe('completed');

    const closedWithoutResolvedAt = facts('CLOSED', { closedAt: '2026-01-03T10:00:00.000Z' });
    expect(
      nodeState(
        buildIncidentLifecycleTrack(
          closedWithoutResolvedAt,
          availableIncidentTransitions('CLOSED'),
        ),
        'RESOLVED',
      ),
    ).not.toBe('completed');
  });

  it('renders the CANCELLED node ONLY when the incident’s current status is CANCELLED', () => {
    const cancelled = facts('CANCELLED');
    const cancelledModel = buildIncidentLifecycleTrack(
      cancelled,
      availableIncidentTransitions('CANCELLED'),
    );
    expect(cancelledModel.cancelled).toEqual({ status: 'CANCELLED', state: 'current' });

    const open = facts('OPEN');
    expect(
      buildIncidentLifecycleTrack(open, availableIncidentTransitions('OPEN')).cancelled,
    ).toBeNull();
    const inProgress = facts('IN_PROGRESS');
    expect(
      buildIncidentLifecycleTrack(inProgress, availableIncidentTransitions('IN_PROGRESS'))
        .cancelled,
    ).toBeNull();
  });

  it('marks OPEN "completed" (never "current") once the incident has been cancelled, since OPEN still provably happened first', () => {
    const cancelled = facts('CANCELLED');
    const model = buildIncidentLifecycleTrack(cancelled, availableIncidentTransitions('CANCELLED'));
    expect(nodeState(model, 'OPEN')).toBe('completed');
    expect(nodeState(model, 'RESOLVED')).toBe('unavailable');
    expect(nodeState(model, 'CLOSED')).toBe('unavailable');
  });

  it('marks CLOSED "current" (never merely "completed") when it is the incident’s actual status', () => {
    const closed = facts('CLOSED', {
      resolvedAt: '2026-01-02T10:00:00.000Z',
      closedAt: '2026-01-03T10:00:00.000Z',
    });
    const model = buildIncidentLifecycleTrack(closed, availableIncidentTransitions('CLOSED'));
    expect(nodeState(model, 'CLOSED')).toBe('current');
  });
});
