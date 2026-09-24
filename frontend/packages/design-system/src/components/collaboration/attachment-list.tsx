'use client';

import { Download, Loader2, Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';

import { cn } from '../../lib/utils';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';
import { LoadMoreButton } from '../timeline/load-more-button';

import type { AttachmentListProps } from './types';

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
