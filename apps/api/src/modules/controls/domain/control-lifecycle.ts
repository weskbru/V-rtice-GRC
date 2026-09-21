/**
 * T018/003-controls-management — the declarative control lifecycle
 * transition table (D-6, FR-004/FR-005/FR-006), transcribed from
 * research.md's D-6 and contracts/controls.openapi.yaml's
 * `getControlLifecycle`/`transitionControl`. Pure domain: no I/O, no
 * framework import (`eslint-plugin-boundaries` enforces this at
 * `module-domain`) — modeled directly on
 * `modules/risk/domain/risk-lifecycle.ts` and
 * `modules/risk/domain/transition-preconditions.ts`, folded into one file
 * here because this task names only `control.entity.ts` and
 * `control-lifecycle.ts` (two files, not three) and Controls has far fewer
 * preconditions than Risk does.
 *
 * Unlike `risk-lifecycle.ts`, no transition here is gated by an approval
 * workflow — there is no `requiresApproval` field: only a
 * `ControlAssessment`'s ATTESTATION is gated, via the existing generic
 * `Approval` mechanism (research.md D-3) — never the control's own
 * lifecycle (research.md D-6's own "Descartado explicitamente": no
 * `PENDING_APPROVAL` control status).
 *
 * ## `DRAFT -> RETIRED` — deliberately included (research.md D-6)
 *
 * Without it, `DRAFT` is a trap: entering `ACTIVE` requires an owner
 * (FR-005) and a control is never hard-deleted (FR-006), so a control
 * drafted by mistake — or one that never receives an owner — could
 * neither advance nor be disposed of. This is the exact unreachable-state
 * defect the analysis gate found and corrected before implementation (the
 * same class of defect `FindingStatus` shipped with in Fase 1). T018a's
 * test proves this path stays reachable.
 */
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { ControlStatus } from '@prisma/client';

/** Identifiers for the two precondition evaluators below — a closed union
 * so a transition row can only ever reference a precondition this module
 * actually implements; `tsc` fails otherwise (mirrors
 * `risk-lifecycle.ts`'s own `TransitionPreconditionId`). */
export type ControlTransitionPreconditionId = 'HAS_OWNER' | 'HAS_JUSTIFICATION';

export interface ControlLifecycleTransitionRule {
  readonly from: ControlStatus;
  readonly to: ControlStatus;
  readonly requiredPermission: PermissionIdentifier;
  /** Empty = no precondition beyond the state/permission check itself. */
  readonly preconditions: readonly ControlTransitionPreconditionId[];
}

/**
 * D-6's transition table, one row per legal `(from, to)` pair. `RETIRED`
 * is reachable from all three other states and is itself terminal (no row
 * has `from: 'RETIRED'`).
 */
export const CONTROL_LIFECYCLE_TRANSITIONS: readonly ControlLifecycleTransitionRule[] = [
  // DRAFT -> ACTIVE — control:edit, requires a defined owner (FR-005).
  {
    from: 'DRAFT',
    to: 'ACTIVE',
    requiredPermission: 'control:edit',
    preconditions: ['HAS_OWNER'],
  },
  // ACTIVE <-> SUSPENDED — control:edit, no precondition. Reactivation
  // preserves and recalculates effectiveness from the SAME assessment
  // history, never zeroed (edge case "Reativação de controle suspenso") —
  // a domain-level consequence of effectiveness being DERIVED (D-2), not
  // something this table itself needs to encode.
  { from: 'ACTIVE', to: 'SUSPENDED', requiredPermission: 'control:edit', preconditions: [] },
  { from: 'SUSPENDED', to: 'ACTIVE', requiredPermission: 'control:edit', preconditions: [] },
  // RETIRED — reachable from all three other states, terminal. A
  // discontinuation decision, not a routine edit (contracts/
  // controls.openapi.yaml's `transitionControl`), so `control:administer`
  // rather than `control:edit`, and a justification is required (US1 AS3).
  {
    from: 'DRAFT',
    to: 'RETIRED',
    requiredPermission: 'control:administer',
    preconditions: ['HAS_JUSTIFICATION'],
  },
  {
    from: 'ACTIVE',
    to: 'RETIRED',
    requiredPermission: 'control:administer',
    preconditions: ['HAS_JUSTIFICATION'],
  },
  {
    from: 'SUSPENDED',
    to: 'RETIRED',
    requiredPermission: 'control:administer',
    preconditions: ['HAS_JUSTIFICATION'],
  },
];

/** The single lookup every use case uses to answer "is (from, to) legal" —
 * `undefined` for any pair not in the table, which callers must treat as a
 * refusal, never as "no restriction" (mirrors
 * `risk-lifecycle.ts#findLifecycleTransition`). */
export function findControlLifecycleTransition(
  from: ControlStatus,
  to: ControlStatus,
): ControlLifecycleTransitionRule | undefined {
  return CONTROL_LIFECYCLE_TRANSITIONS.find((rule) => rule.from === from && rule.to === to);
}

/** Every legal target from `from` — for a future `GET
 * /controls/{controlId}/lifecycle` use case (T021+, out of this task's
 * scope) to build its `availableTransitions` list, filtered further by the
 * caller's held permissions. */
export function listControlLifecycleTransitionsFrom(
  from: ControlStatus,
): readonly ControlLifecycleTransitionRule[] {
  return CONTROL_LIFECYCLE_TRANSITIONS.filter((rule) => rule.from === from);
}

// ---------------------------------------------------------------------------
// Precondition evaluation — mirrors
// `modules/risk/domain/transition-preconditions.ts`'s `met`/`message` shape
// ---------------------------------------------------------------------------

/** What a precondition evaluator needs to know. Both fields are the
 * VALUE the control WOULD have after the pending write (mirrors
 * `risk.entity.ts#DraftCompletenessInput`'s own "current record + incoming
 * changes, already merged" convention) — a future use case (T021) builds
 * this from the current record plus the incoming request body. */
export interface ControlTransitionContext {
  /** The control's owner AFTER the pending write — `null`/`undefined`
   * means still unowned. */
  readonly ownerUserId: string | null | undefined;
  /** The justification supplied WITH this transition request, if any. */
  readonly justification: string | null | undefined;
}

export interface ControlPreconditionResult {
  readonly id: ControlTransitionPreconditionId;
  readonly met: boolean;
  /** pt-BR, phrased for display — populated regardless of `met`, so a
   * caller can always render "what this precondition requires" without a
   * second lookup; only unmet ones are surfaced to the client. */
  readonly message: string;
}

function evaluateHasOwner(ctx: ControlTransitionContext): ControlPreconditionResult {
  return {
    id: 'HAS_OWNER',
    met: ctx.ownerUserId !== null && ctx.ownerUserId !== undefined,
    message: USER_MESSAGES.controls.lifecycle.preconditions.hasOwner,
  };
}

function evaluateHasJustification(ctx: ControlTransitionContext): ControlPreconditionResult {
  const trimmed = ctx.justification?.trim();
  return {
    id: 'HAS_JUSTIFICATION',
    met: trimmed !== undefined && trimmed.length > 0,
    message: USER_MESSAGES.controls.lifecycle.preconditions.hasJustification,
  };
}

const EVALUATORS: Readonly<
  Record<
    ControlTransitionPreconditionId,
    (ctx: ControlTransitionContext) => ControlPreconditionResult
  >
> = {
  HAS_OWNER: evaluateHasOwner,
  HAS_JUSTIFICATION: evaluateHasJustification,
};

/** Evaluates one precondition against `ctx`. */
export function evaluateControlPrecondition(
  id: ControlTransitionPreconditionId,
  ctx: ControlTransitionContext,
): ControlPreconditionResult {
  return EVALUATORS[id](ctx);
}

/** Evaluates every precondition a transition rule declares, in order. An
 * empty `ids` array (no precondition) returns an empty result array —
 * every caller treats that as "nothing to check", not as an implicit
 * failure (mirrors `transition-preconditions.ts#evaluatePreconditions`). */
export function evaluateControlPreconditions(
  ids: readonly ControlTransitionPreconditionId[],
  ctx: ControlTransitionContext,
): readonly ControlPreconditionResult[] {
  return ids.map((id) => evaluateControlPrecondition(id, ctx));
}
