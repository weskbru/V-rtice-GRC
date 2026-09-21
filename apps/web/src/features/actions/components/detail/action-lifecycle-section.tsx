'use client';

/**
 * PharosGRC — action detail, the "Ciclo de vida" card
 * (020-action-detail-experience, Fase B).
 *
 * Composes, in this order, inside ONE card:
 *
 *   a. the track visual (`ActionLifecycleTrackView`, built from
 *      `buildActionLifecycleTrack`) — read-only, zero requests of its own;
 *   b. `ActionLifecycleActions` — the legal-transition button row, which
 *      lost its own `Card` wrapper in this same phase (mirrors `Incident
 *      LifecycleActions`'s/`ProblemLifecycleActions`'s own identical
 *      correction — a full-width card holding nothing but a short button
 *      row measured mostly empty);
 *   c. the action's conditional outcome facts (`completedAt`/`reopenedAt`)
 *      — moved out of `ActionOverview`'s cards because they describe an
 *      OUTCOME OF THE LIFECYCLE, not the record's identity, and belong
 *      beside the track that visualizes that same lifecycle.
 *
 * ## The behaviour change this component exists to absorb
 *
 * Before this phase, `ActionLifecycleActions` WAS the entire "lifecycle"
 * surface — a page-level `Card` on its own, above the tabs, that simply
 * rendered nothing (`null`) on a terminal status or without `action:edit`.
 * That component's own null-return behaviour is UNCHANGED here (still
 * exactly `!canTransition || options.length === 0`) — what changes is that
 * it is no longer a page-level element of its own. This component renders
 * the track (and any outcome facts) UNCONDITIONALLY, regardless of whether
 * `ActionLifecycleActions` renders anything at all, because the track is
 * read-only information about data already on the page — it has no reason
 * to disappear just because there is nothing left to DO from here, or
 * because the caller cannot transition (`action:view`-only, FR-042).
 *
 * Icons for the two outcome facts (`CalendarCheck`/`RotateCcw`) do not
 * collide with any icon `ActionOverview` uses elsewhere on this same
 * screen (`Building2`/`User`/`CalendarClock`/`CalendarPlus`/`History` for
 * its own "Detalhes da ação" card, `Milestone` for "Origem", `FileText` for
 * "Descrição") — CLAUDE.md §18.12, reused-vocabulary discipline applied to
 * a fresh pairing this screen has not needed before.
 */
import { CalendarCheck, RotateCcw } from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { actions } from '@/lib/messages/actions';

import { formatTimestamp } from '../../../risks/date';
import { availableTransitions } from '../../status';
import { ActionLifecycleActions } from '../action-lifecycle-actions';

import { buildActionLifecycleTrack } from './action-lifecycle-track';
import { ActionLifecycleTrackView } from './action-lifecycle-track-view';

import type { Action } from '../../types';

export interface ActionLifecycleSectionProps {
  action: Action;
  canTransition: boolean;
  onChanged: (updated: Action) => void;
}

export function ActionLifecycleSection({
  action,
  canTransition,
  onChanged,
}: ActionLifecycleSectionProps): React.JSX.Element {
  const track = buildActionLifecycleTrack(action, availableTransitions(action.status));
  const outcomes = actions.detail.lifecycleOutcomes;
  const emptyLabel = actions.overview.notSet;

  const hasOutcomes = Boolean(action.completedAt) || Boolean(action.reopenedAt);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{actions.lifecycle.cardTitle}</CardTitle>
        <CardDescription>{actions.lifecycle.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ActionLifecycleTrackView model={track} />

        {/* Deliberate extra breathing room ahead of the button row only, not a change to the card's overall gap-4 rhythm — mirrors IncidentLifecycleSection's/ProblemLifecycleSection's identical spacing. */}
        <div className="pt-1">
          <ActionLifecycleActions
            action={action}
            canTransition={canTransition}
            onChanged={onChanged}
          />
        </div>

        {hasOutcomes ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {action.completedAt ? (
              <DetailField
                icon={CalendarCheck}
                label={outcomes.completedAtLabel}
                value={formatTimestamp(action.completedAt)}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {action.reopenedAt ? (
              <DetailField
                icon={RotateCcw}
                label={outcomes.reopenedAtLabel}
                value={formatTimestamp(action.reopenedAt)}
                emptyLabel={emptyLabel}
              />
            ) : null}
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}
