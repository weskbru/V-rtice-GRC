/**
 * PharosGRC — Action lifecycle status display mapping and UI-only
 * transition affordances (T056, 002-shared-grc-foundation, US2, FR-091).
 *
 * Purely presentational, mirroring `features/risks/status.ts`'s own
 * reasoning: the lifecycle itself (which transitions are legal, the
 * five-edge table, the reopen-reason requirement) is owned entirely by the
 * server (`grc/action/domain/action.entity.ts`). `ACTION_TRANSITIONS`
 * below exists ONLY to decide which buttons this screen offers — every
 * transition it enables is re-validated, independently and authoritatively,
 * by the server on submit (CLAUDE.md §18.9: a cosmetic/UI convenience must
 * never silently become the source of truth for a business rule).
 */
import { actions } from '@/lib/messages/actions';

import type { ActionStatus } from './types';
import type { StatusVariant } from '@pharos/design-system/components';

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
  // `actions.statusLabels` is `Record<ActionStatus, string>` (F-1) —
  // indexing by a valid `ActionStatus` can never miss.
  return actions.statusLabels[status];
}

/** One offered transition target, from a given current status. */
export interface ActionTransitionOption {
  readonly to: ActionStatus;
  readonly label: string;
  /** Whether the server requires a reason for this transition (only
   * `to: 'OPEN'`, Invariant A2) — drives whether the row action opens the
   * reason dialog or transitions immediately. */
  readonly requiresReason: boolean;
}

/** UI-only mirror of `action.entity.ts`'s five-edge transition table —
 * see this file's own header. Kept in the SAME shape (a table keyed by
 * `from`) so a future change to the server's table is easy to notice and
 * mirror here, rather than drifting silently. */
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
