'use client';

import { DataTable, ResultsToolbar, type SortingState } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { reports } from '@/lib/messages/reports';

import { reportsApi } from '../api';
import {
  REPORT_CATALOG_PAGE_SIZE_OPTIONS,
  useReportCatalogState,
} from '../hooks/use-report-catalog-state';

import { buildReportRegisterColumns } from './report-register-columns';
import { ReportRegisterEmpty } from './report-register-empty';
import { ReportRegisterFilters } from './report-register-filters';
import { ReportRegisterSummary } from './report-register-summary';
import { ReportRunDialog } from './report-run-dialog';

import type { ReportDefinition } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

const NO_SORTING: SortingState = [];

export function ReportCatalogView(): React.JSX.Element {
  const {
    state,
    setIsActive,
    setPage,
    setPageSize,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useReportCatalogState();

  const [rows, setRows] = useState<readonly ReportDefinition[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const [runTarget, setRunTarget] = useState<ReportDefinition | null>(null);

  const requestKey = [state.page, state.pageSize, state.isActive, reloadToken].join('|');
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    reportsApi
      .listDefinitions({ page: state.page, pageSize: state.pageSize, isActive: state.isActive })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva dos filtros listados.
  }, [requestKey]);

  useEffect(() => {
    if (!loading && state.page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, state.page, totalPages, setPage]);

  const columns = buildReportRegisterColumns({ onRun: setRunTarget });

  const emptyContent = (
    <ReportRegisterEmpty hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
  );
  const errorAction = (
    <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
      {common.actions.retry}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <ReportRegisterSummary />

      <ReportRegisterFilters
        isActive={state.isActive}
        onIsActiveChange={setIsActive}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      <ResultsToolbar
        count={reports.register.results.count(total)}
        isLoading={loading}
        loadingLabel={reports.register.results.countLoading}
      />

      <DataTable<ReportDefinition>
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        sorting={NO_SORTING}
        onSortingChange={() => undefined}
        pageIndex={state.page - 1}
        pageSize={state.pageSize}
        pageSizeOptions={REPORT_CATALOG_PAGE_SIZE_OPTIONS}
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
        caption={reports.register.tableCaption}
      />

      {runTarget ? (
        <ReportRunDialog
          report={runTarget}
          open={Boolean(runTarget)}
          onOpenChange={(open) => {
            if (!open) setRunTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
