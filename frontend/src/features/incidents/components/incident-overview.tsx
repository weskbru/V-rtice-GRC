import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarPlus,
  FileText,
  User,
  UserCheck,
} from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { incidents } from '@/lib/messages/incidents';
import { StatusBadge } from '@vertice/design-system/components';

import { formatDateOnly, formatTimestamp } from '../date';
import { incidentSeverityBadgeVariant, incidentSeverityLabel } from '../status';

import type { IncidentDetail } from '../types';

export interface IncidentOverviewProps {
  incident: IncidentDetail;
}

export function IncidentOverview({ incident }: IncidentOverviewProps): React.JSX.Element {
  const overview = incidents.overview;
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
          <p className="whitespace-pre-wrap text-sm text-foreground">{incident.description}</p>
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
                  variant={incidentSeverityBadgeVariant(incident.severity)}
                  label={incidentSeverityLabel(incident.severity)}
                />
              }
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={Building2}
              label={fields.orgUnit}
              value={incident.orgUnit.name}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={User}
              label={fields.owner}
              value={incident.owner.fullName}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={fields.reportedOn}
              value={formatDateOnly(incident.reportedOn)}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={UserCheck}
              label={fields.reportedBy}
              value={incident.reportedBy.fullName}
              emptyLabel={overview.notSet}
            />
            {incident.createdAt ? (
              <DetailField
                icon={CalendarClock}
                label={fields.createdAt}
                value={formatTimestamp(incident.createdAt)}
                emptyLabel={overview.notSet}
              />
            ) : null}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
