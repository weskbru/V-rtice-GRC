import { cn } from '../../lib/utils';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';

import { LoadMoreButton } from './load-more-button';

import type { ActivityHistoryProps } from './types';

/**
 * Platform-wide merged-activity timeline (T169, US7, FR-105). Renders a
 * chronological, attributed account of domain events — assessments,
 * decisions, transitions, approvals, ownership changes today; whatever a
 * future module's own history assembles tomorrow. Deliberately dumb: it
 * never sorts, paginates client-side, or invents a translation for a
 * `kindLabel` it was not given — the caller (today, `risk-history-section
 * .tsx`) owns the data and every word (D-10).
 *
 * ## Accessibility
 *
 * A real ordered list (`<ol role="list">` / `<li role="listitem">`), not a
 * stack of `<div>`s — a screen reader announces "list, N items" and lets a
 * user navigate entry by entry. The explicit `role="list"`/`role
 * ="listitem"` (redundant with the native semantics on their own) is
 * deliberate: Safari/VoiceOver drops the implicit list role once
 * `list-style: none` is applied (a well-documented cross-browser gotcha),
 * and this component sets exactly that to remove the browser's bullet
 * glyph — so the roles are restated explicitly rather than relying on
 * native semantics surviving the visual reset.
 *
 * An entry's kind is conveyed by its own visible text (`kindLabel`), never
 * by color or an icon alone. The recorded-instant vs. asserted-date
 * distinction (F-9, `docs/deferred-findings.md`) is rendered as two
 * separately labeled facts side by side (`recordedAtLabel`/
 * `assertedDateLabel`) whenever an entry carries both — never flattened
 * into one ambiguous "date".
 */
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

            {/* F-9's recorded-instant vs. asserted-date distinction: always
                two separately labeled facts, never one merged value — and
                never merely two differently-worded labels either. The
                asserted date additionally renders in a dashed-border chip
                (a THIRD, shape-based signal, alongside the wording and the
                date-only vs. date+time formatting the caller already
                applies) so a reader who skims past the labels still sees at
                a glance which of the two is a claim rather than a record. */}
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
