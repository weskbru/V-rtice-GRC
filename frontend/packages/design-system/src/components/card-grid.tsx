'use client';

import { cn } from '../lib/utils';

import { ErrorState, type ErrorStateProblem } from './error-state';

import type { ReactNode } from 'react';

export interface CardGridProps<TItem> {
  items: readonly TItem[];
  getItemKey: (item: TItem) => string;
  renderItem: (item: TItem) => ReactNode;
  regionLabel: string;
  emptyContent?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  renderSkeleton?: () => ReactNode;
  skeletonCount?: number;
  error?: ErrorStateProblem;
  errorAction?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function CardGrid<TItem>({
  items,
  getItemKey,
  renderItem,
  regionLabel,
  emptyContent,
  isLoading = false,
  loadingLabel,
  renderSkeleton,
  skeletonCount = 6,
  error,
  errorAction,
  compact = false,
  className,
}: CardGridProps<TItem>): React.JSX.Element {
  const columnsClass = compact
    ? 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3'
    : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

  if (error) {
    return <ErrorState problem={error} action={errorAction} />;
  }

  if (isLoading) {
    return (
      <div role="status" aria-busy="true" className={cn('grid gap-4', columnsClass, className)}>
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
        {renderSkeleton
          ? Array.from({ length: skeletonCount }, (_, index) => (
              <div key={index}>{renderSkeleton()}</div>
            ))
          : null}
      </div>
    );
  }

  if (items.length === 0) {
    return <>{emptyContent}</>;
  }

  return (
    <ul role="list" aria-label={regionLabel} className={cn('grid gap-4', columnsClass, className)}>
      {items.map((item) => (
        <li key={getItemKey(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}
