'use client';

/**
 * PharosGRC — audit engagement detail, overview tab (T076).
 *
 * Read-only presentation of the engagement's descriptive and lifecycle
 * facts — `ReadOnlyField` throughout (CLAUDE.md §18: "Read-only values
 * must not look editable"). Editing happens through `AuditEngagementForm`
 * in `mode="edit"`, swapped in by the detail view, never inline here — and
 * only while `status === 'PLANNING'` (research.md D-3/D-13). A `COMPLETED`
 * or `CANCELLED` engagement renders through this exact same component,
 * never a degraded or opaque view (FR-004) — every fact stays fully
 * legible regardless of status.
 */
import {
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  FileSearch,
  User,
} from 'lucide-react';

import { formatDateOnly, formatTimestampDate } from '../date';

import type { AuditEngagement } from '../types';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auditEngagements } from '@/lib/messages/audit-engagements';

export interface AuditEngagementOverviewProps {
  engagement: AuditEngagement;
}

export function AuditEngagementOverview({
  engagement,
}: AuditEngagementOverviewProps): React.JSX.Element {
  const overview = auditEngagements.detail.overview;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSearch aria-hidden="true" className="size-4 text-muted-foreground" />
            {overview.objectiveCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-foreground">{engagement.objective}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{overview.executionCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField
              icon={CalendarDays}
              label={overview.periodLabel}
              value={auditEngagements.register.card.periodLabel(
                formatDateOnly(engagement.periodStart),
                formatDateOnly(engagement.periodEnd),
              )}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={Building2}
              label={overview.orgUnitLabel}
              value={engagement.orgUnit.name}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={User}
              label={overview.leadAuditorLabel}
              value={engagement.leadAuditor.fullName}
              emptyLabel={overview.notSet}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{overview.registerCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <DetailField
              icon={CalendarPlus}
              label={overview.createdAtLabel}
              value={formatTimestampDate(engagement.createdAt)}
              emptyLabel={overview.notSet}
              muted
            />
            <DetailField
              icon={CalendarClock}
              label={overview.updatedAtLabel}
              value={formatTimestampDate(engagement.updatedAt)}
              emptyLabel={overview.notSet}
              muted
            />
          </dl>
          {engagement.status === 'CANCELLED' && engagement.cancellationJustification ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {overview.cancellationJustificationLabel}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {engagement.cancellationJustification}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
