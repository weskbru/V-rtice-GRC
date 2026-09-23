'use client';

import {
  DataTable,
  PageSizeSelect,
  PaginationFooter,
  ResultsToolbar,
  ViewToggle,
  type SortingState,
} from '@pharos/design-system/components';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SortSelect } from '@/components/register/sort-select';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { processes } from '@/lib/messages/processes';

import { processesApi } from '../api';
import {
  PROCESS_CATALOG_PAGE_SIZE_OPTIONS,
  useProcessCatalogState,
} from '../hooks/use-process-catalog-state';

import { ProcessCardGrid } from './process-card-grid';
import { buildProcessRegisterColumns } from './process-register-columns';
import { ProcessRegisterEmpty } from './process-register-empty';
import { ProcessRegisterFilters } from './process-register-filters';
import { ProcessRegisterSummary } from './process-register-summary';

import type { ProcessCatalogView as CatalogViewMode } from '../hooks/use-process-catalog-state';
import type { ProcessListSortField, ProcessSummary } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

const VIEW_OPTIONS = [
  {
    value: 'cards' as const,
    label: processes.register.view.cards,
    icon: LayoutGrid,
    accessibleLabel: processes.register.view.cardsLabel,
  },
  {
    value: 'table' as const,
    label: processes.register.view.table,
    icon: Rows3,
    accessibleLabel: processes.register.view.tableLabel,
  },
];

export function ProcessCatalogView(): React.JSX.Element {
  const {
    state,
    searchInputValue,
    setSearch,
    setOrgUnitId,
    setIsActive,
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useProcessCatalogState();

  const [rows, setRows] = useState<readonly ProcessSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const requestKey = [
    state.page,
    state.pageSize,
    state.q,
    state.sort,
    state.direction,
    state.orgUnitId ?? '',
    state.isActive === undefined ? '' : String(state.isActive),
    reloadToken,
  ].join('|');
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    processesApi
      .listCatalog({
        page: state.page,
        pageSize: state.pageSize,
        q: state.q || undefined,
        orgUnitId: state.orgUnitId ? [state.orgUnitId] : undefined,
        isActive: state.isActive,
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

  const columns = buildProcessRegisterColumns();

  const sorting: SortingState = [{ id: state.sort, desc: state.direction === 'desc' }];

  function handleSortingChange(next: SortingState): void {
    const first = next[0];
    if (!first) {
      setSort('code', 'asc');
      return;
    }
    setSort(first.id as ProcessListSortField, first.desc ? 'desc' : 'asc');
  }

  const emptyContent = (
    <ProcessRegisterEmpty hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
  );
  const errorAction = (
    <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
      {common.actions.retry}
    </Button>
  );

  const isCardView = state.view === 'cards';

  const presentationControls = (
    <>
      <SortSelect
        labels={processes.register.results}
        prefix={processes.register.results.sortLabel}
        sort={state.sort}
        direction={state.direction}
        onSortChange={setSort}
        triggerClassName="w-[15rem]"
      />

      <ViewToggle
        label={processes.register.view.groupLabel}
        options={VIEW_OPTIONS}
        value={state.view}
        onChange={(value: CatalogViewMode) => setView(value)}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <ProcessRegisterSummary />

      <ProcessRegisterFilters
        presentationControls={presentationControls}
        orgUnitId={state.orgUnitId}
        onOrgUnitIdChange={setOrgUnitId}
        isActive={state.isActive}
        onIsActiveChange={setIsActive}
        searchValue={searchInputValue}
        onSearchChange={setSearch}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      <ResultsToolbar
        count={processes.register.results.count(total)}
        isLoading={loading}
        loadingLabel={processes.register.results.countLoading}
      >
        <PageSizeSelect
          pageSize={state.pageSize}
          pageSizeOptions={PROCESS_CATALOG_PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
          label={common.dataTable.rowsPerPageLabel}
        />
      </ResultsToolbar>

      {isCardView ? (
        <div className="flex flex-col gap-4">
          <ProcessCardGrid
            processes={rows}
            isLoading={loading}
            emptyContent={emptyContent}
            error={error}
            errorAction={errorAction}
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
      ) : (
        <DataTable<ProcessSummary>
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
          labels={common.dataTable}
          layout="fixed"
          stickyFirstColumn
          isLoading={loading}
          error={error}
          errorAction={errorAction}
          emptyContent={emptyContent}
          caption={processes.register.tableCaption}
        />
      )}
    </div>
  );
}
