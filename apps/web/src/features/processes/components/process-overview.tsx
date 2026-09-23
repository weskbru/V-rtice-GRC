'use client';

import { Building2, CalendarClock, CalendarPlus, FileText } from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { processes } from '@/lib/messages/processes';

import { formatTimestampDate } from '../date';

import type { ProcessDetail } from '../types';

export interface ProcessOverviewProps {
  process: ProcessDetail;
}

export function ProcessOverview({ process }: ProcessOverviewProps): React.JSX.Element {
  const overview = processes.detail.overview;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
            {overview.descriptionCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={
              process.description
                ? 'text-sm whitespace-pre-wrap text-foreground'
                : 'text-sm text-muted-foreground'
            }
          >
            {process.description ?? overview.noDescription}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{overview.detailsCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField
              icon={Building2}
              label={overview.orgUnitLabel}
              value={process.orgUnit?.name ?? null}
              emptyLabel={processes.detail.metadata.noOrgUnit}
            />
            <DetailField
              icon={CalendarPlus}
              label={overview.createdAtLabel}
              value={formatTimestampDate(process.createdAt)}
              emptyLabel={overview.notSet}
              muted
            />
            <DetailField
              icon={CalendarClock}
              label={overview.updatedAtLabel}
              value={formatTimestampDate(process.updatedAt)}
              emptyLabel={overview.notSet}
              muted
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
