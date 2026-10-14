'use client';

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
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
