'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/utils';
import { ErrorState, type ErrorStateProblem } from '../error-state';
import { LoadingState } from '../loading-state';

import { PaginationFooter } from './pagination-footer';

import type { DataTableLabels } from './types';
import type { ReactNode } from 'react';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: readonly TData[];
  getRowId?: (row: TData, index: number) => string;

  sorting: SortingState;
  onSortingChange: (next: SortingState) => void;

  pageIndex: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  showPageSize?: boolean;
  totalRows: number;
  onPageIndexChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;

  columnVisibility?: VisibilityState;

  labels: DataTableLabels;

  isLoading?: boolean;
  error?: ErrorStateProblem;
  errorAction?: ReactNode;
  emptyContent?: ReactNode;

  layout?: 'auto' | 'fixed';
  stickyFirstColumn?: boolean;

  hidePagination?: boolean;

  caption?: string;
  className?: string;
}

function isClassComponent(candidate: unknown): boolean {
  if (typeof candidate !== 'function') return false;
  const proto = Object.getPrototypeOf(candidate) as { prototype?: unknown } | null;
  return Boolean(
    proto && (proto.prototype as { isReactComponent?: unknown } | undefined)?.isReactComponent,
  );
}

function renderFlexCell<TProps>(template: unknown, props: TProps): ReactNode {
  if (!template) return null;
  if (typeof template === 'function' && !isClassComponent(template)) {
    return (template as (props: TProps) => ReactNode)(props);
  }
  return flexRender(template as Parameters<typeof flexRender>[0], props as never);
}

function sortIconFor(state: 'asc' | 'desc' | false): React.JSX.Element {
  if (state === 'asc') return <ChevronUp aria-hidden="true" className="size-3.5" />;
  if (state === 'desc') return <ChevronDown aria-hidden="true" className="size-3.5" />;
  return <ChevronsUpDown aria-hidden="true" className="size-3.5 text-muted-foreground" />;
}

function useHorizontalScrollShadows(ref: React.RefObject<HTMLDivElement | null>): {
  canScrollLeft: boolean;
  canScrollRight: boolean;
} {
  const [state, setState] = useState({ canScrollLeft: false, canScrollRight: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function measure(): void {
      if (!el) return;
      setState({
        canScrollLeft: el.scrollLeft > 1,
        canScrollRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    }

    measure();
    el.addEventListener('scroll', measure, { passive: true });

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', measure);
      resizeObserver?.disconnect();
    };
  }, [ref]);

  return state;
}

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  sorting,
  onSortingChange,
  pageIndex,
  pageSize,
  pageSizeOptions = [25, 50, 100],
  showPageSize = true,
  totalRows,
  onPageIndexChange,
  onPageSizeChange,
  columnVisibility,
  labels,
  isLoading = false,
  error,
  errorAction,
  emptyContent,
  layout = 'auto',
  stickyFirstColumn = false,
  hidePagination = false,
  caption,
  className,
}: DataTableProps<TData>): React.JSX.Element {
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const scrollRef = useRef<HTMLDivElement>(null);
  const { canScrollLeft, canScrollRight } = useHorizontalScrollShadows(scrollRef);
  const isFixedLayout = layout === 'fixed';
  const isStickyFirstColumn = isFixedLayout && stickyFirstColumn;

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    onSortingChange(next);
  };

  const table = useReactTable({
    data: data as TData[],
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
      ...(columnVisibility ? { columnVisibility } : {}),
    },
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    pageCount,
    onSortingChange: handleSortingChange,
    ...(getRowId ? { getRowId } : {}),
    getCoreRowModel: getCoreRowModel(),
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const visibleColumnCount = visibleColumns.length;
  const rows = table.getRowModel().rows;
  const showBodyPlaceholder = isLoading || Boolean(error) || (!isLoading && data.length === 0);

  function stickyBodyCellClass(columnIndex: number): string | undefined {
    if (!isStickyFirstColumn || columnIndex !== 0) return undefined;
    return 'sticky left-0 z-10 border-r border-border bg-card group-hover:bg-muted/60 group-focus-within:bg-accent';
  }

  function headerCellClass(columnIndex: number, isSorted: boolean): string | undefined {
    const sticky = isStickyFirstColumn && columnIndex === 0;
    if (sticky) {
      return cn('sticky left-0 z-10 border-r border-border', isSorted ? 'bg-accent' : 'bg-card');
    }
    return isSorted ? 'bg-accent/60' : undefined;
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative overflow-hidden rounded-lg border border-border bg-card">
        <div
          ref={scrollRef}
          className="relative w-full overflow-x-auto"
          tabIndex={0}
          {...(caption ? { role: 'region', 'aria-label': caption } : {})}
        >
          <table
            className={cn('caption-bottom text-sm', isFixedLayout ? 'table-fixed' : 'w-full')}
            style={isFixedLayout ? { width: table.getTotalSize(), minWidth: '100%' } : undefined}
          >
            {isFixedLayout ? (
              <colgroup>
                {visibleColumns.map((column) => (
                  <col key={column.id} style={{ width: column.getSize() }} />
                ))}
              </colgroup>
            ) : null}
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead className="[&_tr]:border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map((header, columnIndex) => {
                    const canSort = header.column.getCanSort();
                    const sortState = header.column.getIsSorted();
                    const isSorted = sortState !== false;
                    const ariaSort = !canSort
                      ? undefined
                      : sortState === 'asc'
                        ? 'ascending'
                        : sortState === 'desc'
                          ? 'descending'
                          : 'none';
                    const headerContent = header.isPlaceholder
                      ? null
                      : renderFlexCell(header.column.columnDef.header, header.getContext());

                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={ariaSort}
                        className={cn(
                          'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground',
                          headerCellClass(columnIndex, isSorted),
                        )}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className={isSorted ? 'font-semibold' : undefined}>
                              {headerContent}
                            </span>
                            {sortIconFor(sortState)}
                            <span className="sr-only">
                              {sortState === 'asc'
                                ? labels.sort.ascending
                                : sortState === 'desc'
                                  ? labels.sort.descending
                                  : labels.sort.none}
                            </span>
                          </button>
                        ) : (
                          headerContent
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {showBodyPlaceholder ? (
                <tr>
                  <td colSpan={visibleColumnCount} className="p-0">
                    {isLoading ? (
                      <div className="p-4">
                        <LoadingState
                          variant="table"
                          rows={Math.min(pageSize, 10)}
                          label={labels.loading}
                        />
                      </div>
                    ) : error ? (
                      <ErrorState
                        problem={error}
                        action={errorAction}
                        className="rounded-none border-0"
                      />
                    ) : (
                      <div className="p-2">{emptyContent}</div>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-b border-border transition-colors last:border-0 hover:bg-muted/60 focus-within:bg-accent"
                  >
                    {row.getVisibleCells().map((cell, columnIndex) => (
                      <td
                        key={cell.id}
                        className={cn(
                          'p-2 align-middle',
                          stickyBodyCellClass(columnIndex),
                          columnIndex === 0
                            ? 'group-focus-within:shadow-[inset_3px_0_0_0_var(--color-primary-on-surface)]'
                            : undefined,
                        )}
                      >
                        {renderFlexCell(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-6 rounded-l-lg bg-gradient-to-r from-foreground/10 to-transparent transition-opacity',
            canScrollLeft ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-lg bg-gradient-to-l from-foreground/10 to-transparent transition-opacity',
            canScrollRight ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>

      {hidePagination ? null : (
        <PaginationFooter
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={totalRows}
          pageSizeOptions={pageSizeOptions}
          showPageSize={showPageSize}
          onPageIndexChange={onPageIndexChange}
          onPageSizeChange={onPageSizeChange}
          labels={labels}
        />
      )}
    </div>
  );
}
