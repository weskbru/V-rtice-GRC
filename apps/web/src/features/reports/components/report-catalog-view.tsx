'use client';

/**
 * PharosGRC — report register screen (009-indicators-reports, T061, US5), mirroring
 * `IncidentCatalogView`'s overall orchestration (CLAUDE.md §18.12): collapsible filter bar,
 * `ResultsToolbar`, table, shared pagination, a dialog for the one row action this register has
 * ("Executar" — no separate detail route exists, `ReportRunDialog`'s own header explains why).
 *
 * No Cards/Tabela toggle and no card grid here (unlike Risks/Controls/Assets/Processes/Audit): a
 * report definition is configuration someone maintains, not a record someone browses visually, so
 * forcing a card view here would be homogenisation rather than convergence — the table stays the
 * one view, deliberately.
 *
 * The summary strip (`ReportRegisterSummary`) DOES ship, unlike the earlier round that shipped
 * none: `dashboardApi.getSummary()`'s `breakdowns` (`features/dashboard/types.ts`) still has no
 * `reports` block, but the three figures it shows are real SERVER counts
 * (`reportsApi.listDefinitions({ pageSize: 1, ... })`'s own `meta.total`, two requests plus one
 * exact subtraction), not a client-side recount of the current page — see that component's own
 * header for the full reasoning and for what was considered and rejected.
 *
 * Never fetches more than the current page, never sorts/filters/paginates client-side (same
 * discipline as every other register in this product).
 */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from every one of these `state.*` fields above.
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

      {/* No children: this register has nothing to decide about HOW the matched rows are
          shown — no ordering (`listReportDefinitions` declares no `sort` parameter) and no
          Cards/Tabela toggle (this catalog's own header comment explains why cards do not
          apply here). The count is still worth its own row, exactly as every other converged
          register in this product. */}
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
        // This catalog's own page sizes (20/50/100), not `DataTable`'s
        // default (25/50/100): the hook's default page size is 20, which the
        // default list does not contain, so the page-size control rendered a
        // value that was not among its own options.
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
