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
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';

import { auditEngagementsApi } from '../api';
import {
  ENGAGEMENT_CATALOG_PAGE_SIZE_OPTIONS,
  useEngagementCatalogState,
} from '../hooks/use-engagement-catalog-state';

import { AuditEngagementCardGrid } from './audit-engagement-card-grid';
import { buildEngagementRegisterColumns } from './audit-engagement-register-columns';
import { AuditEngagementRegisterEmpty } from './audit-engagement-register-empty';
import { AuditEngagementRegisterFilters } from './audit-engagement-register-filters';
import { AuditEngagementRegisterSummary } from './audit-engagement-register-summary';

import type { EngagementCatalogView as CatalogViewMode } from '../hooks/use-engagement-catalog-state';
import type { AuditEngagement, AuditEngagementListSortField } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

const VIEW_OPTIONS = [
  {
    value: 'cards' as const,
    label: auditEngagements.register.view.cards,
    icon: LayoutGrid,
    accessibleLabel: auditEngagements.register.view.cardsLabel,
  },
  {
    value: 'table' as const,
    label: auditEngagements.register.view.table,
    icon: Rows3,
    accessibleLabel: auditEngagements.register.view.tableLabel,
  },
];

export function AuditEngagementCatalogView(): React.JSX.Element {
  const {
    state,
    setStatus,
    setOrgUnitId,
    setLeadAuditorUserId,
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useEngagementCatalogState();

  const [rows, setRows] = useState<readonly AuditEngagement[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const requestKey = [
    state.page,
    state.pageSize,
    state.sort,
    state.direction,
    state.status ?? '',
    state.orgUnitId ?? '',
    state.leadAuditorUserId ?? '',
    reloadToken,
  ].join('|');
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    auditEngagementsApi
      .listEngagements({
        page: state.page,
        pageSize: state.pageSize,
        status: state.status,
        orgUnitId: state.orgUnitId,
        leadAuditorUserId: state.leadAuditorUserId,
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

  const columns = buildEngagementRegisterColumns();

  const sorting: SortingState = [{ id: state.sort, desc: state.direction === 'desc' }];

  function handleSortingChange(next: SortingState): void {
    const first = next[0];
    if (!first) {
      setSort('code', 'asc');
      return;
    }
    setSort(first.id as AuditEngagementListSortField, first.desc ? 'desc' : 'asc');
  }

  const emptyContent = (
    <AuditEngagementRegisterEmpty
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
    />
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
        labels={auditEngagements.register.results}
        prefix={auditEngagements.register.results.sortLabel}
        sort={state.sort}
        direction={state.direction}
        onSortChange={setSort}
        triggerClassName="w-[15rem]"
      />

      <ViewToggle
        className="[&_[role=radio][aria-checked=false]]:text-foreground"
        label={auditEngagements.register.view.groupLabel}
        options={VIEW_OPTIONS}
        value={state.view}
        onChange={(value: CatalogViewMode) => setView(value)}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <AuditEngagementRegisterSummary />

      <AuditEngagementRegisterFilters
        presentationControls={presentationControls}
        status={state.status}
        onStatusChange={setStatus}
        orgUnitId={state.orgUnitId}
        onOrgUnitIdChange={setOrgUnitId}
        leadAuditorUserId={state.leadAuditorUserId}
        onLeadAuditorUserIdChange={setLeadAuditorUserId}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        knownLeadAuditor={
          rows.find((row) => row.leadAuditor.id === state.leadAuditorUserId)?.leadAuditor
        }
      />

      <ResultsToolbar
        count={auditEngagements.register.results.count(total)}
        isLoading={loading}
        loadingLabel={auditEngagements.register.results.countLoading}
      >
        <PageSizeSelect
          pageSize={state.pageSize}
          pageSizeOptions={ENGAGEMENT_CATALOG_PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
          label={common.dataTable.rowsPerPageLabel}
        />
      </ResultsToolbar>

      {isCardView ? (
        <div className="flex flex-col gap-4">
          <AuditEngagementCardGrid
            engagements={rows}
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
        <DataTable<AuditEngagement>
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
          caption={auditEngagements.register.tableCaption}
        />
      )}
    </div>
  );
}
