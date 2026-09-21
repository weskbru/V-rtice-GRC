import { describe, expect, it } from 'vitest';

import { availableTransitions } from '../../status';

import { buildActionLifecycleTrack } from './action-lifecycle-track';

import type { ActionStatus } from '../../types';

/**
 * Pure-logic evidence for the "Ciclo de vida" track model
 * (020-action-detail-experience, Fase B) — the honesty constraints this
 * module exists to enforce (see its own header comment): `IN_PROGRESS` is
 * NEVER marked completed, `CANCELLED` only ever appears as a node when the
 * action's CURRENT status actually is `CANCELLED`, and `OPEN`/`COMPLETED`
 * are only "completed" when a real fact on the payload proves it. Mirrors
 * `problem-lifecycle-track.test.ts`'s own coverage shape.
 *
 * The reopened-action case at the bottom was corrected 2026-09-18: the
 * original version here asserted `completedAt` survives a reopen, which
 * `action-lifecycle-track.ts`'s own header comment now documents as wrong
 * (caught by `action-plan.spec.ts`'s Fase D E2E test against the real API,
 * not by this suite — this suite mocks nothing about the SERVER, only
 * exercises the pure function). The real behaviour, confirmed by reading
 * `TransitionActionUseCase`: reopening clears `completedAt` back to `null`
 * on the live row, so a reopened action's `COMPLETED` node reads
 * `unavailable`, identically to a fresh action that never completed.
 */

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
    // OPEN -> IN_PROGRESS is a legal, offered transition.
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

    // OPEN and IN_PROGRESS both offer CANCELLED as a legal target transition
    // — that must never surface as a rendered node on an action that has
    // not actually been cancelled.
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

  /**
   * The case the coordinator asked to see covered explicitly: a REOPENED
   * action. The real payload immediately after `COMPLETED -> OPEN`
   * (verified against `TransitionActionUseCase`, not assumed): `status:
   * 'OPEN'`, `completedAt: null` — the server clears it unconditionally on
   * every transition away from `COMPLETED`. The track therefore reads
   * EXACTLY like a fresh action that never completed: nothing here special
   * -cases "this was reopened before", because the live record itself no
   * longer proves it — that fact now lives only in the audit trail's own
   * `previousValues` on the reopen event, a different, historical section.
   * `reopenedAt` is not itself a `TrackFacts` input (the model reads only
   * `status`/`completedAt`) — its own visibility is `ActionLifecycleSection`
   *'s concern (the "Reaberta em" outcome fact), not this pure function's.
   */
  it('on a reopened action, reads exactly like a fresh OPEN action — completedAt is cleared by the server, so COMPLETED is "unavailable", never "completed"', () => {
    const reopened = facts('OPEN', { completedAt: null });
    const model = buildActionLifecycleTrack(reopened, availableTransitions('OPEN'));

    expect(nodeState(model, 'OPEN')).toBe('current');
    expect(nodeState(model, 'IN_PROGRESS')).toBe('available');
    expect(nodeState(model, 'COMPLETED')).toBe('unavailable');
    expect(model.cancelled).toBeNull();
  });

  /**
   * Defensive-only: this exact combination is UNREACHABLE via the real API
   * (see this file's own header comment — `completedAt`/`reopenedAt` are
   * mutually exclusive on every live `Action` row, by construction of
   * `TransitionActionUseCase`). Kept as a single, clearly-labelled guard
   * against the pure function itself ever crashing or silently
   * under-reporting if it were ever handed a payload shaped like this —
   * NOT a claim that this is what a reopened action actually looks like.
   */
  it('(defensive, not a real scenario) if completedAt and OPEN were ever both present, does not drop the fact — COMPLETED still reads "completed"', () => {
    const hypothetical = facts('OPEN', { completedAt: '2026-01-02T10:00:00.000Z' });
    const model = buildActionLifecycleTrack(hypothetical, availableTransitions('OPEN'));

    expect(nodeState(model, 'OPEN')).toBe('current');
    expect(nodeState(model, 'COMPLETED')).toBe('completed');
  });
});
