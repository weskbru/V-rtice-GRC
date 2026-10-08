'use client';

import { StatusBadge } from '@pharos/design-system/components';
import { Box, Building2 } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import registerCardStyles from '@/components/register/register-card.module.css';
import { assets } from '@/lib/messages/assets';
import { cn } from '@/lib/utils';

import { formatTimestampDate } from '../date';
import { assetSituationLabel, assetSituationVariant } from '../situation';

import type { AssetSummary } from '../types';

export interface AssetCardProps {
  asset: AssetSummary;
}

export function AssetCard({ asset }: AssetCardProps): React.JSX.Element {
  const card = assets.register.card;

  return (
    <article
      data-tone={assetSituationVariant(asset.isActive)}
      className={cn(
        registerCardStyles.card,
        'relative flex h-full min-w-0 flex-col gap-3 rounded-lg border border-border p-4 text-card-foreground shadow-sm transition-colors',
        'hover:border-ring/60 has-[:focus-visible]:border-ring/60',
      )}
    >
      <Link
        href={`/assets/${asset.id}`}
        className="relative z-10 inline-flex items-center gap-2 self-start rounded-sm text-xs font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Box
          aria-hidden="true"
          className="size-4 shrink-0 text-[color:var(--register-card-accent)]"
        />
        {asset.code}
      </Link>

      <div className="flex flex-col gap-1">
        <Link
          href={`/assets/${asset.id}`}
          aria-label={card.selectLabel(asset.code, asset.name)}
          className="rounded-sm text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground">
            {asset.name}
          </span>
        </Link>

        {asset.descriptionExcerpt ? (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {asset.descriptionExcerpt}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          variant={assetSituationVariant(asset.isActive)}
          label={assetSituationLabel(asset.isActive)}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <dl className="flex min-w-0 flex-col gap-0.5 text-xs">
          <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <Building2 aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">{card.orgUnitLabel}</span>
          </dt>
          <dd className="truncate text-foreground">
            {asset.orgUnit?.name ?? assets.register.columns.notSet}
          </dd>
        </dl>

        <p className="text-xs text-muted-foreground">
          {card.updatedAt(formatTimestampDate(asset.updatedAt))}
        </p>
      </div>
    </article>
  );
}
