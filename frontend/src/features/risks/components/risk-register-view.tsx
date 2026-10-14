'use client';

import { LayoutGrid, Rows3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { SortSelect } from '@/components/register/sort-select';
import { ToolbarSelect } from '@/components/register/toolbar-select';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';
import {
  ColumnVisibilityMenu,
  DataTable,
  PageSizeSelect,
  PaginationFooter,
  ResultsToolbar,
  ViewToggle,
  type SortingState,
  type VisibilityState,
} from '@vertice/design-system/components';

import { risksApi } from '../api';
import { REGISTER_PAGE_SIZE_OPTIONS, useRegisterState } from '../hooks/use-register-state';

import { RiskCardGrid } from './risk-card-grid';
import { RISK_REGISTER_HIDEABLE_COLUMNS, buildRiskRegisterColumns } from './risk-register-columns';
import { RiskRegisterEmpty } from './risk-register-empty';
import { RiskRegisterFilters } from './risk-register-filters';
import { RiskRegisterSummary } from './risk-register-summary';

import type { RiskRegisterView } from '../hooks/use-register-state';
import type {
  RiskLevel,
  RiskLevelBasis,
  RiskRegisterSortField,
  RiskStatus,
  RiskSummary,
} from '../types';
import type { ErrorStateProblem } from '@vertice/design-system/components';

const VIEW_OPTIONS = [
  {
    value: 'cards' as const,
    label: risks.register.view.cards,
    icon: LayoutGrid,
    accessibleLabel: risks.register.view.cardsLabel,
  },
  {
    value: 'table' as const,
    label: risks.register.view.table,
    icon: Rows3,
    accessibleLabel: risks.register.view.tableLabel,
  },
];

export function RiskRegisterView(): React.JSX.Element {
  const {
    state,
    searchInputValue,
    setSearch,
    setStatus,
    setRiskLevel,
    setRiskLevelBasis,
    setCategoryId,
    setOrgUnitId,
    setOwnerUserId,
    setOverdueReview,
    setOverdueTreatment,
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useRegisterState();

  const [rows, setRows] = useState<readonly RiskSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const statusKey = state.status.join(',');
  const riskLevelKey = state.riskLevel.join(',');
  const categoryKey = state.categoryId.join(',');
  const orgUnitKey = state.orgUnitId.join(',');
  const ownerKey = state.ownerUserId.join(',');

  const requestKey = [
    state.page,
    state.pageSize,
    state.q,
    state.riskLevelBasis,
    String(state.overdueReview),
    String(state.overdueTreatment),
    state.sort,
    state.direction,
    statusKey,
    riskLevelKey,
    categoryKey,
    orgUnitKey,
    ownerKey,
    reloadToken,
  ].join('|');
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    risksApi
      .listRegister({
        page: state.page,
        pageSize: state.pageSize,
        q: state.q,
        status: state.status,
        riskLevel: state.riskLevel,
        riskLevelBasis: state.riskLevelBasis,
        categoryId: state.categoryId,
        orgUnitId: state.orgUnitId,
        ownerUserId: state.ownerUserId,
        overdueReview: state.overdueReview,
        overdueTreatment: state.overdueTreatment,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva dos filtros listados; repeti-los causaria nova busca.
  }, [requestKey]);

  useEffect(() => {
    if (!loading && state.page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, state.page, totalPages, setPage]);

  const columns = useMemo(
    () => buildRiskRegisterColumns({ riskLevelBasis: state.riskLevelBasis }),
    [state.riskLevelBasis],
  );

  const sorting: SortingState = [{ id: state.sort, desc: state.direction === 'desc' }];

  function handleSortingChange(next: SortingState): void {
    const first = next[0];
    if (!first) {
      setSort('code', 'asc');
      return;
    }
    setSort(first.id as RiskRegisterSortField, first.desc ? 'desc' : 'asc');
  }

  const emptyContent = (
    <RiskRegisterEmpty hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
  );
  const errorAction = (
    <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
      {common.actions.retry}
    </Button>
  );

  const isCardView = state.view === 'cards';

  const presentationControls = (
    <>
      <ToolbarSelect
        label={risks.register.filters.basisLabel}
        prefix={risks.register.filters.basisLabelShort}
        options={[
          { value: 'RESIDUAL', label: risks.register.filters.basisOptions.RESIDUAL },
          { value: 'INHERENT', label: risks.register.filters.basisOptions.INHERENT },
        ]}
        value={state.riskLevelBasis}
        onValueChange={(value) => setRiskLevelBasis(value as RiskLevelBasis)}
        triggerClassName="w-[7.5rem]"
      />

      <SortSelect
        labels={risks.register.results}
        prefix={risks.register.results.sortLabel}
        sort={state.sort}
        direction={state.direction}
        onSortChange={setSort}
      />

      <ViewToggle
        className="[&_[role=radio][aria-checked=false]]:text-foreground"
        label={risks.register.view.groupLabel}
        options={VIEW_OPTIONS}
        value={state.view}
        onChange={(value: RiskRegisterView) => setView(value)}
      />

      {!isCardView ? (
        <ColumnVisibilityMenu
          label={risks.register.filters.columnsMenuLabel}
          columns={RISK_REGISTER_HIDEABLE_COLUMNS}
          visibility={columnVisibility}
          onChange={setColumnVisibility}
        />
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <RiskRegisterSummary />

      <RiskRegisterFilters
        presentationControls={presentationControls}
        status={state.status}
        onStatusChange={(values) => setStatus(values as RiskStatus[])}
        riskLevel={state.riskLevel}
        onRiskLevelChange={(values) => setRiskLevel(values as RiskLevel[])}
        categoryId={state.categoryId}
        onCategoryIdChange={setCategoryId}
        orgUnitId={state.orgUnitId}
        onOrgUnitIdChange={setOrgUnitId}
        ownerUserId={state.ownerUserId}
        onOwnerUserIdChange={setOwnerUserId}
        knownOwners={new Map(rows.map((row) => [row.owner.id, row.owner] as const))}
        overdueReview={state.overdueReview}
        onOverdueReviewChange={setOverdueReview}
        overdueTreatment={state.overdueTreatment}
        onOverdueTreatmentChange={setOverdueTreatment}
        searchValue={searchInputValue}
        onSearchChange={setSearch}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      <ResultsToolbar
        count={risks.register.results.count(total)}
        isLoading={loading}
        loadingLabel={risks.register.results.countLoading}
      >
        <PageSizeSelect
          pageSize={state.pageSize}
          pageSizeOptions={REGISTER_PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
          label={common.dataTable.rowsPerPageLabel}
        />
      </ResultsToolbar>

      {isCardView ? (
        <div className="flex min-w-0 flex-col gap-4">
          <RiskCardGrid
            risks={rows}
            riskLevelBasis={state.riskLevelBasis}
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
        <DataTable<RiskSummary>
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
          caption={risks.register.tableCaption}
        />
      )}
    </div>
  );
}
