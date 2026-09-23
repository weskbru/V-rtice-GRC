import { cn } from '../../lib/utils';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';

import { LoadMoreButton } from './load-more-button';

import type { ActivityHistoryProps } from './types';

export function ActivityHistory({
  items,
  labels,
  isLoading = false,
  error,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  className,
}: ActivityHistoryProps): React.JSX.Element {
  if (isLoading) {
    return <LoadingState variant="block" label={labels.loading} />;
  }

  if (error) {
    return <ErrorState problem={error} />;
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ol role="list" aria-label={labels.caption} className="flex list-none flex-col gap-4 pl-0">
        {items.map((entry) => (
          <li
            key={entry.id}
            role="listitem"
            className="flex flex-col gap-1.5 border-l-2 border-border py-0.5 pl-4"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold text-foreground">{entry.kindLabel}</span>
              <span className="text-sm text-muted-foreground">{entry.actorName}</span>
            </div>

            <dl className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <dt className="font-medium">{labels.recordedAtLabel}</dt>
                <dd>{entry.occurredAtLabel}</dd>
              </div>
              {entry.assertedDateLabel ? (
                <div className="flex items-center gap-1">
                  <dt className="font-medium">{labels.assertedDateLabel}</dt>
                  <dd>
                    <span className="rounded border border-dashed border-muted-foreground/50 px-1.5 py-0.5">
                      {entry.assertedDateLabel}
                    </span>
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className="text-sm text-foreground">{entry.summary}</p>

            {entry.previousValue != null && entry.newValue != null ? (
              <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                <div className="flex gap-1">
                  <dt className="font-medium text-muted-foreground">{labels.previousValueLabel}</dt>
                  <dd className="text-muted-foreground line-through decoration-muted-foreground/60">
                    {entry.previousValue}
                  </dd>
                </div>
                <div className="flex gap-1">
                  <dt className="font-medium text-muted-foreground">{labels.newValueLabel}</dt>
                  <dd className="font-semibold text-foreground">{entry.newValue}</dd>
                </div>
              </dl>
            ) : null}
          </li>
        ))}
      </ol>

      {hasMore ? (
        <LoadMoreButton
          label={labels.loadMoreLabel}
          loadingLabel={labels.loadingMoreLabel}
          isLoading={isLoadingMore}
          onClick={onLoadMore}
        />
      ) : null}
    </div>
  );
}
