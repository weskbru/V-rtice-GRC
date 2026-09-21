'use client';

import { cn } from '../lib/utils';

import { ErrorState, type ErrorStateProblem } from './error-state';

import type { ReactNode } from 'react';

export interface CardGridProps<TItem> {
  /** The current page's records only — this grid never paginates, filters or sorts (server-side paging, ADR-009). */
  items: readonly TItem[];
  /** Stable key per record, e.g. `(risk) => risk.id`. */
  getItemKey: (item: TItem) => string;
  /** The module's own card. This component knows nothing about what a record is. */
  renderItem: (item: TItem) => ReactNode;
  /** Accessible name for the list, e.g. "Riscos" — so the list is announced as something, not as an unlabelled group of cards. */
  regionLabel: string;
  /** Shown instead of the grid when there are no records; the caller decides between "nothing here yet" and "nothing matches these filters" (T113). */
  emptyContent?: ReactNode;
  isLoading?: boolean;
  /** Screen-reader announcement while a page is loading. */
  loadingLabel?: string;
  /** One placeholder card, shaped like the module's real card so the grid does not visibly jump when records arrive. Repeated `skeletonCount` times. */
  renderSkeleton?: () => ReactNode;
  skeletonCount?: number;
  error?: ErrorStateProblem;
  errorAction?: ReactNode;
  /** Narrower layout for when something else (e.g. a quick-view panel) occupies part of the row. */
  compact?: boolean;
  className?: string;
}

/**
 * The card-view sibling of `DataTable`: the same loading / error / empty
 * contract and the same "one page of rows, nothing else" rule, rendering a
 * responsive grid of caller-supplied cards instead of a table body.
 *
 * Five registers had each written this frame themselves, down to the same
 * grid classes and the same `role="list"` workaround; the cards inside them
 * are genuinely different objects, but the frame never was. Keeping the
 * frame here and the card in the feature is the split that lets a risk card
 * stay a risk card while every register's grid, skeleton behaviour and empty
 * state stay identical.
 *
 * Rendered as a real `<ul>`/`<li>` with an explicit `role="list"`, because
 * `list-style: none` (implied by the grid layout) strips list semantics in
 * Safari/VoiceOver otherwise.
 */
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
  /*
   * `compact` drops to two columns at `xl` because a side panel has taken
   * the third — but only until `2xl`, where there is room for three cards
   * AND the panel. Density is the point of a card view; giving a wide
   * monitor two columns because a 22rem panel is open would waste exactly
   * the space the panel was supposed to fit beside.
   */
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
