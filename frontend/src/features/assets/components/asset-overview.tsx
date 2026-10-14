'use client';

import { Building2, CalendarClock, CalendarPlus, FileText } from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { assets } from '@/lib/messages/assets';

import { formatTimestampDate } from '../date';

import type { AssetDetail } from '../types';

export interface AssetOverviewProps {
  asset: AssetDetail;
}

export function AssetOverview({ asset }: AssetOverviewProps): React.JSX.Element {
  const overview = assets.detail.overview;

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
          {asset.description ? (
            <p className="text-sm whitespace-pre-wrap text-foreground">{asset.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{overview.noDescription}</p>
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
              icon={Building2}
              label={overview.orgUnitLabel}
              value={asset.orgUnit ? asset.orgUnit.name : null}
              emptyLabel={assets.detail.metadata.noOrgUnit}
            />
            <DetailField
              icon={CalendarPlus}
              label={overview.createdAtLabel}
              value={formatTimestampDate(asset.createdAt)}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarClock}
              label={overview.updatedAtLabel}
              value={formatTimestampDate(asset.updatedAt)}
              emptyLabel={overview.notSet}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
