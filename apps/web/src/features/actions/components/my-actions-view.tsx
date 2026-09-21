'use client';

/**
 * PharosGRC — "Planos de Ação" register screen (T056, US2, SC-002, FR-091,
 * R-009), brought into the shared register family (CLAUDE.md §18.12):
 * `useActionsRegisterState` (URL-persisted filters/page/view), the KPI strip
 * (`ActionRegisterSummary`), the collapsible `MyActionsFilters`,
 * `ResultsToolbar`, and then EITHER `ActionCardGrid` or `DataTable`
 * (`@pharos/design-system`) around one `GET /actions` call per state
 * change — mirroring `RiskRegisterView`'s own orchestration exactly. Never
 * fetches more than the current page, never sorts, filters or paginates
 * client-side.
 *
 * Two deliberate simplifications relative to `RiskRegisterView`, both
 * tracing back to `GET /actions`'s own contract (`ListActionsQuery`), not to
 * a smaller ambition for this screen: no `SortSelect` (the endpoint accepts
 * no `sort` parameter — every column stays `enableSorting: false`) and no
 * quick-view panel (mirrors `AuditEngagementCatalogView`'s identical
 * precedent — the code and the whole card already open `/actions/{id}`).
 *
 * `onlyMine` defaults to `true` — SC-002's own scenario ("um responsável vê
 * todo o trabalho atribuído a ele, de qualquer origem, numa única lista")
 * is this screen's whole reason to exist.
 *
 * Every transition offered client-side is advisory only (FR-042) — the
 * server re-validates the FULL legality table and every permission/scope
 * check independently on submit (`status.ts`'s own header).
 */
import {
  DataTable,
  PageSizeSelect,
  PaginationFooter,
  ResultsToolbar,
  ViewToggle,
} from '@pharos/design-system/components';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { actionsApi } from '../api';
import {
  ACTIONS_REGISTER_PAGE_SIZE_OPTIONS,
  useActionsRegisterState,
} from '../hooks/use-actions-register-state';
import { availableTransitions } from '../status';

import { ActionCardGrid } from './action-card-grid';
import { ActionRegisterSummary } from './action-register-summary';
import { buildMyActionsColumns } from './my-actions-columns';
import { MyActionsEmpty } from './my-actions-empty';
import { MyActionsFilters } from './my-actions-filters';
import { ReopenActionDialog } from './reopen-action-dialog';

import type { ActionsRegisterView } from '../hooks/use-actions-register-state';
import type { Action, ActionStatus } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { actions } from '@/lib/messages/actions';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';

const VIEW_OPTIONS = [
  {
    value: 'cards' as const,
    label: actions.myActions.view.cards,
    icon: LayoutGrid,
    accessibleLabel: actions.myActions.view.cardsLabel,
  },
  {
    value: 'table' as const,
    label: actions.myActions.view.table,
    icon: Rows3,
    accessibleLabel: actions.myActions.view.tableLabel,
  },
];

export function MyActionsView(): React.JSX.Element {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('action:edit');

  const {
    state,
    setStatus,
    setOriginType,
    setOverdue,
    setOnlyMine,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useActionsRegisterState();

  const [rows, setRows] = useState<readonly Action[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const [pendingReopen, setPendingReopen] = useState<Action | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const requestKey = [
    state.page,
    state.pageSize,
    state.status ?? '',
    state.originType ?? '',
    String(state.overdue),
    String(state.onlyMine),
    reloadToken,
  ].join('|');
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    actionsApi
      .listActions({
        page: state.page,
        pageSize: state.pageSize,
        status: state.status,
        originType: state.originType,
        overdue: state.overdue ? true : undefined,
        responsibleUserId: state.onlyMine ? user.id : undefined,
      })
      .then((result) => {
        if (cancelled) return;
        setRows(result.items);
        setTotal(result.total);
        setTotalPages(Math.max(1, Math.ceil(result.total / state.pageSize)));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from every one of these `state.*` fields above; see `RiskRegisterView`'s identical, documented pattern.
  }, [requestKey]);

  // Self-corrects a page position left stranded by a narrower result set —
  // the same pattern `RiskRegisterView` documents for the identical
  // situation, rather than rendering a permanently empty page.
  useEffect(() => {
    if (!loading && state.page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, state.page, totalPages, setPage]);

  async function applyTransition(action: Action, to: ActionStatus): Promise<void> {
    setTransitioningId(action.id);
    try {
      await actionsApi.transitionAction(action.id, { to });
      const option = availableTransitions(action.status).find((candidate) => candidate.to === to);
      feedback.success(actions.myActions.transitions.transitionSuccess(option?.label ?? to));
      setReloadToken((token) => token + 1);
    } catch (caught) {
      const detail = caught instanceof ApiError ? caught.problem.detail : undefined;
      feedback.error(detail ?? actions.myActions.transitions.transitionFailed);
    } finally {
      setTransitioningId(null);
    }
  }

  const columns = useMemo(
    () =>
      buildMyActionsColumns({
        canEdit,
        onTransition: (action, to) => void applyTransition(action, to),
        onReopenRequest: (action) => setPendingReopen(action),
      }),
    [canEdit],
  );

  const emptyContent = (
    <MyActionsEmpty hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
  );
  const errorAction = (
    <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
      {common.actions.retry}
    </Button>
  );

  const isCardView = state.view === 'cards';
  const presentationControls = (
    <ViewToggle
      label={actions.myActions.view.groupLabel}
      options={VIEW_OPTIONS}
      value={state.view}
      onChange={(value: ActionsRegisterView) => setView(value)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <ActionRegisterSummary />

      <MyActionsFilters
        presentationControls={presentationControls}
        status={state.status}
        onStatusChange={setStatus}
        originType={state.originType}
        onOriginTypeChange={setOriginType}
        onlyMine={state.onlyMine}
        onOnlyMineChange={setOnlyMine}
        onlyOverdue={state.overdue}
        onOnlyOverdueChange={setOverdue}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      {/* GET /actions has no `sort` parameter. Presentation stays beside the
          real filter controls above; this strip carries count + page size. */}
      <ResultsToolbar
        count={actions.myActions.results.count(total)}
        isLoading={loading}
        loadingLabel={actions.myActions.results.countLoading}
      >
        <PageSizeSelect
          pageSize={state.pageSize}
          pageSizeOptions={ACTIONS_REGISTER_PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
          label={common.dataTable.rowsPerPageLabel}
        />
      </ResultsToolbar>

      {isCardView ? (
        <div className="flex flex-col gap-4">
          <ActionCardGrid
            actions={rows}
            canEdit={canEdit}
            onTransition={(action, to) => void applyTransition(action, to)}
            onReopenRequest={(action) => setPendingReopen(action)}
            isLoading={loading || transitioningId !== null}
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
        <DataTable<Action>
          showPageSize={false}
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          sorting={[]}
          onSortingChange={() => {
            // No server-side sort exists on `GET /actions` — every column is
            // declared `enableSorting: false`, so this is never actually
            // invoked by a header click; required only because
            // `DataTableProps` always takes a controlled sorting pair.
          }}
          pageIndex={state.page - 1}
          pageSize={state.pageSize}
          totalRows={total}
          onPageIndexChange={(index) => setPage(index + 1)}
          onPageSizeChange={setPageSize}
          labels={common.dataTable}
          layout="fixed"
          isLoading={loading || transitioningId !== null}
          error={error}
          errorAction={errorAction}
          emptyContent={emptyContent}
          caption={actions.myActions.tableCaption}
        />
      )}

      <ReopenActionDialog
        action={pendingReopen}
        onOpenChange={(open) => {
          if (!open) setPendingReopen(null);
        }}
        onApplied={() => {
          setPendingReopen(null);
          setReloadToken((token) => token + 1);
        }}
      />
    </div>
  );
}
