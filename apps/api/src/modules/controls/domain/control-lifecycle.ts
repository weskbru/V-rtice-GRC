import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { ControlStatus } from '@prisma/client';

export type ControlTransitionPreconditionId = 'HAS_OWNER' | 'HAS_JUSTIFICATION';

export interface ControlLifecycleTransitionRule {
  readonly from: ControlStatus;
  readonly to: ControlStatus;
  readonly requiredPermission: PermissionIdentifier;
  readonly preconditions: readonly ControlTransitionPreconditionId[];
}

export const CONTROL_LIFECYCLE_TRANSITIONS: readonly ControlLifecycleTransitionRule[] = [
  {
    from: 'DRAFT',
    to: 'ACTIVE',
    requiredPermission: 'control:edit',
    preconditions: ['HAS_OWNER'],
  },
  { from: 'ACTIVE', to: 'SUSPENDED', requiredPermission: 'control:edit', preconditions: [] },
  { from: 'SUSPENDED', to: 'ACTIVE', requiredPermission: 'control:edit', preconditions: [] },
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

export function findControlLifecycleTransition(
  from: ControlStatus,
  to: ControlStatus,
): ControlLifecycleTransitionRule | undefined {
  return CONTROL_LIFECYCLE_TRANSITIONS.find((rule) => rule.from === from && rule.to === to);
}

export function listControlLifecycleTransitionsFrom(
  from: ControlStatus,
): readonly ControlLifecycleTransitionRule[] {
  return CONTROL_LIFECYCLE_TRANSITIONS.filter((rule) => rule.from === from);
}

export interface ControlTransitionContext {
  readonly ownerUserId: string | null | undefined;
  readonly justification: string | null | undefined;
}

export interface ControlPreconditionResult {
  readonly id: ControlTransitionPreconditionId;
  readonly met: boolean;
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

export function evaluateControlPrecondition(
  id: ControlTransitionPreconditionId,
  ctx: ControlTransitionContext,
): ControlPreconditionResult {
  return EVALUATORS[id](ctx);
}

export function evaluateControlPreconditions(
  ids: readonly ControlTransitionPreconditionId[],
  ctx: ControlTransitionContext,
): readonly ControlPreconditionResult[] {
  return ids.map((id) => evaluateControlPrecondition(id, ctx));
}
