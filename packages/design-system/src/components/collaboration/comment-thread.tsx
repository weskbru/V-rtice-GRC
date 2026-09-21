'use client';

import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/utils';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';
import { LoadMoreButton } from '../timeline/load-more-button';

import type { CommentThreadProps } from './types';

/**
 * Platform-wide comment thread (T194, US9, FR-095, FR-098, FR-100, FR-102).
 * Renders an optional composer (only when `canComment`) followed by a
 * chronological, attributed list of comments — dumb by design: it never
 * fetches, paginates client-side, trims/validates the composer value beyond
 * "is there anything to submit", or invents copy the caller did not supply
 * (D-10). Today's one caller (`risk-comments-section.tsx`) owns the data,
 * the `/comments` request/response cycle and every word.
 *
 * ## A comment body is rendered as TEXT, never as markup
 *
 * `item.body` is interpolated as a plain JSX child (`{item.body}`), which
 * React always renders as an escaped text node — never through
 * `dangerouslySetInnerHTML`, and never through an HTML-parsing markdown
 * renderer. A comment is content typed by ANOTHER user and reflected back
 * to every other viewer of the same record; this is the stored-XSS defense
 * on the read side (the backend's `nosniff`/CSP headers protect the
 * attachment download path, not this one — a comment has no such
 * transport-level protection, so the rendering choice here is the entire
 * defense).
 *
 * ## Accessibility
 *
 * A real ordered list (`<ol role="list">` / `<li role="listitem">`),
 * restated explicitly for the same Safari/VoiceOver `list-style: none`
 * reason `ActivityHistory` documents.
 */
export function CommentThread({
  items,
  labels,
  isLoading = false,
  error,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  commentValue,
  onCommentValueChange,
  onSubmit,
  isSubmitting = false,
  canComment = false,
  onWithdraw,
  className,
}: CommentThreadProps): React.JSX.Element {
  const canSubmit = canComment && commentValue.trim().length > 0 && !isSubmitting;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {canComment ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit();
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="comment-thread-composer" className="text-sm font-medium text-foreground">
            {labels.composerLabel}
          </label>
          <textarea
            id="comment-thread-composer"
            value={commentValue}
            onChange={(event) => onCommentValueChange(event.target.value)}
            placeholder={labels.composerPlaceholder}
            disabled={isSubmitting}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                'inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
              )}
            >
              {isSubmitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {isSubmitting ? labels.submittingLabel : labels.submitLabel}
            </button>
          </div>
        </form>
      ) : null}

      {isLoading ? (
        <LoadingState variant="block" label={labels.loading} />
      ) : error ? (
        <ErrorState problem={error} />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ol role="list" aria-label={labels.caption} className="flex list-none flex-col gap-3 pl-0">
          {items.map((item) => (
            <li
              key={item.id}
              role="listitem"
              className="flex flex-col gap-1.5 rounded-md border border-border p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-foreground">{item.authorName}</span>
                  <span className="text-xs text-muted-foreground">{item.createdAtLabel}</span>
                </div>
                {item.canWithdraw && onWithdraw ? (
                  <button
                    type="button"
                    onClick={() => onWithdraw(item.id)}
                    className="text-xs font-medium text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {labels.withdrawLabel}
                  </button>
                ) : null}
              </div>

              {/* Plain text node — see this file's own doc comment on why a
                  comment body is never rendered as markup. */}
              <p className="whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      )}

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
