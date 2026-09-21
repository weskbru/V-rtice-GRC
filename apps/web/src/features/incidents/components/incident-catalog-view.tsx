'use client';

/**
 * PharosGRC — incident register screen (008-incidents-problems, US1),
 * joining the shared exploration frame (CLAUDE.md §18.12): `PageHeader` (in
 * `page.tsx`) → KPI strip → collapsible `FilterBar` → `ResultsToolbar` →
 * `CardGrid`/`DataTable` → `PaginationFooter`, the same composition
 * `AssetCatalogView`/`AuditEngagementCatalogView` already use. No quick-view
 * side panel — this register's own message catalog carries no
 * `quickView`-shaped strings, matching `AssetCatalogView`'s own precedent.
 *
 * Never fetches more than the current page, never sorts/filters/paginates
 * client-side (same discipline as every other register in this product).
 */
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

import { incidentsApi } from '../api';
import {
  REGISTER_PAGE_SIZE_OPTIONS,
  useIncidentRegisterState,
} from '../hooks/use-incident-register-state';

import { IncidentCardGrid } from './incident-card-grid';
import { buildIncidentRegisterColumns } from './incident-register-columns';
import { IncidentRegisterEmpty } from './incident-register-empty';
import { IncidentRegisterFilters } from './incident-register-filters';
import { IncidentRegisterSummary } from './incident-register-summary';

import type { IncidentRegisterView as CatalogViewMode } from '../hooks/use-incident-register-state';
import type { IncidentRegisterQuery, IncidentSummary } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

import { SortSelect } from '@/components/register/sort-select';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { incidents } from '@/lib/messages/incidents';

type SortField = NonNullable<IncidentRegisterQuery['sort']>;

const VIEW_OPTIONS = [
  {
    value: 'cards' as const,
    label: incidents.register.view.cards,
    icon: LayoutGrid,
    accessibleLabel: incidents.register.view.cardsLabel,
  },
  {
    value: 'table' as const,
    label: incidents.register.view.table,
    icon: Rows3,
    accessibleLabel: incidents.register.view.tableLabel,
  },
];

export function IncidentCatalogView(): React.JSX.Element {
  const {
    state,
    searchInputValue,
    setSearch,
    setStatus,
    setSeverity,
    setOrgUnitId,
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useIncidentRegisterState();

  const [rows, setRows] = useState<readonly IncidentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const statusKey = state.status.join(',');
  const severityKey = state.severity.join(',');

  const requestKey = [
    state.page,
    state.pageSize,
    state.search,
    state.sort,
    state.direction,
    statusKey,
    severityKey,
    state.orgUnitId ?? '',
    reloadToken,
  ].join('|');
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    incidentsApi
      .listRegister({
        page: state.page,
        pageSize: state.pageSize,
        search: state.search || undefined,
        status: state.status.length > 0 ? state.status : undefined,
        severity: state.severity.length > 0 ? state.severity : undefined,
        orgUnitId: state.orgUnitId,
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

  const columns = buildIncidentRegisterColumns();

  const sorting: SortingState = [{ id: state.sort, desc: state.direction === 'desc' }];

  function handleSortingChange(next: SortingState): void {
    const first = next[0];
    if (!first) {
      setSort('reportedOn', 'desc');
      return;
    }
    setSort(first.id as SortField, first.desc ? 'desc' : 'asc');
  }

  const emptyContent = (
    <IncidentRegisterEmpty hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
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
        labels={incidents.register.results}
        prefix={incidents.register.results.sortLabel}
        sort={state.sort}
        direction={state.direction}
        onSortChange={setSort}
        triggerClassName="w-[15rem]"
      />

      <ViewToggle
        label={incidents.register.view.groupLabel}
        options={VIEW_OPTIONS}
        value={state.view}
        onChange={(value: CatalogViewMode) => setView(value)}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <IncidentRegisterSummary />

      <IncidentRegisterFilters
        presentationControls={presentationControls}
        status={state.status}
        onStatusChange={setStatus}
        severity={state.severity}
        onSeverityChange={setSeverity}
        orgUnitId={state.orgUnitId}
        onOrgUnitIdChange={setOrgUnitId}
        searchValue={searchInputValue}
        onSearchChange={setSearch}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      <ResultsToolbar
        count={incidents.register.results.count(total)}
        isLoading={loading}
        loadingLabel={incidents.register.results.countLoading}
      >
        <PageSizeSelect
          pageSize={state.pageSize}
          pageSizeOptions={REGISTER_PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
          label={common.dataTable.rowsPerPageLabel}
        />
      </ResultsToolbar>

      {isCardView ? (
        <div className="flex flex-col gap-4">
          <IncidentCardGrid
            incidents={rows}
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
        <DataTable<IncidentSummary>
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
          caption={incidents.register.tableCaption}
        />
      )}
    </div>
  );
}
