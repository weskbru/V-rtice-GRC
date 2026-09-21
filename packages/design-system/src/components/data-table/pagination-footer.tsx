'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

import { PageSizeSelect } from './page-size-select';

import type { DataTableLabels } from './types';

export interface PaginationFooterProps {
  /** 0-based. */
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  pageSizeOptions?: readonly number[];
  /** Hide only when the caller renders the same page-size control above the results. */
  showPageSize?: boolean;
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  labels: DataTableLabels;
  className?: string;
}

type PageWindowItem = number | 'ellipsis';

/**
 * Windows a 1-based page range down to a small, fixed-size set of numbered
 * entries — the first page, the last page, the current page and one
 * neighbour on each side — with a non-interactive `'ellipsis'` marker
 * standing in for each collapsed run in between. Below the threshold where
 * everything already fits (`pageCount` small enough that first + last +
 * current + both neighbours + two ellipses would cover the whole range
 * anyway), every page number is returned as-is and no ellipsis is ever
 * inserted just to be inserted.
 */
function buildPageWindow(currentPage: number, pageCount: number): PageWindowItem[] {
  const siblingCount = 1;
  // first + ellipsis + (siblingCount neighbours + current + siblingCount neighbours) + ellipsis + last
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

/**
 * Pagination chrome shared by every `DataTable` caller and, starting with
 * the risk register's upcoming card view, by non-table presentations of the
 * same server-paginated results too. Extracted out of `DataTable` itself so
 * a second consumer of the exact same results-summary / rows-per-page /
 * page-navigation controls never has to duplicate them — this project has a
 * recorded, repeated defect class of a fix applied to one copy of something
 * and never propagated to its sibling.
 *
 * Numbered pages (`buildPageWindow`) replace the previous "Página X de Y"
 * span plus first/last chevrons: a nearby page is now one click away
 * instead of requiring a step-through, and page 1 / the last page are
 * always among the rendered buttons, so dedicated first/last controls
 * became redundant. The current page is marked with `aria-current="page"`
 * plus a filled background, heavier font weight AND a heavier border —
 * never colour alone (CLAUDE.md §18.8).
 *
 * The go-to-page input is kept — jumping straight to page 137 of 400 is a
 * real capability a numbered control alone can't offer — but it is no
 * longer a permanent field competing with the numbered pages for the same
 * attention. It now opens from the ellipsis, which is already the exact
 * marker for "there are pages in here you cannot reach with one click", and
 * therefore only exists when `buildPageWindow` actually collapsed something
 * (`pageCount > 7`). Opening it moves focus into the field; Escape closes it
 * and returns focus to the ellipsis, so the capability is reachable by
 * keyboard alone and never strands focus on a node that stopped existing.
 */
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

  // Focus follows the control that was just revealed — opening a field the
  // user then has to go looking for with the Tab key is not a shortcut.
  useEffect(() => {
    if (jumpOpen) {
      jumpInputRef.current?.focus();
    }
  }, [jumpOpen]);

  const pageWindow = buildPageWindow(currentPage, pageCount);
  // The window only ever produces an ellipsis when it collapsed pages, so
  // this is precisely "a click cannot reach every page from here".
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
              // Position is the ellipsis's identity — at most two ever render, and they never reorder.
              // The first one carries the jump control; a second would only
              // offer the same action under the same name twice.
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
