import { describe, expect, it } from 'vitest';

import { buildRiskLifecycleSpine, resolveRiskLifecycleSpineNode } from './risk-lifecycle-spine';

import type { AvailableRiskTransition, RiskStatus } from '../../types';

/**
 * Pure-logic evidence for the lifecycle spine derivation
 * (016-risk-detail-experience §4.6, F-CV-3).
 *
 * F-CV-3 replaced a client-side "necessary prefix" GUESS (DRAFT/IDENTIFIED/
 * ASSESSED always traversed once the risk has moved past them, plus one
 * hand-written CLOSED-when-ARCHIVED exception) with the server's own
 * `traversedStatuses` — derived from this risk's real, append-only
 * transition history. These tests exercise the CALLER-supplied set
 * directly; they no longer assert an inference rule, because there is no
 * inference left to assert. The set below (`traversed`) mirrors what
 * `buildRiskLifecycleSpine`/`resolveRiskLifecycleSpineNode` receive as their
 * own parameter — this file constructs it exactly like `lifecycle.
 * traversedStatuses` from `GET /risks/{riskId}/lifecycle` would.
 */

function traversedSet(...statuses: readonly RiskStatus[]): ReadonlySet<RiskStatus> {
  return new Set(statuses);
}

describe('resolveRiskLifecycleSpineNode', () => {
  it('marks the current status as current, never traversed or available — even when it is ALSO in the traversed set', () => {
    expect(
      resolveRiskLifecycleSpineNode('ASSESSED', 'ASSESSED', [], traversedSet('ASSESSED')),
    ).toEqual({
      status: 'ASSESSED',
      state: 'current',
    });
  });

  it('marks a status as traversed when it is a member of the supplied traversedStatuses set', () => {
    const traversed = traversedSet('DRAFT', 'IDENTIFIED', 'ASSESSED');
    for (const status of ['DRAFT', 'IDENTIFIED', 'ASSESSED'] as const) {
      expect(resolveRiskLifecycleSpineNode(status, 'UNDER_TREATMENT', [], traversed)).toEqual({
        status,
        state: 'traversed',
      });
    }
  });

  /**
   * The exact defect report (F-CV-3): a risk that visited UNDER_TREATMENT
   * on its way to ARCHIVED must still show UNDER_TREATMENT as traversed —
   * the OLD prefix rule could never represent this (UNDER_TREATMENT was
   * hard-coded to NEVER be traversed, on the theory that real paths always
   * skip it, which is false for a risk whose real path did not).
   */
  it("marks UNDER_TREATMENT/UNDER_REVIEW/ACCEPTED as traversed when the server's own history says so, even from CLOSED or ARCHIVED", () => {
    const traversed = traversedSet(
      'DRAFT',
      'IDENTIFIED',
      'ASSESSED',
      'UNDER_TREATMENT',
      'UNDER_REVIEW',
      'CLOSED',
      'ARCHIVED',
    );
    for (const status of ['UNDER_TREATMENT', 'UNDER_REVIEW'] as const) {
      expect(resolveRiskLifecycleSpineNode(status, 'ARCHIVED', [], traversed).state).toBe(
        'traversed',
      );
    }
  });

  it('does NOT mark a status as traversed when it is absent from traversedStatuses, even if a prefix guess would have said so', () => {
    // A risk that went straight DRAFT -> IDENTIFIED -> ASSESSED -> ACCEPTED
    // never visited UNDER_TREATMENT — the server's own set omits it, and
    // this must not be inferred back in.
    const traversed = traversedSet('DRAFT', 'IDENTIFIED', 'ASSESSED', 'ACCEPTED');
    const node = resolveRiskLifecycleSpineNode('UNDER_TREATMENT', 'ACCEPTED', [], traversed);
    expect(node.state).not.toBe('traversed');
  });

  it('falls to available/blocked/unavailable for a status neither current nor traversed', () => {
    const traversed = traversedSet('DRAFT');
    expect(resolveRiskLifecycleSpineNode('ASSESSED', 'DRAFT', [], traversed).state).toBe(
      'unavailable',
    );
  });

  it('reads available/blocked straight off availableTransitions, never re-deriving it', () => {
    const transitions: AvailableRiskTransition[] = [
      {
        toStatus: 'UNDER_TREATMENT',
        requiredPermission: 'risk:treat',
        requiresApproval: false,
        preconditionsMet: false,
        unmetPreconditions: ['É necessário haver uma decisão de tratamento.'],
      },
    ];
    const traversed = traversedSet('DRAFT', 'IDENTIFIED', 'ASSESSED');
    expect(
      resolveRiskLifecycleSpineNode('UNDER_TREATMENT', 'ASSESSED', transitions, traversed),
    ).toEqual({
      status: 'UNDER_TREATMENT',
      state: 'blocked',
      unmetPreconditions: ['É necessário haver uma decisão de tratamento.'],
    });
  });

  it('marks a status with no matching transition entry and not in traversedStatuses as unavailable', () => {
    const traversed = traversedSet('DRAFT', 'IDENTIFIED', 'ASSESSED', 'UNDER_TREATMENT');
    expect(resolveRiskLifecycleSpineNode('ARCHIVED', 'UNDER_TREATMENT', [], traversed).state).toBe(
      'unavailable',
    );
  });
});

describe('buildRiskLifecycleSpine', () => {
  it('builds six main positions and two branches, in the spec-defined order', () => {
    const model = buildRiskLifecycleSpine('IDENTIFIED', [], ['DRAFT', 'IDENTIFIED']);
    expect(model.main.map((node) => node.status)).toEqual([
      'DRAFT',
      'IDENTIFIED',
      'ASSESSED',
      'UNDER_TREATMENT',
      'CLOSED',
      'ARCHIVED',
    ]);
    expect(model.branches.map((node) => node.status)).toEqual(['UNDER_REVIEW', 'ACCEPTED']);
  });

  it('marks every server-supplied traversedStatuses entry as traversed, including ones the old prefix rule could never reach', () => {
    const model = buildRiskLifecycleSpine(
      'ARCHIVED',
      [],
      ['DRAFT', 'IDENTIFIED', 'ASSESSED', 'UNDER_TREATMENT', 'UNDER_REVIEW', 'CLOSED', 'ARCHIVED'],
    );
    const stateOf = (status: RiskStatus): string =>
      [...model.main, ...model.branches].find((node) => node.status === status)!.state;

    expect(stateOf('DRAFT')).toBe('traversed');
    expect(stateOf('IDENTIFIED')).toBe('traversed');
    expect(stateOf('ASSESSED')).toBe('traversed');
    expect(stateOf('UNDER_TREATMENT')).toBe('traversed');
    expect(stateOf('UNDER_REVIEW')).toBe('traversed');
    expect(stateOf('CLOSED')).toBe('traversed');
    expect(stateOf('ARCHIVED')).toBe('current');
    // ACCEPTED was never visited on this risk's own path.
    expect(stateOf('ACCEPTED')).not.toBe('traversed');
  });
});
