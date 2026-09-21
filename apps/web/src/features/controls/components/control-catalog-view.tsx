'use client';

/**
 * PharosGRC — control catalog screen (T045), mirroring
 * `risk-register-view.tsx` (CLAUDE.md §18.12): the same
 * summary/filters/results-bar/cards-or-table/pagination/quick-view
 * orchestration, reused rather than reinvented for Controls.
 *
 * Never fetches more than the current page (SC-008 — the catalog must
 * render in under 2 seconds against 50,000 controls) and never sorts,
 * filters or paginates client-side.
 */
import {
  ColumnVisibilityMenu,
  DataTable,
  PageSizeSelect,
  PaginationFooter,
  ResultsToolbar,
  ViewToggle,
  type SortingState,
  type VisibilityState,
} from '@pharos/design-system/components';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { controlsApi } from '../api';
import { CATALOG_PAGE_SIZE_OPTIONS, useCatalogState } from '../hooks/use-catalog-state';

import { ControlCardGrid } from './control-card-grid';
import { ControlQuickView } from './control-quick-view';
import {
  CONTROL_REGISTER_HIDEABLE_COLUMNS,
  buildControlRegisterColumns,
} from './control-register-columns';
import { ControlRegisterEmpty } from './control-register-empty';
import { ControlRegisterFilters } from './control-register-filters';
import { ControlRegisterSummary } from './control-register-summary';

import type { ControlCatalogView as CatalogViewMode } from '../hooks/use-catalog-state';
import type {
  ControlEffectiveness,
  ControlFrequency,
  ControlNature,
  ControlRegisterSortField,
  ControlStatus,
  ControlSummary,
  ControlType,
} from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

import { SortSelect } from '@/components/register/sort-select';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { controls } from '@/lib/messages/controls';
import { cn } from '@/lib/utils';

const VIEW_OPTIONS = [
  {
    value: 'cards' as const,
    label: controls.register.view.cards,
    icon: LayoutGrid,
    accessibleLabel: controls.register.view.cardsLabel,
  },
  {
    value: 'table' as const,
    label: controls.register.view.table,
    icon: Rows3,
    accessibleLabel: controls.register.view.tableLabel,
  },
];

export function ControlCatalogView(): React.JSX.Element {
  const {
    state,
    searchInputValue,
    setSearch,
    setStatus,
    setEffectiveness,
    setNature,
    setType,
    setFrequency,
    setOrgUnitId,
    setOwnerUserId,
    setSort,
    setPage,
    setPageSize,
    setView,
    setSelectedControlId,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useCatalogState();

  const [rows, setRows] = useState<readonly ControlSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const statusKey = state.status.join(',');
  const effectivenessKey = state.effectiveness.join(',');
  const natureKey = state.nature.join(',');
  const typeKey = state.type.join(',');
  const frequencyKey = state.frequency.join(',');
  const orgUnitKey = state.orgUnitId.join(',');
  const ownerKey = state.ownerUserId.join(',');

  const requestKey = [
    state.page,
    state.pageSize,
    state.q,
    state.sort,
    state.direction,
    statusKey,
    effectivenessKey,
    natureKey,
    typeKey,
    frequencyKey,
    orgUnitKey,
    ownerKey,
    reloadToken,
  ].join('|');
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    controlsApi
      .listCatalog({
        page: state.page,
        pageSize: state.pageSize,
        q: state.q,
        status: state.status,
        effectiveness: state.effectiveness,
        nature: state.nature,
        type: state.type,
        frequency: state.frequency,
        orgUnitId: state.orgUnitId,
        ownerUserId: state.ownerUserId,
        sort: state.sort,
        direction: state.direction,
      })
      .then((page) => {
        if (cancelled) return;
        setRows(page.data);
        setTotal(page.meta.total);
        setTotalPages(Math.max(1, page.meta.totalPages));
        setError(undefined);
        setResolvedRequestKey(requestKey);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError) {
          setError({
            title: caught.problem.title,
            detail: caught.problem.detail,
            correlationId: caught.problem.correlationId,
          });
        } else {
          setError({});
        }
        setResolvedRequestKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from every one of these `state.*` fields above.
  }, [requestKey]);

  useEffect(() => {
    if (!loading && state.page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, state.page, totalPages, setPage]);

  const returnFocusControlIdRef = useRef<string | null>(null);

  function handleQuickViewClose(): void {
    returnFocusControlIdRef.current = state.selectedControlId;
    setSelectedControlId(null);
  }

  useEffect(() => {
    const controlId = returnFocusControlIdRef.current;
    if (!controlId || state.selectedControlId !== null) return;
    returnFocusControlIdRef.current = null;
    document
      .querySelector<HTMLElement>(`[data-control-card-select="${CSS.escape(controlId)}"]`)
      ?.focus();
  }, [state.selectedControlId]);

  const columns = useMemo(() => buildControlRegisterColumns(), []);

  const sorting: SortingState = [{ id: state.sort, desc: state.direction === 'desc' }];

  function handleSortingChange(next: SortingState): void {
    const first = next[0];
    if (!first) {
      setSort('code', 'asc');
      return;
    }
    setSort(first.id as ControlRegisterSortField, first.desc ? 'desc' : 'asc');
  }

  const emptyContent = (
    <ControlRegisterEmpty hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
  );
  const errorAction = (
    <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
      {common.actions.retry}
    </Button>
  );

  const isCardView = state.view === 'cards';
  const quickViewControlId = isCardView ? state.selectedControlId : null;
  const selectedControl = quickViewControlId
    ? (rows.find((row) => row.id === quickViewControlId) ?? null)
    : null;

  const presentationControls = (
    <>
      <SortSelect
        labels={controls.register.results}
        prefix={controls.register.results.sortLabel}
        sort={state.sort}
        direction={state.direction}
        onSortChange={setSort}
      />

      <ViewToggle
        label={controls.register.view.groupLabel}
        options={VIEW_OPTIONS}
        value={state.view}
        onChange={(value: CatalogViewMode) => setView(value)}
      />

      {!isCardView ? (
        <ColumnVisibilityMenu
          label={controls.register.filters.columnsMenuLabel}
          columns={CONTROL_REGISTER_HIDEABLE_COLUMNS}
          visibility={columnVisibility}
          onChange={setColumnVisibility}
        />
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <ControlRegisterSummary />

      <ControlRegisterFilters
        presentationControls={presentationControls}
        status={state.status}
        onStatusChange={(values) => setStatus(values as ControlStatus[])}
        effectiveness={state.effectiveness}
        onEffectivenessChange={(values) => setEffectiveness(values as ControlEffectiveness[])}
        nature={state.nature}
        onNatureChange={(values) => setNature(values as ControlNature[])}
        type={state.type}
        onTypeChange={(values) => setType(values as ControlType[])}
        frequency={state.frequency}
        onFrequencyChange={(values) => setFrequency(values as ControlFrequency[])}
        orgUnitId={state.orgUnitId}
        onOrgUnitIdChange={setOrgUnitId}
        ownerUserId={state.ownerUserId}
        onOwnerUserIdChange={setOwnerUserId}
        // S-10 — resolves an active owner filter chip's label with no
        // extra request when that owner also owns a currently loaded row
        // (the common case: usually why the filter matched anything).
        knownOwners={
          new Map(rows.flatMap((row) => (row.owner ? [[row.owner.id, row.owner] as const] : [])))
        }
        searchValue={searchInputValue}
        onSearchChange={setSearch}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      {/* One strip for every decision about HOW the matched controls are
          shown — ordering, cards or table, and (in the table) which
          columns. */}
      <ResultsToolbar
        count={controls.register.results.count(total)}
        isLoading={loading}
        loadingLabel={controls.register.results.countLoading}
      >
        <PageSizeSelect
          pageSize={state.pageSize}
          pageSizeOptions={CATALOG_PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
          label={common.dataTable.rowsPerPageLabel}
        />
      </ResultsToolbar>

      {isCardView ? (
        <div
          className={cn(
            'grid grid-cols-1 items-start gap-4',
            quickViewControlId && 'xl:grid-cols-[minmax(0,1fr)_22rem]',
          )}
        >
          <div className="flex min-w-0 flex-col gap-4">
            <ControlCardGrid
              controls={rows}
              selectedControlId={quickViewControlId}
              onSelect={setSelectedControlId}
              isLoading={loading}
              emptyContent={emptyContent}
              error={error}
              errorAction={errorAction}
              compact={Boolean(quickViewControlId)}
            />

            {!error && rows.length > 0 ? (
              <PaginationFooter
                showPageSize={false}
                pageIndex={state.page - 1}
                pageSize={state.pageSize}
                totalRows={total}
                onPageIndexChange={(index) => setPage(index + 1)}
                onPageSizeChange={setPageSize}
                labels={common.dataTable}
              />
            ) : null}
          </div>

          {quickViewControlId ? (
            <ControlQuickView
              key={quickViewControlId}
              controlId={quickViewControlId}
              summary={selectedControl}
              onClose={handleQuickViewClose}
              className="xl:sticky xl:top-4"
            />
          ) : null}
        </div>
      ) : (
        <DataTable<ControlSummary>
          showPageSize={false}
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          pageIndex={state.page - 1}
          pageSize={state.pageSize}
          totalRows={total}
          onPageIndexChange={(index) => setPage(index + 1)}
          onPageSizeChange={setPageSize}
          columnVisibility={columnVisibility}
          labels={common.dataTable}
          layout="fixed"
          stickyFirstColumn
          isLoading={loading}
          error={error}
          errorAction={errorAction}
          emptyContent={emptyContent}
          caption={controls.register.tableCaption}
        />
      )}
    </div>
  );
}
