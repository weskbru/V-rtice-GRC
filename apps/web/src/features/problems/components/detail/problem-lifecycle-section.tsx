'use client';

/**
 * PharosGRC — problem detail, the "Ciclo de vida" card
 * (019-problem-detail-experience, Fase B).
 *
 * Composes, in this order, inside ONE card:
 *
 *   a. the track visual (`ProblemLifecycleTrackView`, built from
 *      `buildProblemLifecycleTrack`) — read-only, zero requests of its own;
 *   b. `ProblemLifecycleActions` — the legal-transition button row, which
 *      loses its own `Card`/`CardHeader`/`CardContent` wrapper in this same
 *      phase (mirrors `IncidentLifecycleActions`'s own Fase 2+3 correction:
 *      a full-width card holding nothing but a short button row, or a single
 *      "Nenhuma transição disponível" sentence, measured mostly empty);
 *   c. the problem's conditional outcome facts (`resolvedAt`/`resolvedBy`,
 *      `closedAt`/`closedBy`, `cancellationReason`) — moved out of
 *      `ProblemOverview`'s flat `<dl>` because they describe an OUTCOME OF
 *      THE LIFECYCLE, not the record's identity, and belong beside the track
 *      that visualizes that same lifecycle. `rootCause` is deliberately NOT
 *      among them — it is Problem's own point of registration (the reason
 *      `IN_ANALYSIS`, not `IN_PROGRESS`, exists), and gets its own
 *      first-class card in "Visão geral" instead (`problem-overview.tsx`).
 *
 * ## The behaviour change this component exists to absorb
 *
 * Before this phase, `ProblemLifecycleActions` WAS the entire "lifecycle"
 * card, including a "Nenhuma transição disponível para o status atual."
 * sentence as its only content on a terminal status — a full-width card for
 * one line of absence. That component's own null-return behaviour is
 * UNCHANGED here (still exactly `!canTransition`) — what changes is that it
 * is no longer the sole content of a page-level card, and it no longer
 * renders the "no transitions" sentence itself (nothing needs to: the track
 * above already shows the terminal status plainly). This component renders
 * the track (and any outcome facts) UNCONDITIONALLY, regardless of whether
 * `ProblemLifecycleActions` renders anything at all, because the track is
 * read-only information about data already on the page — it has no reason
 * to disappear just because there is nothing left to DO from here.
 *
 * Icons for the six outcome facts mirror `IncidentLifecycleSection`'s own
 * choices for the four they share (`CalendarCheck`/`CalendarX` for the two
 * dates, `UserRoundCheck`/`UserRound` for the two people, `Ban` for the
 * cancellation reason) — none collide with any icon `ProblemOverview` uses
 * elsewhere on this same screen (CLAUDE.md §18.12: reused, not invented).
 */
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

        {/* Deliberate extra breathing room ahead of the button row only, not a change to the card's overall gap-4 rhythm — mirrors IncidentLifecycleSection's identical C3 spacing. */}
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
