'use client';

import { LayoutGrid, Rows3 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SortSelect } from '@/components/register/sort-select';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import {
  DataTable,
  PageSizeSelect,
  PaginationFooter,
  ResultsToolbar,
  ViewToggle,
  type SortingState,
} from '@vertice/design-system/components';

import { complianceApi } from '../api';
import {
  FRAMEWORK_LIST_PAGE_SIZE_OPTIONS,
  useFrameworkListState,
} from '../hooks/use-framework-list-state';

import { FrameworkCardGrid } from './framework-card-grid';
import { buildFrameworkRegisterColumns } from './framework-register-columns';
import { FrameworkRegisterEmpty } from './framework-register-empty';
import { FrameworkRegisterFilters } from './framework-register-filters';

import type { FrameworkListView as CatalogViewMode } from '../hooks/use-framework-list-state';
import type { Framework, FrameworkListSortField } from '../types';
import type { ErrorStateProblem } from '@vertice/design-system/components';

const VIEW_OPTIONS = [
  {
    value: 'cards' as const,
    label: compliance.register.view.cards,
    icon: LayoutGrid,
    accessibleLabel: compliance.register.view.cardsLabel,
  },
  {
    value: 'table' as const,
    label: compliance.register.view.table,
    icon: Rows3,
    accessibleLabel: compliance.register.view.tableLabel,
  },
];

export function FrameworkListView(): React.JSX.Element {
  const {
    state,
    searchInputValue,
    setSearch,
    setOrigin,
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useFrameworkListState();

  const [rows, setRows] = useState<readonly Framework[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const originKey = state.origin.join(',');
  const requestKey = [
    state.page,
    state.pageSize,
    state.q,
    state.sort,
    state.direction,
    originKey,
    reloadToken,
  ].join('|');
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    complianceApi
      .listFrameworks({
        page: state.page,
        pageSize: state.pageSize,
        q: state.q,
        origin: state.origin,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva das dependências listadas.
  }, [requestKey]);

  useEffect(() => {
    if (!loading && state.page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, state.page, totalPages, setPage]);

  const columns = buildFrameworkRegisterColumns();
  const sorting: SortingState = [{ id: state.sort, desc: state.direction === 'desc' }];

  function handleSortingChange(next: SortingState): void {
    const first = next[0];
    if (!first) {
      setSort('code', 'asc');
      return;
    }
    setSort(first.id as FrameworkListSortField, first.desc ? 'desc' : 'asc');
  }

  const emptyContent = (
    <FrameworkRegisterEmpty hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
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
        labels={compliance.register.results}
        prefix={compliance.register.results.sortLabel}
        sort={state.sort}
        direction={state.direction}
        onSortChange={setSort}
      />

      <ViewToggle
        className="[&_[role=radio][aria-checked=false]]:text-foreground"
        label={compliance.register.view.groupLabel}
        options={VIEW_OPTIONS}
        value={state.view}
        onChange={(value: CatalogViewMode) => setView(value)}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <FrameworkRegisterFilters
        presentationControls={presentationControls}
        origin={state.origin}
        onOriginChange={setOrigin}
        searchValue={searchInputValue}
        onSearchChange={setSearch}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      <ResultsToolbar
        count={compliance.register.results.count(total)}
        isLoading={loading}
        loadingLabel={compliance.register.results.countLoading}
      >
        <PageSizeSelect
          pageSize={state.pageSize}
          pageSizeOptions={FRAMEWORK_LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
          label={common.dataTable.rowsPerPageLabel}
        />
      </ResultsToolbar>

      {isCardView ? (
        <div className="flex flex-col gap-4">
          <FrameworkCardGrid
            frameworks={rows}
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
              pageSizeOptions={FRAMEWORK_LIST_PAGE_SIZE_OPTIONS}
              labels={common.dataTable}
            />
          ) : null}
        </div>
      ) : (
        <DataTable<Framework>
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
          pageSizeOptions={FRAMEWORK_LIST_PAGE_SIZE_OPTIONS}
          labels={common.dataTable}
          layout="fixed"
          stickyFirstColumn
          isLoading={loading}
          error={error}
          errorAction={errorAction}
          emptyContent={emptyContent}
          caption={compliance.register.tableCaption}
        />
      )}
    </div>
  );
}
