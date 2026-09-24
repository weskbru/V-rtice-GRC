'use client';

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
