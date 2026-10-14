'use client';

import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarPlus,
  FileText,
  Search,
  User,
} from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { problems } from '@/lib/messages/problems';
import { StatusBadge } from '@vertice/design-system/components';

import { formatDateOnly, formatTimestampDate } from '../date';
import { problemSeverityBadgeVariant, problemSeverityLabel } from '../status';

import type { ProblemDetail } from '../types';

export interface ProblemOverviewProps {
  problem: ProblemDetail;
}

export function ProblemOverview({ problem }: ProblemOverviewProps): React.JSX.Element {
  const overview = problems.overview;
  const fields = overview.fields;

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
          <p className="whitespace-pre-wrap text-sm text-foreground">{problem.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search aria-hidden="true" className="size-4 text-muted-foreground" />
            {overview.rootCauseCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {problem.rootCause ? (
            <p className="whitespace-pre-wrap text-sm text-foreground">{problem.rootCause}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{overview.rootCauseEmptyDescription}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{overview.detailsCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField
              icon={AlertTriangle}
              label={fields.severity}
              value={
                <StatusBadge
                  variant={problemSeverityBadgeVariant(problem.severity)}
                  label={problemSeverityLabel(problem.severity)}
                />
              }
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={Building2}
              label={fields.orgUnit}
              value={problem.orgUnit.name}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={User}
              label={fields.owner}
              value={problem.owner.fullName}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={fields.identifiedOn}
              value={formatDateOnly(problem.identifiedOn)}
              emptyLabel={overview.notSet}
            />
            {problem.createdAt ? (
              <DetailField
                icon={CalendarClock}
                label={fields.createdAt}
                value={formatTimestampDate(problem.createdAt)}
                emptyLabel={overview.notSet}
              />
            ) : null}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
