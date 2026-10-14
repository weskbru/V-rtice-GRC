'use client';

import {
  Building2,
  CalendarClock,
  CalendarPlus,
  FileText,
  History,
  Milestone,
  User,
} from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Link } from '@/components/navigation/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { actions } from '@/lib/messages/actions';

import { formatDateOnly, formatTimestamp } from '../../risks/date';
import { actionOriginHref } from '../origin';

import type { Action } from '../types';

export interface ActionOverviewProps {
  action: Action;
}

export function ActionOverview({ action }: ActionOverviewProps): React.JSX.Element {
  const overview = actions.overview;
  const fields = overview.fields;

  const originTypeLabel = actions.originTypeLabels[action.originType];
  const originLabel = action.originLabel ?? originTypeLabel;
  const originHref = actionOriginHref(action.originType, action.originId);
  const showOriginTypeEyebrow = originLabel !== originTypeLabel;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
              {overview.descriptionCardTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {action.description?.trim() ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">{action.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{overview.descriptionEmpty}</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Milestone aria-hidden="true" className="size-4 text-muted-foreground" />
              {overview.originCardTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {showOriginTypeEyebrow ? (
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {originTypeLabel}
              </p>
            ) : null}
            <p className="text-base font-medium text-foreground">
              {originHref ? (
                <Link
                  href={originHref}
                  className="text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {originLabel}
                </Link>
              ) : (
                originLabel
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{overview.detailsCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <DetailField
              icon={Building2}
              label={fields.orgUnit}
              value={action.orgUnit.name}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={User}
              label={fields.responsible}
              value={action.responsible.fullName}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarClock}
              label={fields.dueOn}
              value={formatDateOnly(action.dueOn)}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={fields.createdAt}
              value={formatTimestamp(action.createdAt)}
              emptyLabel={overview.notSet}
              muted
            />
            <DetailField
              icon={History}
              label={fields.updatedAt}
              value={formatTimestamp(action.updatedAt)}
              emptyLabel={overview.notSet}
              muted
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
