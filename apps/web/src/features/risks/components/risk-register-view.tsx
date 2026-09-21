'use client';

/**
 * PharosGRC — risk register / inventory screen (T110, US3, FR-086 to FR-092,
 * SC-003, SC-004).
 *
 * Orchestrates `useRegisterState` (T112, URL-persisted filters/search/sort/
 * page/view/selection), `RiskRegisterSummary`, `RiskRegisterFilters`
 * (T110/T109), `RiskRegisterResultsBar`, and then EITHER the card grid or
 * `DataTable` (`@pharos/design-system`, T108) around one `GET /risks` call
 * per state change. Never fetches more than the current page (ADR-009,
 * SC-004 — a page must render in under 2 seconds against 50,000 records) and
 * never sorts, filters or paginates client-side.
 *
 * `RiskRegisterEmpty` (T113) is shown from the request actually made, per
 * US3 AS7: `hasActiveFilters` reflects the query this screen *sent*, not a
 * guess from the response — so "no risk exists yet" and "no risk matches
 * these filters" are never confused with each other.
 *
 * ## Two views, one state
 *
 * Cards is the primary view (CLAUDE.md §18) and the table remains for dense
 * comparison of many records at once. The switch is a single URL parameter
 * (`view`), which is what makes "the change must not lose filters, search,
 * ordering, pagination or context" true by construction rather than by
 * careful re-application: nothing is copied into component state and
 * re-derived on toggle, so there is nothing that can fail to be carried
 * across. Both views also read and write the SAME sort state — the results
 * bar's ordering control and the table's sortable column headers are two
 * surfaces onto one value, never two values that have to be kept in step.
 *
 * Selecting a card (cards view) or a row's link (table view) navigates
 * straight to the full record at `/risks/{id}` — there is no intermediate
 * quick-view panel. The grid uses the full width available to it.
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
import { useEffect, useMemo, useState } from 'react';

import { SortSelect } from '@/components/register/sort-select';
import { ToolbarSelect } from '@/components/register/toolbar-select';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';

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
import type { ErrorStateProblem } from '@pharos/design-system/components';

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

  /**
   * One string identifying "the request the current state calls for" —
   * derived during render, not stored. `loading` below is then simply "the
   * last *resolved* request doesn't match this one" instead of a separate
   * `setLoading(true)` called synchronously at the top of the effect
   * (`react-hooks/set-state-in-effect`): every `setState` call this
   * component makes for fetched data happens inside the fetch's own
   * `.then()`/`.catch()` callback, which is exactly the pattern the rule
   * itself endorses ("calling setState in a callback function when
   * external state changes").
   *
   * `view` is deliberately ABSENT from this key: the results it presents are
   * the same results. Including it would refetch the whole page every time
   * the user toggled the presentation, which is precisely the "the change
   * must not lose context" failure this screen is supposed to avoid.
   */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from every one of these `state.*` fields above (see its own comment); listing the individual fields as well would refetch on the same change twice for no benefit.
  }, [requestKey]);

  // Self-corrects a page position left stranded by a narrower result set
  // (e.g. a shared link pointing at page 40 of a now-smaller filtered set)
  // rather than rendering a permanently empty page the user cannot escape.
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

      {/* Governs table columns and nothing else, so it is offered only
            beside the table — a control that changes nothing on screen is
            worse than an absent one. */}
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
        // S-10 — resolves an active owner filter chip's label with no
        // extra request when that owner also owns a currently loaded row
        // (the common case: usually why the filter matched anything).
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
        {/* Same `PageSizeSelect` `PaginationFooter` renders in its own footer
            (`showPageSize={false}` below keeps that copy from also showing) —
            not a second, independently-styled `<label><select>` (it used to
            be `h-9` here against the Design System's own `h-8`; risks-v2-
            post-gate correction 2). */}
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

          {/*
           * The same footer component `DataTable` renders for the table
           * view, given the same state — not a second pagination control
           * written for cards. Two implementations of one behaviour is the
           * recurring defect class this project has already recorded
           * (a fix applied in one place and never propagated to its
           * sibling); one component with two callers cannot drift.
           */}
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
