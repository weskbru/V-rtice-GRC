'use client';

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
