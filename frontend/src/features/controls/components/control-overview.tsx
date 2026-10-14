'use client';

import {
  Building2,
  CalendarPlus,
  Cog,
  FileText,
  Repeat,
  ShieldCheck,
  Tag,
  User,
} from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { controls, controlEffectivenessHint } from '@/lib/messages/controls';
import { StatusBadge } from '@vertice/design-system/components';

import { formatTimestampDate } from '../date';
import {
  controlEffectivenessBadgeVariant,
  controlEffectivenessIcon,
  controlEffectivenessLabel,
} from '../status';

import type { ControlDetail } from '../types';

export interface ControlOverviewProps {
  control: ControlDetail;
}

export function ControlOverview({ control }: ControlOverviewProps): React.JSX.Element {
  const overview = controls.detail.overview;
  const fields = overview.fields;
  const hint = controlEffectivenessHint(control.effectiveness);

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
          <p className="whitespace-pre-wrap text-sm text-foreground">{control.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" />
            {overview.effectivenessCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <StatusBadge
            variant={controlEffectivenessBadgeVariant(control.effectiveness)}
            label={controlEffectivenessLabel(control.effectiveness)}
            icon={controlEffectivenessIcon(control.effectiveness)}
            className="self-start"
          />
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
          <dl className="border-t border-border pt-3">
            <DetailField
              icon={Repeat}
              label={fields.frequency}
              value={control.frequency ? controls.frequencyLabels[control.frequency] : null}
              emptyLabel={overview.frequencyNoExpiry}
            />
          </dl>
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
              label={fields.orgUnit}
              value={control.orgUnit ? control.orgUnit.name : null}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={User}
              label={fields.owner}
              value={control.owner ? control.owner.fullName : null}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={Cog}
              label={fields.nature}
              value={control.nature ? controls.natureLabels[control.nature] : null}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={Tag}
              label={fields.type}
              value={control.type ? controls.typeLabels[control.type] : null}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={fields.createdAt}
              value={formatTimestampDate(control.createdAt)}
              emptyLabel={overview.notSet}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
