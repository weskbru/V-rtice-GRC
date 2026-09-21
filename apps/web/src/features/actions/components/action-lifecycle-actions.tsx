'use client';

/**
 * PharosGRC — action detail, lifecycle action bar. Mirrors
 * `IncidentLifecycleActions`'s own shape: renders ONLY the transitions
 * `availableTransitions(action.status)` returns — an illegal move is never
 * offered disabled-then-refused, it is simply absent. A terminal status
 * (`CANCELLED`) therefore renders no actions at all.
 *
 * The one transition requiring a reason (`COMPLETED -> OPEN`, Invariant
 * A2) opens the EXISTING `ReopenActionDialog` — reused verbatim, not
 * reimplemented, exactly as this task's own instruction requires. Every
 * other transition applies immediately on click, mirroring `MyActionsView
 * .applyTransition`'s own direct-call pattern.
 *
 * Every transition offered here is advisory only (FR-042) — the server
 * re-validates the full legality table and every permission/scope check
 * independently on submit (`status.ts`'s own header).
 *
 * ## No `Card` of its own (020-action-detail-experience, Fase B)
 *
 * Used to be a page-level `Card` on its own, sitting above the tabs. It is
 * now composed INSIDE `ActionLifecycleSection`'s own "Ciclo de vida" card,
 * below the track visual — mirroring `IncidentLifecycleActions`'s/
 * `ProblemLifecycleActions`'s own identical correction: a full-width card
 * holding nothing but a short button row (or nothing at all, on a terminal
 * status) measured mostly empty space. The `!canTransition ||
 * options.length === 0` early return is UNCHANGED — `null` here now simply
 * means the button row is absent from the surrounding card, not that the
 * card itself disappears; the track above renders unconditionally either
 * way (`ActionLifecycleSection`'s own header comment).
 */
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { actions } from '@/lib/messages/actions';

import { actionsApi } from '../api';
import { availableTransitions } from '../status';

import { ReopenActionDialog } from './reopen-action-dialog';

import type { Action, ActionStatus } from '../types';

export interface ActionLifecycleActionsProps {
  action: Action;
  canTransition: boolean;
  onChanged: (updated: Action) => void;
}

export function ActionLifecycleActions({
  action,
  canTransition,
  onChanged,
}: ActionLifecycleActionsProps): React.JSX.Element | null {
  const [pendingReopen, setPendingReopen] = useState<Action | null>(null);
  const [applyingTo, setApplyingTo] = useState<ActionStatus | null>(null);

  const options = availableTransitions(action.status);

  if (!canTransition || options.length === 0) {
    return null;
  }

  async function applyImmediately(to: ActionStatus, label: string): Promise<void> {
    setApplyingTo(to);
    try {
      const updated = await actionsApi.transitionAction(action.id, { to });
      feedback.success(actions.myActions.transitions.transitionSuccess(label));
      onChanged(updated);
    } catch (caught) {
      const detail = caught instanceof ApiError ? caught.problem.detail : undefined;
      feedback.error(detail ?? actions.myActions.transitions.transitionFailed);
    } finally {
      setApplyingTo(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option) => {
        const isApplying = applyingTo === option.to;
        return (
          <Button
            key={option.to}
            type="button"
            variant={option.to === 'CANCELLED' ? 'outline' : 'default'}
            disabled={isApplying}
            onClick={() => {
              if (option.requiresReason) {
                setPendingReopen(action);
              } else {
                void applyImmediately(option.to, option.label);
              }
            }}
          >
            {isApplying ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {option.label}
          </Button>
        );
      })}

      <ReopenActionDialog
        action={pendingReopen}
        onOpenChange={(open) => {
          if (!open) setPendingReopen(null);
        }}
        onApplied={() => {
          setPendingReopen(null);
          actionsApi
            .getAction(action.id)
            .then(onChanged)
            .catch(() => {
              // Best-effort refresh only — `ReopenActionDialog` already
              // showed its own success feedback for the transition itself;
              // a failed re-fetch here just leaves the detail view showing
              // the pre-reopen snapshot until the next reload, never a
              // silently wrong status.
            });
        }}
      />
    </div>
  );
}
