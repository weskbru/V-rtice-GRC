'use client';

import { Ban, CalendarCheck, CalendarX, UserRound, UserRoundCheck } from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { problems } from '@/lib/messages/problems';

import { formatTimestamp } from '../../date';
import { availableProblemTransitions } from '../../status';
import { ProblemLifecycleActions } from '../problem-lifecycle-actions';

import { buildProblemLifecycleTrack } from './problem-lifecycle-track';
import { ProblemLifecycleTrackView } from './problem-lifecycle-track-view';

import type { ProblemDetail } from '../../types';

export interface ProblemLifecycleSectionProps {
  problem: ProblemDetail;
  canTransition: boolean;
  onChanged: (updated: ProblemDetail) => void;
}

export function ProblemLifecycleSection({
  problem,
  canTransition,
  onChanged,
}: ProblemLifecycleSectionProps): React.JSX.Element {
  const track = buildProblemLifecycleTrack(problem, availableProblemTransitions(problem.status));
  const outcomes = problems.detail.lifecycleOutcomes;
  const emptyLabel = problems.overview.notSet;

  const hasOutcomes =
    Boolean(problem.resolvedAt) ||
    Boolean(problem.resolvedBy) ||
    Boolean(problem.closedAt) ||
    Boolean(problem.closedBy) ||
    Boolean(problem.cancellationReason);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{problems.lifecycle.cardTitle}</CardTitle>
        <CardDescription>{problems.lifecycle.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ProblemLifecycleTrackView model={track} />

        <div className="pt-1">
          <ProblemLifecycleActions
            problem={problem}
            canTransition={canTransition}
            onChanged={onChanged}
          />
        </div>

        {hasOutcomes ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {problem.resolvedAt ? (
              <DetailField
                icon={CalendarCheck}
                label={outcomes.resolvedAtLabel}
                value={formatTimestamp(problem.resolvedAt)}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {problem.resolvedBy ? (
              <DetailField
                icon={UserRoundCheck}
                label={outcomes.resolvedByLabel}
                value={problem.resolvedBy.fullName}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {problem.cancellationReason ? (
              <DetailField
                icon={Ban}
                label={outcomes.cancellationReasonLabel}
                value={problem.cancellationReason}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {problem.closedAt ? (
              <DetailField
                icon={CalendarX}
                label={outcomes.closedAtLabel}
                value={formatTimestamp(problem.closedAt)}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {problem.closedBy ? (
              <DetailField
                icon={UserRound}
                label={outcomes.closedByLabel}
                value={problem.closedBy.fullName}
                emptyLabel={emptyLabel}
              />
            ) : null}
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}
