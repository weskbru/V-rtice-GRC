'use client';

/**
 * PharosGRC — asset detail, "Visão geral" section, two cards
 * (022-asset-detail-experience Fase B — replaces the flat, card-less `<dl>`
 * this component used to be, mirroring `ProblemOverview`'s/`ControlOverview`'s
 * own identical correction on the sibling screens, CLAUDE.md §18.12).
 *
 * Two cards, not three: "Descrição" gets its own prominent card, and the
 * record's remaining classification facts sit together in "Detalhes do
 * ativo", each field anchored by a small semantic icon via the shared
 * `DetailField` (`@/components/detail/detail-field`). There is no third,
 * "central fact" card here the way Control's own "Efetividade" or Problem's
 * own "Causa raiz" earn one — `isActive` IS that central fact for an asset,
 * and it gets its OWN dedicated "Situação" card instead
 * (`AssetLifecycleActions`, composed by `asset-detail-view.tsx` right after
 * this component — see that file's own header comment for why it sits
 * SECOND, ahead of "Detalhes do ativo", mirroring Efetividade's placement
 * rather than a lifecycle card's usual "always last" position).
 *
 * `situação` is deliberately NOT repeated as a `DetailField` cell in
 * "Detalhes do ativo" — the same restraint `ControlOverview`'s own "Detalhes
 * do controle" already shows for `status` (present only in the header badge
 * and its own dedicated card, never a third copy in the classification
 * card).
 *
 * `description` is nullable (`AssetDetail.description`, `types.ts`) — an
 * honest empty sentence when absent, never a placeholder that reads like
 * real content, mirroring `ProblemOverview`'s own "Causa raiz" empty state.
 */
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
