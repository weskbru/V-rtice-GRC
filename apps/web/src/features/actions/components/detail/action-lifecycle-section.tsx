'use client';

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
