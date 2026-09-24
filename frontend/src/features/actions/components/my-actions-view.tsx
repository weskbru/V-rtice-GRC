'use client';

import {
  DataTable,
  PageSizeSelect,
  PaginationFooter,
  ResultsToolbar,
  ViewToggle,
} from '@pharos/design-system/components';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { actions } from '@/lib/messages/actions';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';

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
          onSortingChange={() => undefined}
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
