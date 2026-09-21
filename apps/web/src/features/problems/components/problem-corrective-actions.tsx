'use client';

/**
 * PharosGRC — problem detail, corrective actions section (008-incidents-
 * problems follow-up, 2026-09-11, data-model.md Invariants P2/P3).
 *
 * Before this component existed, `ProblemCloseDialog` gated closing a
 * problem on a completed corrective `Action` (`originType: 'PROBLEM'`) that
 * NOTHING in the product could create — the backend origin accessor
 * (`ProblemActionOriginAccessor`) and the `PROBLEM` value on
 * `ActionOriginType` were both live, but no screen ever called
 * `POST /actions` with them. This is that missing affordance.
 *
 * ## Shared `Action`, not a bespoke task table (CLAUDE.md §19.6)
 *
 * This calls `features/actions/api.ts`'s `actionsApi` directly —
 * `listActions`/`createAction`/`transitionAction` — the SAME capability
 * "Minhas ações" (`my-actions-view.tsx`) reads and writes, with
 * `originType: 'PROBLEM'`, `originId: problemId`. It does not restate
 * `Action`'s five-edge lifecycle table: `availableTransitions`
 * (`features/actions/status.ts`) and `ReopenActionDialog`
 * (`features/actions/components/reopen-action-dialog.tsx`) are reused
 * verbatim, exactly as `my-actions-columns.tsx` already uses them — a THIRD
 * independent restatement of that table is exactly the drift this project
 * has already paid for once (`lib/messages/actions.ts`'s own header on
 * `ActionOriginType`).
 *
 * This is a deliberate, one-time departure from "each business module
 * declares its own local echo of `/actions`" (`problems/api.ts`'s own
 * `hasCompletedCorrectiveAction` comment) — that convention exists to keep
 * business modules from depending on EACH OTHER's feature code (CLAUDE.md
 * §2/§4). `features/actions` is not a peer business module; it is the
 * shared GRC core capability (§17 item 8, §19.6), the same status this
 * module already grants `features/actions`' HTTP contract implicitly via
 * `hasCompletedCorrectiveAction`. Reusing its already-correct UI logic here
 * avoids a third hand-maintained copy of the reopen-reason invariant (A2)
 * and the legal-transition table.
 *
 * ## Creation is gated on BOTH permissions the server actually requires
 *
 * `POST /actions` requires `action:create` (checked by the shared
 * controller's own `@RequirePermission`) AND `problem:edit` (checked by
 * `ProblemActionOriginAccessor#resolveEditableOrigin`, since a corrective
 * action is created by whoever may act on the problem it arises from,
 * FR-031). Both are advisory-only client-side (`usePermissions`'s own
 * warning) — the button is hidden only when the attempt would definitely
 * 403, never a substitute for the server's own two checks.
 *
 * ## Overdue is always the server's answer
 *
 * Same discipline as `treatment-actions-table.tsx` (`features/risks`):
 * `action.overdue` is displayed exactly as returned, never recomputed
 * client-side from `dueOn`.
 */
import { FormField, StatusBadge } from '@pharos/design-system/components';
import { Loader2, MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { UserPicker } from '@/components/directory/user-picker';
import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { actionsApi } from '@/features/actions/api';
import { ReopenActionDialog } from '@/features/actions/components/reopen-action-dialog';
import {
  actionStatusBadgeVariant,
  actionStatusLabel,
  availableTransitions,
} from '@/features/actions/status';
import { ApiError } from '@/lib/api-client';
import { actions } from '@/lib/messages/actions';
import { common } from '@/lib/messages/common';
import { problems } from '@/lib/messages/problems';

import { problemsApi } from '../api';
import { formatDateOnly } from '../date';

import type { UserRef } from '../types';
import type { Action, ActionStatus } from '@/features/actions/types';

const PAGE_SIZE = 20;

export interface ProblemCorrectiveActionsProps {
  problemId: string;
  /** `problem:edit` AND `action:create` — see this file's own header. */
  canCreate: boolean;
  /** `action:edit` — gates whether the status-change menu renders at all. */
  canTransition: boolean;
}

export function ProblemCorrectiveActions({
  problemId,
  canCreate,
  canTransition,
}: ProblemCorrectiveActionsProps): React.JSX.Element {
  const copy = problems.correctiveActions;

  const [items, setItems] = useState<readonly Action[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const requestKey = `${problemId}|${reloadToken}`;
  const loading = resolvedKey !== requestKey;

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // S-10 — searched server-side now (`UserPicker`), never a preloaded
  // bounded list; this create form has no existing action to seed a label
  // from, so it starts unselected, exactly like the old `<Select>` did.
  const [responsible, setResponsible] = useState<UserRef | undefined>(undefined);
  const [dueOn, setDueOn] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    responsible?: string;
    dueOn?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [pendingReopen, setPendingReopen] = useState<Action | null>(null);

  useEffect(() => {
    let cancelled = false;
    actionsApi
      .listActions({ page: 1, pageSize: PAGE_SIZE, originType: 'PROBLEM', originId: problemId })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setPage(1);
        setTotalPages(Math.max(1, Math.ceil(result.total / PAGE_SIZE)));
        setLoadError(false);
        setResolvedKey(requestKey);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setResolvedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` already derives from `problemId`/`reloadToken`, mirroring `MyActionsView`'s identical, documented pattern.
  }, [requestKey]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await actionsApi.listActions({
        page: nextPage,
        pageSize: PAGE_SIZE,
        originType: 'PROBLEM',
        originId: problemId,
      });
      setItems((current) => [...current, ...result.items]);
      setPage(nextPage);
      setTotalPages(Math.max(1, Math.ceil(result.total / PAGE_SIZE)));
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function resetForm(): void {
    setTitle('');
    setDescription('');
    setResponsible(undefined);
    setDueOn('');
    setFieldErrors({});
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    setFormError(null);

    const nextFieldErrors: { title?: string; responsible?: string; dueOn?: string } = {};
    if (!title.trim()) {
      nextFieldErrors.title = copy.form.validation.titleRequired;
    }
    if (!responsible) {
      nextFieldErrors.responsible = copy.form.validation.responsibleRequired;
    }
    if (!dueOn) {
      nextFieldErrors.dueOn = copy.form.validation.dueOnRequired;
    }
    setFieldErrors(nextFieldErrors);
    if (nextFieldErrors.title || nextFieldErrors.responsible || nextFieldErrors.dueOn) {
      return;
    }

    void submitCreate();
  }

  async function submitCreate(): Promise<void> {
    setSubmitting(true);
    try {
      await actionsApi.createAction({
        originType: 'PROBLEM',
        originId: problemId,
        title: title.trim(),
        description: description.trim() ? description.trim() : undefined,
        responsibleUserId: responsible!.id,
        dueOn,
      });
      feedback.success(copy.form.submitSuccess);
      resetForm();
      setShowForm(false);
      setReloadToken((token) => token + 1);
    } catch {
      setFormError(copy.form.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  async function applyTransition(action: Action, to: ActionStatus): Promise<void> {
    setTransitionError(null);
    setTransitioningId(action.id);
    try {
      await actionsApi.transitionAction(action.id, { to });
      setReloadToken((token) => token + 1);
    } catch (error) {
      const detail = error instanceof ApiError ? error.problem.detail : undefined;
      setTransitionError(detail ?? copy.transitionError);
    } finally {
      setTransitioningId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.cardTitle}</CardTitle>
        <CardDescription>{copy.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {transitionError ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {transitionError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">{copy.loading}</p>
        ) : loadError && items.length === 0 ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {copy.loadError}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
        ) : (
          <>
            <Table>
              <TableCaption className="sr-only">{copy.cardTitle}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.columns.title}</TableHead>
                  <TableHead>{copy.columns.responsible}</TableHead>
                  <TableHead>{copy.columns.dueOn}</TableHead>
                  <TableHead>{copy.columns.status}</TableHead>
                  {canTransition ? (
                    <TableHead className="w-12">
                      <span className="sr-only">{copy.columns.rowActions}</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((action) => {
                  const options = availableTransitions(action.status);
                  return (
                    <TableRow
                      key={action.id}
                      className={action.overdue ? 'bg-status-danger-bg/40' : undefined}
                    >
                      <TableCell className="max-w-xs">
                        <div className="font-medium text-foreground">{action.title}</div>
                        {action.description ? (
                          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {action.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {action.responsible.fullName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateOnly(action.dueOn)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            variant={actionStatusBadgeVariant(action.status)}
                            label={actionStatusLabel(action.status)}
                          />
                          {action.overdue ? (
                            <StatusBadge
                              variant="danger"
                              label={actions.myActions.indicators.overdue}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      {canTransition ? (
                        <TableCell>
                          {options.length > 0 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={copy.columns.rowActions}
                                  disabled={transitioningId === action.id}
                                >
                                  {transitioningId === action.id ? (
                                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                                  ) : (
                                    <MoreHorizontal aria-hidden="true" className="size-4" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {options.map((option) => (
                                  <DropdownMenuItem
                                    key={option.to}
                                    onSelect={() => {
                                      if (option.requiresReason) {
                                        setPendingReopen(action);
                                      } else {
                                        void applyTransition(action, option.to);
                                      }
                                    }}
                                  >
                                    {option.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {page < totalPages ? (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : null}
                  {copy.loadMore}
                </Button>
              </div>
            ) : null}
          </>
        )}

        {canCreate ? (
          showForm ? (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-3 rounded-md border border-border p-4"
            >
              <p className="text-sm font-medium text-foreground">{copy.form.cardTitle}</p>

              {formError ? (
                <p role="alert" className="text-sm font-medium text-status-danger-fg">
                  {formError}
                </p>
              ) : null}

              <FormField
                id="problem-corrective-action-title"
                label={copy.form.fields.title.label}
                required
                error={fieldErrors.title}
              >
                {(field) => (
                  <Input
                    {...field}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={submitting}
                  />
                )}
              </FormField>

              <FormField
                id="problem-corrective-action-description"
                label={copy.form.fields.description.label}
                optionalIndicator={common.formField.optionalIndicator}
              >
                {(field) => (
                  <Textarea
                    {...field}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    disabled={submitting}
                  />
                )}
              </FormField>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  id="problem-corrective-action-responsible"
                  label={copy.form.fields.responsible.label}
                  required
                  error={fieldErrors.responsible}
                >
                  {() => (
                    <UserPicker
                      value={responsible}
                      onChange={setResponsible}
                      onSearch={(q) => problemsApi.searchUsers(q)}
                      disabled={submitting}
                      labels={{
                        placeholder: copy.form.fields.responsible.placeholder,
                        triggerAriaLabel: copy.form.fields.responsible.label,
                      }}
                    />
                  )}
                </FormField>

                <FormField
                  id="problem-corrective-action-due-on"
                  label={copy.form.fields.dueOn.label}
                  required
                  error={fieldErrors.dueOn}
                >
                  {(field) => (
                    <Input
                      {...field}
                      type="date"
                      value={dueOn}
                      onChange={(event) => setDueOn(event.target.value)}
                      disabled={submitting}
                    />
                  )}
                </FormField>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : null}
                  {submitting ? copy.form.actions.submitting : copy.form.actions.submit}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={submitting}
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                    setFormError(null);
                  }}
                >
                  {copy.form.actions.cancel}
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Plus aria-hidden="true" className="size-4" />
                {copy.addAction}
              </Button>
            </div>
          )
        ) : null}
      </CardContent>

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
    </Card>
  );
}
