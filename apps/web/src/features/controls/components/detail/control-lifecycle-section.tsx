'use client';

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
