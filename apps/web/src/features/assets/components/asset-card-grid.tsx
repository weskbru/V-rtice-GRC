'use client';

/**
 * The grid frame — list semantics, responsive columns and the
 * loading/error/empty contract — is the shared `CardGrid`; what stays
 * here is which card to render and a skeleton shaped like it.
 *
 * PharosGRC — asset catalog card view, the grid of `AssetCard`s (T046,
 * CLAUDE.md §18.12 — mirrors `AuditEngagementCardGrid`).
 */
import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { AssetCard } from './asset-card';

import type { AssetSummary } from '../types';

import { Skeleton } from '@/components/ui/skeleton';
import { assets } from '@/lib/messages/assets';

export interface AssetCardGridProps {
  assets: readonly AssetSummary[];
  isLoading: boolean;
  emptyContent: React.ReactNode;
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

function AssetCardSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full" />
      </div>
      <Skeleton className="h-5 w-20" />
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function AssetCardGrid({
  assets: assetList,
  isLoading,
  emptyContent,
  error,
  errorAction,
}: AssetCardGridProps): React.JSX.Element {
  return (
    <CardGrid
      items={assetList}
      getItemKey={(asset) => asset.id}
      renderItem={(asset) => <AssetCard asset={asset} />}
      regionLabel={assets.register.card.regionLabel}
      isLoading={isLoading}
      loadingLabel={assets.register.results.countLoading}
      renderSkeleton={() => <AssetCardSkeleton />}
      emptyContent={emptyContent}
      error={error}
      errorAction={errorAction}
    />
  );
}
