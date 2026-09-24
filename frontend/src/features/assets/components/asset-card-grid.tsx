'use client';

import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { Skeleton } from '@/components/ui/skeleton';
import { assets } from '@/lib/messages/assets';

import { AssetCard } from './asset-card';

import type { AssetSummary } from '../types';

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
