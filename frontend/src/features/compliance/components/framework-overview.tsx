'use client';

import { CalendarClock, CalendarPlus, FileText, Landmark } from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { compliance } from '@/lib/messages/compliance';

import { formatTimestampDate } from '../date';

import type { Framework } from '../types';

export interface FrameworkOverviewProps {
  framework: Framework;
}

export function FrameworkOverview({ framework }: FrameworkOverviewProps): React.JSX.Element {
  const overview = compliance.frameworkDetail.overview;

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
          <p className="max-w-4xl whitespace-pre-wrap text-sm text-foreground">
            {framework.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{overview.contextCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField
              icon={Landmark}
              label={overview.originLabel}
              value={compliance.originLabels[framework.origin]}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={overview.createdAtLabel}
              value={formatTimestampDate(framework.createdAt)}
              emptyLabel={overview.notSet}
              muted
            />
            <DetailField
              icon={CalendarClock}
              label={overview.updatedAtLabel}
              value={formatTimestampDate(framework.updatedAt)}
              emptyLabel={overview.notSet}
              muted
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
