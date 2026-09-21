'use client';

/**
 * PharosGRC — incident detail, the "Ciclo de vida" card
 * (018-incident-detail-experience, Fase 2+3, corrected in the Fase 4 review
 * round — C3/C4 below).
 *
 * Composes, in this order, inside ONE card:
 *
 *   a. the track visual (`IncidentLifecycleTrackView`, built from
 *      `buildIncidentLifecycleTrack`) — read-only, zero requests of its own;
 *   b. `IncidentLifecycleActions` — the legal-transition button row, which
 *      lost its own `Card`/`CardContent` wrapper in this same rodada (a
 *      1120×118px card holding two 74×36px buttons measured 96% empty
 *      space);
 *   c. the incident's conditional outcome facts (resolution summary,
 *      resolved/closed at/by, cancellation reason) — moved out of
 *      `IncidentOverview`'s flat `<dl>` because they describe an OUTCOME OF
 *      THE LIFECYCLE, not the record's identity, and belong beside the
 *      track that visualizes that same lifecycle.
 *
 * ## The behaviour change this component exists to absorb
 *
 * Before this rodada, `IncidentLifecycleActions` WAS the entire "lifecycle"
 * card: it returned `null` outright when `!canTransition` or the status was
 * terminal, and the whole card vanished along with it. That component's own
 * null-return behaviour is UNCHANGED here (still exactly `!canTransition ||
 * options.length === 0`) — what changes is that it is no longer the sole
 * content of a page-level card. This component renders the track (and any
 * outcome facts) UNCONDITIONALLY, regardless of whether
 * `IncidentLifecycleActions` renders anything at all, because the track is
 * read-only information about data already on the page — it has no reason
 * to disappear just because there is nothing left to DO from here.
 *
 * ## C3 (Fase 4 review) — breathing room before the button row
 *
 * The track and the transition button row used to sit on the SAME `gap-4`
 * rhythm as every other pair of children in this card, reading as glued
 * together. The extra `pt-1` wrapper below is deliberate, narrow-scoped
 * spacing — not a change to the card's overall rhythm, which stays `gap-4`
 * for every other pair (actions ↔ outcomes already had its own visual
 * divider).
 *
 * ## C4 (Fase 4 review) — outcomes now use the same `DetailField` as
 * "Detalhes do incidente"
 *
 * The six conditional outcome facts used to render as bare `ReadOnlyField`
 * `dt`/`dd` pairs, with no icon, a few centimetres below a card where every
 * single field has one — an inconsistency the reviewer measured directly.
 * They now use the SAME shared `DetailField` (`@/components/detail/detail-
 * field`) `IncidentOverview` already uses, with icons chosen by 017's own
 * rule: reuse the product's vocabulary, never collide with a DIFFERENT
 * concept already anchored elsewhere on this screen. `FileText`
 * (Descrição), `AlertTriangle` (Severidade), `Building2` (Unidade),
 * `User`/`UserCheck` (Responsável/Reportado por) and `CalendarPlus`/
 * `CalendarClock` (Reportado em/Registrado em) are all taken by
 * `IncidentOverview` — none of the six icons below repeats any of them:
 * `ScrollText` (a written note, distinct from Descrição's own `FileText`),
 * `CalendarCheck`/`CalendarX` (dates, distinct from the two already used),
 * `UserRoundCheck`/`UserRound` (people, distinct from `User`/`UserCheck`),
 * and `Ban` — the exact icon `AssetLifecycleActions`/
 * `ProcessLifecycleActions`/`ProblemRegisterSummary` already use for
 * "cancelled"/"inactive" across this product (§18.12 — reused, not
 * invented).
 */
import { Ban, CalendarCheck, CalendarX, ScrollText, UserRound, UserRoundCheck } from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { incidents } from '@/lib/messages/incidents';

import { formatTimestamp } from '../../date';
import { availableIncidentTransitions } from '../../status';
import { IncidentLifecycleActions } from '../incident-lifecycle-actions';

import { buildIncidentLifecycleTrack } from './incident-lifecycle-track';
import { IncidentLifecycleTrackView } from './incident-lifecycle-track-view';

import type { IncidentDetail } from '../../types';

export interface IncidentLifecycleSectionProps {
  incident: IncidentDetail;
  canTransition: boolean;
  onChanged: (updated: IncidentDetail) => void;
}

export function IncidentLifecycleSection({
  incident,
  canTransition,
  onChanged,
}: IncidentLifecycleSectionProps): React.JSX.Element {
  const track = buildIncidentLifecycleTrack(
    incident,
    availableIncidentTransitions(incident.status),
  );
  const outcomes = incidents.detail.lifecycleOutcomes;
  const emptyLabel = incidents.overview.notSet;

  const hasOutcomes =
    Boolean(incident.resolutionSummary) ||
    Boolean(incident.resolvedAt) ||
    Boolean(incident.resolvedBy) ||
    Boolean(incident.closedAt) ||
    Boolean(incident.closedBy) ||
    Boolean(incident.cancellationReason);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{incidents.lifecycle.cardTitle}</CardTitle>
        <CardDescription>{incidents.lifecycle.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <IncidentLifecycleTrackView model={track} />

        {/* C3 — deliberate extra breathing room ahead of the button row only, not a change to the card's overall gap-4 rhythm. */}
        <div className="pt-1">
          <IncidentLifecycleActions
            incident={incident}
            canTransition={canTransition}
            onChanged={onChanged}
          />
        </div>

        {hasOutcomes ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {incident.resolutionSummary ? (
              <DetailField
                icon={ScrollText}
                label={outcomes.resolutionSummaryLabel}
                value={incident.resolutionSummary}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {incident.resolvedAt ? (
              <DetailField
                icon={CalendarCheck}
                label={outcomes.resolvedAtLabel}
                value={formatTimestamp(incident.resolvedAt)}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {incident.resolvedBy ? (
              <DetailField
                icon={UserRoundCheck}
                label={outcomes.resolvedByLabel}
                value={incident.resolvedBy.fullName}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {incident.cancellationReason ? (
              <DetailField
                icon={Ban}
                label={outcomes.cancellationReasonLabel}
                value={incident.cancellationReason}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {incident.closedAt ? (
              <DetailField
                icon={CalendarX}
                label={outcomes.closedAtLabel}
                value={formatTimestamp(incident.closedAt)}
                emptyLabel={emptyLabel}
              />
            ) : null}
            {incident.closedBy ? (
              <DetailField
                icon={UserRound}
                label={outcomes.closedByLabel}
                value={incident.closedBy.fullName}
                emptyLabel={emptyLabel}
              />
            ) : null}
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}
