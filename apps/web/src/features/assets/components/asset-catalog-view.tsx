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
import { assets } from '@/lib/messages/assets';
import { common } from '@/lib/messages/common';

import { assetsApi } from '../api';
import {
  ASSET_CATALOG_PAGE_SIZE_OPTIONS,
  useAssetCatalogState,
} from '../hooks/use-asset-catalog-state';

import { AssetCardGrid } from './asset-card-grid';
import { buildAssetRegisterColumns } from './asset-register-columns';
import { AssetRegisterEmpty } from './asset-register-empty';
import { AssetRegisterFilters } from './asset-register-filters';
import { AssetRegisterSummary } from './asset-register-summary';

import type { AssetCatalogView as CatalogViewMode } from '../hooks/use-asset-catalog-state';
import type { AssetListSortField, AssetSummary } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

const VIEW_OPTIONS = [
  {
    value: 'cards' as const,
    label: assets.register.view.cards,
    icon: LayoutGrid,
    accessibleLabel: assets.register.view.cardsLabel,
  },
  {
    value: 'table' as const,
    label: assets.register.view.table,
    icon: Rows3,
    accessibleLabel: assets.register.view.tableLabel,
  },
];

export function AssetCatalogView(): React.JSX.Element {
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
  } = useAssetCatalogState();

  const [rows, setRows] = useState<readonly AssetSummary[]>([]);
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

    assetsApi
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

  const columns = buildAssetRegisterColumns();

  const sorting: SortingState = [{ id: state.sort, desc: state.direction === 'desc' }];

  function handleSortingChange(next: SortingState): void {
    const first = next[0];
    if (!first) {
      setSort('code', 'asc');
      return;
    }
    setSort(first.id as AssetListSortField, first.desc ? 'desc' : 'asc');
  }

  const emptyContent = (
    <AssetRegisterEmpty hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
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
        labels={assets.register.results}
        prefix={assets.register.results.sortLabel}
        sort={state.sort}
        direction={state.direction}
        onSortChange={setSort}
        triggerClassName="w-[15rem]"
      />

      <ViewToggle
        label={assets.register.view.groupLabel}
        options={VIEW_OPTIONS}
        value={state.view}
        onChange={(value: CatalogViewMode) => setView(value)}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <AssetRegisterSummary />

      <AssetRegisterFilters
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
        count={assets.register.results.count(total)}
        isLoading={loading}
        loadingLabel={assets.register.results.countLoading}
      >
        <PageSizeSelect
          pageSize={state.pageSize}
          pageSizeOptions={ASSET_CATALOG_PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
          label={common.dataTable.rowsPerPageLabel}
        />
      </ResultsToolbar>

      {isCardView ? (
        <div className="flex flex-col gap-4">
          <AssetCardGrid
            assets={rows}
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
        <DataTable<AssetSummary>
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
          caption={assets.register.tableCaption}
        />
      )}
    </div>
  );
}
