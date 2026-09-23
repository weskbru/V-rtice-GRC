import {
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Compass,
  FileText,
  FolderTree,
  Tag,
  User,
  UserCheck,
} from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { risks } from '@/lib/messages/risks';

import { formatDateOnly } from '../date';

import type { RiskDetail } from '../types';

export interface RiskOverviewProps {
  risk: RiskDetail;
}

function formatDate(value: string | null): string | null {
  return value ? formatDateOnly(value) : null;
}

export function RiskOverview({ risk }: RiskOverviewProps): React.JSX.Element {
  const fields = risks.overview.fields;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
            {risks.overview.descriptionCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-foreground">{risk.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{risks.overview.detailsCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField
              icon={FolderTree}
              label={fields.category}
              value={risk.category?.name ?? null}
              emptyLabel={risks.overview.notSet}
              muted
            />
            <DetailField
              icon={Tag}
              label={fields.type}
              value={risk.type?.name ?? null}
              emptyLabel={risks.overview.notSet}
              muted
            />
            <DetailField
              icon={Compass}
              label={fields.origin}
              value={risk.origin?.name ?? null}
              emptyLabel={risks.overview.notSet}
              muted
            />
            <DetailField
              icon={Building2}
              label={fields.orgUnit}
              value={risk.orgUnit.name}
              emptyLabel={risks.overview.notSet}
            />
            <DetailField
              icon={User}
              label={fields.owner}
              value={risk.owner.fullName}
              emptyLabel={risks.overview.notSet}
            />
            <DetailField
              icon={UserCheck}
              label={fields.responsible}
              value={risk.responsible?.fullName ?? null}
              emptyLabel={risks.overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={fields.identifiedOn}
              value={formatDate(risk.identifiedOn)}
              emptyLabel={risks.overview.notSet}
            />
            <DetailField
              icon={CalendarCheck}
              label={fields.lastAssessedOn}
              value={formatDate(risk.lastAssessedOn ?? null)}
              emptyLabel={risks.overview.notSet}
            />
            <DetailField
              icon={CalendarClock}
              label={fields.nextReviewOn}
              value={formatDate(risk.nextReviewOn ?? null)}
              emptyLabel={risks.overview.notSet}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
