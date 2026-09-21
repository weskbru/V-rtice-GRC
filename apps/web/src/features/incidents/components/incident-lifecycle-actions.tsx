'use client';

/**
 * PharosGRC — incident lifecycle action bar (008-incidents-problems, US1).
 *
 * Renders ONLY the transitions `availableIncidentTransitions(incident
 * .status)` returns — an illegal move is never offered as a disabled or
 * greyed-out button that then gets refused on click; it is simply absent
 * (CLAUDE.md's own acceptance question, and the coordinator's explicit
 * instruction: "make the legal transitions obvious and the illegal ones
 * unavailable rather than offered-then-refused"). A terminal status
 * (`CLOSED`/`CANCELLED`) therefore renders no actions at all, which is
 * itself the correct, honest state — not a control pretending something is
 * missing.
 *
 * `start` (`OPEN -> IN_PROGRESS`) is the one transition with no
 * confirmation dialog and no required field (`confirmKey: undefined`) —
 * applied immediately on click, mirroring `MyActionsView.applyTransition`'s
 * own direct-call pattern for every transition except reopen. Every other
 * option opens `IncidentTransitionDialog`, which is the sole place any of
 * them is actually submitted.
 *
 * ## No longer its own card (018-incident-detail-experience, Fase 2+3)
 *
 * This used to be a full-width `Card` holding nothing but this button row —
 * measured at 1120×118px for two 74×36px buttons, 96% empty space. It is
 * now a plain row, embedded inside `IncidentLifecycleSection`'s own "Ciclo
 * de vida" card alongside the track visual and any outcome facts. The
 * return-`null` conditions below (`!canTransition || options.length === 0`)
 * are UNCHANGED — only the surrounding chrome moved. The enclosing card
 * keeps rendering the track regardless of what this component returns; see
 * `incident-lifecycle-section.tsx`'s own header comment.
 */
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
