'use client';

/**
 * PharosGRC — control detail, the "Ciclo de vida" card
 * (021-control-detail-experience, Fase B).
 *
 * Composes, in this order, inside ONE card:
 *
 *   a. the track visual (`ControlLifecycleTrackView`, built from
 *      `buildControlLifecycleTrack`) — read-only, zero requests of its own,
 *      shown only once `lifecycle` has actually loaded (see below);
 *   b. `ControlLifecycleActions` — the legal-transition button row, which
 *      lost its own `Card` wrapper AND its own fetch in this same phase
 *      (mirrors `ProblemLifecycleActions`'/`ActionLifecycleActions`'own
 *      identical correction — a full-width card holding nothing but a short
 *      button row, measured mostly empty);
 *   c. the control's conditional outcome facts (`retiredAt`/`retiredBy`/
 *      `retirementReason`) — moved out of `ControlOverview`'s cards because
 *      they describe an OUTCOME OF THE LIFECYCLE, not the record's
 *      identity, and belong beside the track that visualizes that same
 *      lifecycle. Each renders ONLY when its own field is actually present
 *      (the coordinator's own instruction — never all-or-nothing on
 *      `status === 'RETIRED'`, even though in practice all three are always
 *      set together by `PerformControlTransitionUseCase`'s own single write
 *      path into `RETIRED`).
 *
 * ## Loading/error ownership — new in this phase
 *
 * Before this phase, `ControlLifecycleActions` fetched `GET .../lifecycle`
 * itself and owned its own loading/error `Card`. Since it no longer has a
 * `Card` at all, THIS component now owns that: while `loading`, the card
 * shows only the loading sentence (no track — building a track from
 * `control.status` alone, before `availableTransitions` has resolved, would
 * render every non-current position as `unavailable` and then visibly
 * "correct" to `available` a moment later, exactly the kind of flicker
 * `RiskLifecycleSection`'s own `trajectory` slot avoids by the same means:
 * never rendering the trajectory until the fetch it depends on has
 * resolved). Outcome facts, by contrast, come from `control` (already
 * loaded by the time this component ever mounts) — they render
 * unconditionally, regardless of the lifecycle fetch's own state, since
 * there is no reason to hide a known fact while an unrelated request is
 * still in flight.
 */
import { CalendarX, FileWarning, UserRound } from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTimestamp } from '@/features/controls/date';
import { controls } from '@/lib/messages/controls';

import { ControlLifecycleActions } from '../control-lifecycle-actions';

import { buildControlLifecycleTrack } from './control-lifecycle-track';
import { ControlLifecycleTrackView } from './control-lifecycle-track-view';

import type { ControlDetail, ControlLifecycleState } from '../../types';

export interface ControlLifecycleSectionProps {
  control: ControlDetail;
  etag: string;
  lifecycle: ControlLifecycleState | null;
  loading: boolean;
  loadError: boolean;
  onChanged: () => void;
}

export function ControlLifecycleSection({
  control,
  etag,
  lifecycle,
  loading,
  loadError,
  onChanged,
}: ControlLifecycleSectionProps): React.JSX.Element {
  const outcomes = controls.detail.lifecycleOutcomes;
  const emptyLabel = controls.detail.overview.notSet;

  const hasOutcomes =
    Boolean(control.retiredAt) || Boolean(control.retiredBy) || Boolean(control.retirementReason);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{controls.lifecycle.cardTitle}</CardTitle>
        <CardDescription>{controls.lifecycle.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{controls.lifecycle.loading}</p>
        ) : loadError || !lifecycle ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {controls.lifecycle.loadError}
          </p>
        ) : (
          <>
            <ControlLifecycleTrackView
              model={buildControlLifecycleTrack(control, lifecycle.availableTransitions)}
            />

            {/* Deliberate extra breathing room ahead of the button row only, not a change to the card's overall gap-4 rhythm — mirrors ProblemLifecycleSection's/ActionLifecycleSection's identical spacing. */}
            <div className="pt-1">
              <ControlLifecycleActions
                controlId={control.id}
                etag={etag}
                availableTransitions={lifecycle.availableTransitions}
                onChanged={onChanged}
              />
            </div>
          </>
        )}

        {hasOutcomes ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {control.retiredAt ? (
              <DetailField
                icon={CalendarX}
                label={outcomes.retiredAtLabel}
                value={formatTimestamp(control.retiredAt)}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {control.retiredBy ? (
              <DetailField
                icon={UserRound}
                label={outcomes.retiredByLabel}
                value={control.retiredBy.fullName}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {control.retirementReason ? (
              <DetailField
                icon={FileWarning}
                label={outcomes.retirementReasonLabel}
                value={control.retirementReason}
                emptyLabel={emptyLabel}
              />
            ) : null}
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}
