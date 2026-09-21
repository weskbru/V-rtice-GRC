'use client';

import { Download, Loader2, Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';

import { cn } from '../../lib/utils';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';
import { LoadMoreButton } from '../timeline/load-more-button';

import type { AttachmentListProps } from './types';

/**
 * Platform-wide attachment list (T194, US9, FR-096 to FR-100, FR-102).
 * Renders an optional upload control (only when `canUpload`) — with the
 * allow-listed types/size limit stated BEFORE any file is chosen
 * (`labels.allowedTypesHint`, US9 AS3) — followed by a list of already
 * uploaded files. Dumb by design, exactly like `CommentThread`: this
 * package never validates a file beyond the browser's native `accept`
 * hint, never uploads it itself (`onUpload` hands the raw `File` to the
 * caller), and never fabricates a refusal reason — `labels.uploadError` is
 * the server's own `422`/`413` `detail`, already pt-BR, rendered verbatim
 * (D-10).
 *
 * ## Download is a plain navigation, never a fetched blob
 *
 * `item.contentUrl` is the authorizing `/attachments/{id}/content` path
 * (ADR-010) — rendered as a real `<a href>` so the browser's own
 * credentialed, same-origin navigation re-authorizes the request exactly
 * like every other same-origin link in this app (ADR-014). This component
 * never fetches the bytes itself, never constructs an object URL, and
 * never renders the response inline — the backend's own
 * `Content-Disposition: attachment` plus `X-Content-Type-Options: nosniff`
 * and `Content-Security-Policy: default-src 'none'` headers are what
 * guarantee the browser always downloads rather than executes it (FR-099);
 * this component's only job is to not get in the way of that by, say,
 * loading the content into an `<img>`/`<iframe>` instead.
 *
 * ## Accessibility
 *
 * Same `<ol role="list">` / `<li role="listitem">` convention as
 * `ActivityHistory`/`CommentThread`.
 */
export function AttachmentList({
  items,
  labels,
  isLoading = false,
  error,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  canUpload = false,
  onUpload,
  isUploading = false,
  acceptAttribute,
  onWithdraw,
  className,
}: AttachmentListProps): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleUploadClick(): void {
    if (!selectedFile || !onUpload) return;
    onUpload(selectedFile);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {canUpload ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-input p-3">
          {/* States the allow-list and size limit BEFORE any file is chosen
              (US9 AS3) — never only after a server refusal. */}
          <p className="text-xs text-muted-foreground">{labels.allowedTypesHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="attachment-list-file-input">
              {labels.chooseFileLabel}
            </label>
            <input
              ref={fileInputRef}
              id="attachment-list-file-input"
              type="file"
              accept={acceptAttribute}
              disabled={isUploading}
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              disabled={!selectedFile || isUploading}
              onClick={handleUploadClick}
              className={cn(
                'inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
              )}
            >
              {isUploading ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Paperclip aria-hidden="true" className="size-4" />
              )}
              {isUploading ? labels.uploadingLabel : labels.uploadLabel}
            </button>
          </div>
          {/* The server's own refusal reason — never a generic failure message (US9 AS3). */}
          {labels.uploadError ? (
            <p role="alert" className="text-sm font-medium text-status-danger-fg">
              {labels.uploadError}
            </p>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState variant="block" label={labels.loading} />
      ) : error ? (
        <ErrorState problem={error} />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ol role="list" aria-label={labels.caption} className="flex list-none flex-col gap-2 pl-0">
          {items.map((item) => (
            <li
              key={item.id}
              role="listitem"
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
            >
              <div className="flex flex-col gap-0.5">
                <a
                  href={item.contentUrl}
                  className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary-on-surface hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Download aria-hidden="true" className="size-4" />
                  {item.fileName}
                  <span className="sr-only">{labels.downloadLabel}</span>
                </a>
                <span className="text-xs text-muted-foreground">
                  {item.uploadedByName} · {item.uploadedAtLabel} · {item.sizeLabel} ·{' '}
                  <code>{item.contentType}</code>
                </span>
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
