'use client';

/**
 * PharosGRC — problem detail, lifecycle action bar (008-incidents-problems,
 * US2), mirroring `ControlLifecycleActions`'/`RiskLifecycleActions`'
 * overall shape (CLAUDE.md §18.12). Renders exactly what
 * `availableProblemTransitions(problem.status)` returns — this component
 * contains no transition table and no precondition logic of its own. An
 * illegal move is never offered as a disabled/refused button; it is simply
 * absent, and a terminal status (`CLOSED`/`CANCELLED`) or a caller without
 * `problem:transition` renders nothing at all from this component.
 *
 * `toStatus: CLOSED` routes to `ProblemCloseDialog` (the proactive
 * legibility screen); every other transition routes to the generic
 * `ProblemTransitionDialog`. Never both open at once — a single
 * `pendingOption` selection decides which one is showing.
 *
 * ## No longer its own card (019-problem-detail-experience, Fase B)
 *
 * This used to be a full-width `Card` whose ENTIRE content, on a terminal
 * status, was the single sentence "Nenhuma transição disponível para o
 * status atual." — mirrors `IncidentLifecycleActions`'s own identical
 * Fase 2+3 correction. It is now a plain button row, embedded inside
 * `ProblemLifecycleSection`'s own "Ciclo de vida" card alongside the track
 * visual and any outcome facts; that track already shows a terminal status
 * plainly, so the "nenhuma transição" sentence is retired rather than
 * moved — nothing needs to say it twice. The return-`null` conditions below
 * (`!canTransition || options.length === 0`) mirror
 * `IncidentLifecycleActions`'s own exactly. The enclosing card keeps
 * rendering the track regardless of what this component returns; see
 * `problem-lifecycle-section.tsx`'s own header comment.
 */
import { ArrowRightCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { availableProblemTransitions } from '../status';

import { ProblemCloseDialog } from './problem-close-dialog';
import { ProblemTransitionDialog } from './problem-transition-dialog';

import type { ProblemTransitionOption } from '../status';
import type { ProblemDetail } from '../types';

export interface ProblemLifecycleActionsProps {
  problem: ProblemDetail;
  canTransition: boolean;
  onChanged: (problem: ProblemDetail) => void;
}

export function ProblemLifecycleActions({
  problem,
  canTransition,
  onChanged,
}: ProblemLifecycleActionsProps): React.JSX.Element | null {
  const [pendingOption, setPendingOption] = useState<ProblemTransitionOption | null>(null);
  const [pendingClose, setPendingClose] = useState(false);

  const availableTransitions = availableProblemTransitions(problem.status);

  if (!canTransition || availableTransitions.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {availableTransitions.map((option) => (
          <Button
            key={option.to}
            type="button"
            variant={option.to === 'CANCELLED' ? 'destructive' : 'default'}
            onClick={() =>
              option.to === 'CLOSED' ? setPendingClose(true) : setPendingOption(option)
            }
          >
            <ArrowRightCircle aria-hidden="true" className="size-4" />
            {option.label}
          </Button>
        ))}
      </div>

      <ProblemTransitionDialog
        problem={pendingOption ? problem : null}
        option={pendingOption}
        onOpenChange={(open) => {
          if (!open) setPendingOption(null);
        }}
        onTransitioned={(updated) => {
          setPendingOption(null);
          onChanged(updated);
        }}
      />

      <ProblemCloseDialog
        problem={pendingClose ? problem : null}
        onOpenChange={(open) => {
          if (!open) setPendingClose(false);
        }}
        onClosed={(updated) => {
          setPendingClose(false);
          onChanged(updated);
        }}
      />
    </>
  );
}
