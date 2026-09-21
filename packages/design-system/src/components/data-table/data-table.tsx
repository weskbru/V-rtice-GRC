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
  /** Column definitions. Set `enableSorting: false` on any field the server's `sort` enum does not accept — `DataTable` never invents client-side sorting for a column the API would reject. */
  columns: ColumnDef<TData, unknown>[];
  /** The current page's rows only — `DataTable` never paginates, filters or sorts client-side (server-side paging, ADR-009). */
  data: readonly TData[];
  /** Stable row identity, e.g. `(row) => row.id`. Defaults to row index when omitted. */
  getRowId?: (row: TData, index: number) => string;

  sorting: SortingState;
  onSortingChange: (next: SortingState) => void;

  /** 0-based current page index. */
  pageIndex: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  /** Page size may be presented by the surrounding results toolbar instead. */
  showPageSize?: boolean;
  /** Total row count across every page (`PageMeta.total`), for the results summary and last-page navigation — never the current page's row count. */
  totalRows: number;
  onPageIndexChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;

  columnVisibility?: VisibilityState;

  /** Chrome text — see `DataTableLabels`. */
  labels: DataTableLabels;

  /** Shows the loading skeleton in the table body while keeping headers (and their sort controls) interactive. */
  isLoading?: boolean;
  /** Renders `ErrorState` in the table body instead of rows. */
  error?: ErrorStateProblem;
  /** Caller-owned action for the error state, e.g. a "Tentar novamente" button. */
  errorAction?: ReactNode;
  /** Rendered in the table body instead of rows when `data` is empty and there is no error/loading — the caller decides between "no results for these filters" and "nothing here yet" (T113). */
  emptyContent?: ReactNode;

  /**
   * Column sizing strategy. `'auto'` (default) leaves column widths to the
   * browser's own content-based sizing — unchanged behavior for every
   * caller that predates this option. `'fixed'` renders an explicit
   * `<colgroup>` from each column's `size` (TanStack `ColumnDef.size`,
   * default 150 when unset) and sets `table-layout: fixed` — a dense
   * register whose identity column (title) needs deliberate room, rather
   * than being crowded into a five-line wrap by whichever neighboring
   * column happened to render the widest content, opts into this instead
   * (T110, wave 3). Opt-in so no existing caller's layout shifts silently.
   */
  layout?: 'auto' | 'fixed';
  /**
   * Keeps the first visible column pinned while the table scrolls
   * horizontally — the row's identity (e.g. a risk code) never scrolls out
   * of view even when later columns force a wide table into its own
   * horizontal scrollbar. Meaningful only with `layout: 'fixed'` (a stable
   * pixel offset requires a stable column width).
   */
  stickyFirstColumn?: boolean;

  /**
   * Omits the pagination footer (results summary, rows-per-page and page
   * controls). For a bounded list the caller fetches as ONE page and never
   * pages through — there, a rows-per-page selector and a single page
   * button are controls that do nothing when used. Opt-in; every paged
   * register keeps its footer.
   */
  hidePagination?: boolean;

  /** Visually hidden `<caption>` naming the table for assistive technology, e.g. "Registro de riscos". */
  caption?: string;
  className?: string;
}

/**
 * Detects an ES class component the same way TanStack Table's own
 * `flexRender` does internally (its `isClassComponent` is not part of the
 * package's public API, so this is a deliberate, narrow copy — not a
 * reimplementation of `flexRender` itself): a class extending
 * `React.Component`/`React.PureComponent` sets `.prototype.isReactComponent`
 * on ITS prototype, which shows up one level up via
 * `Object.getPrototypeOf(ClassRef).prototype`.
 */
function isClassComponent(candidate: unknown): boolean {
  if (typeof candidate !== 'function') return false;
  const proto = Object.getPrototypeOf(candidate) as { prototype?: unknown } | null;
  return Boolean(
    proto && (proto.prototype as { isReactComponent?: unknown } | undefined)?.isReactComponent,
  );
}

/**
 * Renders a TanStack `ColumnDef.cell`/`header` template. `flexRender` (from
 * `@tanstack/react-table`) mounts every function template as if it were a
 * component — `React.createElement(Comp, props)` — including a plain arrow
 * function passed inline, which is how virtually every column in this
 * codebase defines `cell`/`header`. Given a fresh function identity (a new
 * `buildXColumns(...)` array on every render of the caller, which is the
 * norm — this table intentionally never demands memoized `columns`, see the
 * component doc comment below), `createElement` treats it as an entirely
 * new component TYPE and remounts that cell's whole subtree, discarding
 * whichever DOM node currently held keyboard focus inside it (e.g. a row's
 * "⋮" menu trigger) — focus then falls back to `<body>` when a dialog opened
 * from that trigger later closes.
 *
 * A plain function template carries no internal state of its own to lose by
 * being called directly as a render function instead of mounted as a
 * component (no hooks — `react-hooks/rules-of-hooks` already forbids a hook
 * inside an anonymous `cell`/`header` function, since ESLint does not
 * recognize it as a component), so this calls it directly with the current
 * context whenever it is safe to (a plain function, not an ES class and not
 * a `memo`/`forwardRef` exotic component) and defers to the real
 * `flexRender` for every other case (a string, a class component, or an
 * already-memoized/forwardRef component — memoizing/wrapping a component is
 * itself the caller's own, deliberate opt-in to stable identity, so
 * mounting it as a component is both safe and correct there). This is never
 * a stale closure: every call reads `columnDef.cell`/`header` and the
 * current `context` fresh, exactly as `flexRender` itself does.
 */
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

/**
 * Tracks whether the horizontal scroll container has more content hidden to
 * its left/right, so `DataTable` can show a real, measured scroll affordance
 * (a fading edge shadow) instead of leaving a wide table's overflow entirely
 * silent (CLAUDE.md §18.11 — a user must never lose data to unannounced
 * clipping). Re-measures on scroll and on resize (a `ResizeObserver`, jsdom-
 * polyfilled as a no-op in `vitest.setup.ts`, so this is inert but harmless
 * under component tests that never produce real layout).
 */
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

/**
 * Platform-wide data table over TanStack Table 8, built for server-side
 * pagination and sorting (T108, ADR-009, SC-004: a page of results must
 * render in under 2 seconds against 50,000 records — the client never
 * fetches, sorts or filters more than one page's worth of rows). This is
 * the table vocabulary every GRC module's register/list screen reuses; the
 * risk register (`risk-register-columns.tsx`) is its first caller.
 *
 * - Sortable headers announce their state through BOTH `aria-sort` on the
 *   `<th>` and a screen-reader-only suffix on the button's accessible name
 *   (`DataTableLabels.sort`) — never through the chevron icon alone — and
 *   the actively-sorted header also carries a persistent background tint
 *   (not just the chevron direction), so it stays identifiable at a glance,
 *   not only on close inspection.
 * - Horizontal scroll is contained inside the table's own wrapper
 *   (`overflow-x-auto` on the direct table wrapper, matching
 *   `apps/web/src/components/ui/table.tsx`'s own pattern) so a wide table
 *   never makes the page body itself scroll sideways. A measured edge
 *   shadow (`useHorizontalScrollShadows`) shows when more columns are
 *   hidden off-screen, and `stickyFirstColumn` keeps the row's identity
 *   column in view regardless of scroll position.
 * - Every row is both mouse- and keyboard-discoverable: hovering tints the
 *   row, and focusing any interactive cell inside it (a link, a button)
 *   tints it more strongly still via `:focus-within` — keyboard focus is
 *   never the quieter of the two (CLAUDE.md §18.11) — on top of each
 *   interactive element's own focus ring, which is the actual WCAG 2.4.7
 *   indicator; the row tint is a locator, not a replacement for it.
 * - Loading/error/empty states replace only the body rows — the header row
 *   (and its sort controls) stays mounted and interactive throughout, so a
 *   user can re-sort while a page is still loading.
 * - `columns` is never required to be stable across renders — a caller may
 *   rebuild its `columns` array on every render, with plain inline
 *   `cell`/`header` functions. This table renders those directly as render
 *   functions (see `renderFlexCell`), NOT as mounted components, so
 *   `cell`/`header` must never call a hook directly — put a hook inside a
 *   properly named component the `cell` function renders instead (e.g.
 *   `RoleRowActions` in `role-admin-columns.tsx`); `react-hooks/rules-of-hooks`
 *   already enforces this for a plain (non-component-shaped) function.
 */
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

  /** First visible column's body cells get the sticky treatment — an opaque background so scrolled-under content never shows through, `group-hover`/`group-focus-within` so it still tracks the row's own interaction state instead of looking permanently "stuck". */
  function stickyBodyCellClass(columnIndex: number): string | undefined {
    if (!isStickyFirstColumn || columnIndex !== 0) return undefined;
    return 'sticky left-0 z-10 border-r border-border bg-card group-hover:bg-muted/60 group-focus-within:bg-accent';
  }

  /** Header cell background: the actively-sorted column gets a persistent tint (not just its chevron) so it stays identifiable at a glance; the sticky first column additionally needs an always-opaque background regardless of sort state, so scrolled-under header cells never show through it. */
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
        {/* Horizontal scroll is contained to this wrapper only — the page body never scrolls sideways.
            `tabIndex={0}` (plus `role`/`aria-label` when a `caption` is supplied) makes this
            container itself keyboard-reachable whenever its content is actually wider than the
            viewport — axe's `scrollable-region-focusable` (WCAG 2.1.1/2.1.3): a scrollable region
            with no focusable descendant and no tabindex of its own is unreachable by keyboard alone.
            This was a real, previously-undetected violation (found via T081,
            002-shared-grc-foundation): every existing caller's column content happened to fit or wrap
            within the viewport, so the container never actually needed to scroll — an unrelated
            column later carrying long, unwrapped text was what first forced real overflow and
            surfaced it. Never a caller-supplied string (D-10 — this package carries no user-facing
            text of its own): `aria-label` is set only when the caller already passed `caption`.
            Applied unconditionally rather than derived from `useHorizontalScrollShadows`' measured
            `canScrollLeft`/`canScrollRight`: that measurement lands in an effect after mount (and
            re-runs on resize), so gating focusability on it would make both the guarantee and the
            test that protects it race a `ResizeObserver` tick. The cost is one extra tab stop per
            table; the alternative is a keyboard trap-door that reappears intermittently. */}
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
                          // Keyboard focus gets its own unmistakable marker — a
                          // left accent bar on the row's leading cell, on top
                          // of the row-wide tint above — so it never reads as
                          // "the same as hover, only fainter" (CLAUDE.md
                          // §18.11: focus must be at least as visible as
                          // hover). An inset shadow, not a border, so it never
                          // shifts a fixed-width column by its own thickness.
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

        {/* Measured horizontal-overflow affordance — a fading edge shadow, never silent clipping. `aria-hidden`: purely decorative, the real content is reachable via the scroll container itself (a native, keyboard-scrollable element). */}
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
