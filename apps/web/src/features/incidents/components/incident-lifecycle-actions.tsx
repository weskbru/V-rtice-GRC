'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { incidents } from '@/lib/messages/incidents';

import { incidentsApi } from '../api';
import { availableIncidentTransitions } from '../status';

import { IncidentTransitionDialog } from './incident-transition-dialog';

import type { IncidentTransitionOption } from '../status';
import type { IncidentDetail } from '../types';

export interface IncidentLifecycleActionsProps {
  incident: IncidentDetail;
  canTransition: boolean;
  onChanged: (updated: IncidentDetail) => void;
}

export function IncidentLifecycleActions({
  incident,
  canTransition,
  onChanged,
}: IncidentLifecycleActionsProps): React.JSX.Element | null {
  const [pendingOption, setPendingOption] = useState<IncidentTransitionOption | null>(null);
  const [applyingImmediateTo, setApplyingImmediateTo] = useState<string | null>(null);

  const options = availableIncidentTransitions(incident.status);

  if (!canTransition || options.length === 0) {
    return null;
  }

  async function applyImmediately(option: IncidentTransitionOption): Promise<void> {
    setApplyingImmediateTo(option.to);
    try {
      const updated = await incidentsApi.transition(incident.id, { toStatus: option.to });
      feedback.success(option.label);
      onChanged(updated);
    } catch (error) {
      const fallback = incidents.lifecycle.transitionError;
      feedback.error(error instanceof ApiError ? (error.problem.detail ?? fallback) : fallback);
    } finally {
      setApplyingImmediateTo(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => {
          const isImmediate = option.confirmKey === undefined;
          const isApplying = applyingImmediateTo === option.to;
          return (
            <Button
              key={option.to}
              type="button"
              variant={option.to === 'CANCELLED' ? 'outline' : 'default'}
              disabled={isApplying}
              onClick={() => {
                if (isImmediate) {
                  void applyImmediately(option);
                } else {
                  setPendingOption(option);
                }
              }}
            >
              {isApplying ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {option.label}
            </Button>
          );
        })}
      </div>

      <IncidentTransitionDialog
        incident={incident}
        option={pendingOption}
        onOpenChange={(open) => {
          if (!open) setPendingOption(null);
        }}
        onTransitioned={(updated) => {
          setPendingOption(null);
          onChanged(updated);
        }}
      />
    </>
  );
}
