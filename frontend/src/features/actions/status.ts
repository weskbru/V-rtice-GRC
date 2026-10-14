import { actions } from '@/lib/messages/actions';

import type { ActionStatus } from './types';
import type { StatusVariant } from '@vertice/design-system/components';

const VARIANT_BY_STATUS: Record<ActionStatus, StatusVariant> = {
  OPEN: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export function actionStatusBadgeVariant(status: ActionStatus): StatusVariant {
  return VARIANT_BY_STATUS[status];
}

export function actionStatusLabel(status: ActionStatus): string {
  return actions.statusLabels[status];
}

export interface ActionTransitionOption {
  readonly to: ActionStatus;
  readonly label: string;
  readonly requiresReason: boolean;
}

const TRANSITION_OPTIONS_BY_STATUS: Record<ActionStatus, readonly ActionTransitionOption[]> = {
  OPEN: [
    { to: 'IN_PROGRESS', label: actions.transitions.start, requiresReason: false },
    { to: 'CANCELLED', label: actions.transitions.cancel, requiresReason: false },
  ],
  IN_PROGRESS: [
    { to: 'COMPLETED', label: actions.transitions.complete, requiresReason: false },
    { to: 'CANCELLED', label: actions.transitions.cancel, requiresReason: false },
  ],
  COMPLETED: [{ to: 'OPEN', label: actions.transitions.reopen, requiresReason: true }],
  CANCELLED: [],
};

export function availableTransitions(status: ActionStatus): readonly ActionTransitionOption[] {
  return TRANSITION_OPTIONS_BY_STATUS[status];
}
