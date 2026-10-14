'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

import { PageSizeSelect } from './page-size-select';

import type { DataTableLabels } from './types';

export interface PaginationFooterProps {
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  pageSizeOptions?: readonly number[];
  showPageSize?: boolean;
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  labels: DataTableLabels;
  className?: string;
}

type PageWindowItem = number | 'ellipsis';

function buildPageWindow(currentPage: number, pageCount: number): PageWindowItem[] {
  const siblingCount = 1;
  const totalPageNumbersWithoutCollapsing = siblingCount * 2 + 5;

  if (totalPageNumbersWithoutCollapsing >= pageCount) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, pageCount);
  const shouldShowLeftEllipsis = leftSiblingIndex > 2;
  const shouldShowRightEllipsis = rightSiblingIndex < pageCount - 2;

  if (!shouldShowLeftEllipsis && shouldShowRightEllipsis) {
    const leftItemCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftItemCount }, (_, index) => index + 1);
    return [...leftRange, 'ellipsis', pageCount];
  }

  if (shouldShowLeftEllipsis && !shouldShowRightEllipsis) {
    const rightItemCount = 3 + siblingCount * 2;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, index) => pageCount - rightItemCount + 1 + index,
    );
    return [1, 'ellipsis', ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSiblingIndex - leftSiblingIndex + 1 },
    (_, index) => leftSiblingIndex + index,
  );
  return [1, 'ellipsis', ...middleRange, 'ellipsis', pageCount];
}

export function PaginationFooter({
  pageIndex,
  pageSize,
  totalRows,
  pageSizeOptions = [25, 50, 100],
  showPageSize = true,
  onPageIndexChange,
  onPageSizeChange,
  labels,
  className,
}: PaginationFooterProps): React.JSX.Element {
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = pageIndex + 1;
  const goToPageInputId = useId();
  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpToggleRef = useRef<HTMLButtonElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);

  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(totalRows, (pageIndex + 1) * pageSize);

  function goToPage(nextIndex: number): void {
    onPageIndexChange(Math.min(Math.max(nextIndex, 0), pageCount - 1));
  }

  function closeJump(): void {
    setJumpOpen(false);
    jumpToggleRef.current?.focus();
  }

  useEffect(() => {
    if (jumpOpen) {
      jumpInputRef.current?.focus();
    }
  }, [jumpOpen]);

  const pageWindow = buildPageWindow(currentPage, pageCount);
  const hasCollapsedPages = pageWindow.includes('ellipsis');
  let renderedEllipsisCount = 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-sm text-muted-foreground" role="status">
        {labels.resultsSummary(from, to, totalRows)}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {showPageSize ? (
          <PageSizeSelect
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            onPageSizeChange={onPageSizeChange}
            label={labels.rowsPerPageLabel}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-label={labels.previousPageLabel}
            disabled={pageIndex === 0}
            onClick={() => goToPage(pageIndex - 1)}
            className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>

          {pageWindow.map((item, index) =>
            item === 'ellipsis' ? (
              renderedEllipsisCount++ === 0 ? (
                <button
                  key={`ellipsis-${index}`}
                  ref={jumpToggleRef}
                  type="button"
                  aria-expanded={jumpOpen}
                  aria-controls={goToPageInputId}
                  aria-label={labels.goToPageToggleLabel}
                  onClick={() => (jumpOpen ? closeJump() : setJumpOpen(true))}
                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  …
                </button>
              ) : (
                <span
                  key={`ellipsis-${index}`}
                  aria-hidden="true"
                  className="px-1.5 text-sm text-muted-foreground select-none"
                >
                  …
                </span>
              )
            ) : (
              <button
                key={item}
                type="button"
                aria-label={labels.pageNumberLabel(item)}
                aria-current={item === currentPage ? 'page' : undefined}
                onClick={() => goToPage(item - 1)}
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  item === currentPage
                    ? 'border-2 border-primary bg-primary font-semibold text-primary-foreground'
                    : 'border border-input bg-background text-foreground hover:bg-muted',
                )}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            aria-label={labels.nextPageLabel}
            disabled={pageIndex >= pageCount - 1}
            onClick={() => goToPage(pageIndex + 1)}
            className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>

        {hasCollapsedPages && jumpOpen ? (
          <label
            htmlFor={goToPageInputId}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            {labels.goToPageLabel}
            <input
              id={goToPageInputId}
              ref={jumpInputRef}
              type="number"
              min={1}
              max={pageCount}
              defaultValue={currentPage}
              key={pageIndex}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeJump();
                  return;
                }
                if (event.key !== 'Enter') return;
                const value = Number((event.target as HTMLInputElement).value);
                if (Number.isFinite(value) && value >= 1) {
                  goToPage(value - 1);
                }
              }}
              className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
