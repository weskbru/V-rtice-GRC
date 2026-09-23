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
import { problems } from '@/lib/messages/problems';

import { problemsApi } from '../api';
import {
  REGISTER_PAGE_SIZE_OPTIONS,
  useProblemRegisterState,
} from '../hooks/use-problem-register-state';

import { ProblemCardGrid } from './problem-card-grid';
import { buildProblemRegisterColumns } from './problem-register-columns';
import { ProblemRegisterEmpty } from './problem-register-empty';
import { ProblemRegisterFilters } from './problem-register-filters';
import { ProblemRegisterSummary } from './problem-register-summary';

import type { ProblemRegisterView } from '../hooks/use-problem-register-state';
import type { ProblemSortField } from '../hooks/use-problem-register-state';
import type { ProblemSummary } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

const VIEW_OPTIONS = [
  {
    value: 'cards' as const,
    label: problems.register.view.cards,
    icon: LayoutGrid,
    accessibleLabel: problems.register.view.cardsLabel,
  },
  {
    value: 'table' as const,
    label: problems.register.view.table,
    icon: Rows3,
    accessibleLabel: problems.register.view.tableLabel,
  },
];

export function ProblemCatalogView(): React.JSX.Element {
  const {
    state,
    searchInputValue,
    setSearch,
    setStatus,
    setSeverity,
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useProblemRegisterState();

  const [rows, setRows] = useState<readonly ProblemSummary[]>([]);
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
    reloadToken,
  ].join('|');
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    problemsApi
      .listRegister({
        page: state.page,
        pageSize: state.pageSize,
        search: state.search || undefined,
        status: state.status.length > 0 ? state.status : undefined,
        severity: state.severity.length > 0 ? state.severity : undefined,
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

  const columns = buildProblemRegisterColumns();
  const sorting: SortingState = [{ id: state.sort, desc: state.direction === 'desc' }];

  function handleSortingChange(next: SortingState): void {
    const first = next[0];
    if (!first) {
      setSort('identifiedOn', 'desc');
      return;
    }
    setSort(first.id as ProblemSortField, first.desc ? 'desc' : 'asc');
  }

  const emptyContent = (
    <ProblemRegisterEmpty hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
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
        labels={problems.register.results}
        prefix={problems.register.results.sortLabel}
        sort={state.sort}
        direction={state.direction}
        onSortChange={setSort}
        triggerClassName="w-[15rem]"
      />

      <ViewToggle
        label={problems.register.view.groupLabel}
        options={VIEW_OPTIONS}
        value={state.view}
        onChange={(value: ProblemRegisterView) => setView(value)}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <ProblemRegisterSummary />

      <ProblemRegisterFilters
        presentationControls={presentationControls}
        status={state.status}
        onStatusChange={setStatus}
        severity={state.severity}
        onSeverityChange={setSeverity}
        searchValue={searchInputValue}
        onSearchChange={setSearch}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      <ResultsToolbar
        count={problems.register.results.count(total)}
        isLoading={loading}
        loadingLabel={problems.register.results.countLoading}
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
          <ProblemCardGrid
            problems={rows}
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
        <DataTable<ProblemSummary>
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
          caption={problems.register.tableCaption}
        />
      )}
    </div>
  );
}
