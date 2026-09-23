import { describe, expect, it } from 'vitest';

import { buildControlLifecycleTrack } from './control-lifecycle-track';

import type { AvailableControlTransition, ControlStatus } from '../../types';

function facts(status: ControlStatus): { status: ControlStatus } {
  return { status };
}

function transition(toStatus: ControlStatus, preconditionsMet = true): AvailableControlTransition {
  return { toStatus, requiredPermission: 'control:edit', preconditionsMet };
}

function nodeState(
  model: ReturnType<typeof buildControlLifecycleTrack>,
  status: ControlStatus,
): string | undefined {
  return model.main.find((node) => node.status === status)?.state;
}

describe('buildControlLifecycleTrack', () => {
  it('marks DRAFT as current, ACTIVE available (when offered) and SUSPENDED unavailable, for a fresh DRAFT control', () => {
    const control = facts('DRAFT');
    const model = buildControlLifecycleTrack(control, [transition('ACTIVE')]);

    expect(nodeState(model, 'DRAFT')).toBe('current');
    expect(nodeState(model, 'ACTIVE')).toBe('available');
    expect(nodeState(model, 'SUSPENDED')).toBe('unavailable');
    expect(model.retired).toBeNull();
  });

  it('marks DRAFT "completed" (never "current") once the control has moved past it, since every control is born DRAFT', () => {
    const model = buildControlLifecycleTrack(facts('ACTIVE'), [transition('SUSPENDED')]);
    expect(nodeState(model, 'DRAFT')).toBe('completed');
  });

  it('marks ACTIVE "completed" when the control is currently SUSPENDED — SUSPENDED has exactly one inbound edge (ACTIVE -> SUSPENDED), so this is provable without any stamp', () => {
    const model = buildControlLifecycleTrack(facts('SUSPENDED'), [transition('ACTIVE')]);
    expect(nodeState(model, 'ACTIVE')).toBe('completed');
    expect(nodeState(model, 'SUSPENDED')).toBe('current');
  });

  it('NEVER marks ACTIVE "completed" merely because the control is currently RETIRED — RETIRED is reachable directly from DRAFT, never proving ACTIVE happened', () => {
    const model = buildControlLifecycleTrack(facts('RETIRED'), []);
    expect(nodeState(model, 'ACTIVE')).not.toBe('completed');
    expect(nodeState(model, 'ACTIVE')).toBe('unavailable');
  });

  it('NEVER marks SUSPENDED "completed", even when the control is currently ACTIVE (which could have come straight from DRAFT, never visiting SUSPENDED)', () => {
    const model = buildControlLifecycleTrack(facts('ACTIVE'), [transition('SUSPENDED')]);
    expect(nodeState(model, 'SUSPENDED')).not.toBe('completed');
    expect(nodeState(model, 'SUSPENDED')).toBe('available');
  });

  it('NEVER marks SUSPENDED "completed" when the control is currently RETIRED — no field proves it was ever suspended', () => {
    const model = buildControlLifecycleTrack(facts('RETIRED'), []);
    expect(nodeState(model, 'SUSPENDED')).not.toBe('completed');
    expect(nodeState(model, 'SUSPENDED')).toBe('unavailable');
  });

  it('marks ACTIVE "current" (never merely "completed") when it is the control’s actual status', () => {
    const model = buildControlLifecycleTrack(facts('ACTIVE'), [transition('SUSPENDED')]);
    expect(nodeState(model, 'ACTIVE')).toBe('current');
  });

  it('renders the RETIRED node ONLY when the control’s current status is RETIRED', () => {
    const retiredModel = buildControlLifecycleTrack(facts('RETIRED'), []);
    expect(retiredModel.retired).toEqual({ status: 'RETIRED', state: 'current' });

    expect(buildControlLifecycleTrack(facts('DRAFT'), [transition('RETIRED')]).retired).toBeNull();
    expect(buildControlLifecycleTrack(facts('ACTIVE'), [transition('RETIRED')]).retired).toBeNull();
    expect(
      buildControlLifecycleTrack(facts('SUSPENDED'), [transition('RETIRED')]).retired,
    ).toBeNull();
  });

  it('marks DRAFT "completed" (never "current") once the control has been retired, since DRAFT still provably happened first', () => {
    const model = buildControlLifecycleTrack(facts('RETIRED'), []);
    expect(nodeState(model, 'DRAFT')).toBe('completed');
  });

  it('nothing is offered as "available" from a terminal RETIRED control — the server never returns outbound transitions from RETIRED', () => {
    const model = buildControlLifecycleTrack(facts('RETIRED'), []);
    expect(nodeState(model, 'ACTIVE')).toBe('unavailable');
    expect(nodeState(model, 'SUSPENDED')).toBe('unavailable');
  });

  it('a transition offered with an unmet precondition still marks its target "available" on the track — the track shows legality, not readiness (the buttons/pendency text carry that distinction)', () => {
    const model = buildControlLifecycleTrack(facts('DRAFT'), [transition('ACTIVE', false)]);
    expect(nodeState(model, 'ACTIVE')).toBe('available');
  });
});
