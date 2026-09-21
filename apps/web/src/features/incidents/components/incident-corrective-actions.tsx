'use client';

/**
 * PharosGRC — incident detail, corrective actions section (008-incidents-
 * problems follow-up, 2026-09-11).
 *
 * Mirrors `features/problems/components/problem-corrective-actions.tsx`
 * exactly — see that file's own header for the full reasoning this one does
 * not repeat: the shared `Action` capability (`features/actions/api.ts`),
 * not a bespoke task table (CLAUDE.md §19.6), with `originType: 'INCIDENT'`
 * in place of `'PROBLEM'`. `Incident` has no equivalent to Invariant P2 —
 * closing an incident never requires a completed `Action` — so this section
 * exists purely so incident work has the SAME corrective-action affordance
 * every other domain gets, not to satisfy a lifecycle precondition.
 *
 * Creation is gated on `incident:edit` AND `action:create` — the same two
 * checks `IncidentActionOriginAccessor#resolveEditableOrigin` and the
 * shared `POST /actions` controller's own `@RequirePermission` actually
 * enforce.
 *
 * ## C5 (018-incident-detail-experience, Fase 6) — same column-width
 * discipline as the relationship tables
 *
 * `responsible.fullName` carried `whitespace-nowrap` with no width cap —
 * the exact mechanism the coordinator's own volume measurement found
 * pushing a column off-screen in `incident-relationships-section.tsx`
 * (C5). Fixed here on the same reasoning, not on an independently measured
 * overflow of this specific table: a long display name is exactly as
 * unbounded here as it was there.
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
import { incidents } from '@/lib/messages/incidents';

import { incidentsApi } from '../api';
import { formatDateOnly } from '../date';

import type { UserRef } from '../types';
import type { Action, ActionStatus } from '@/features/actions/types';

const PAGE_SIZE = 20;

export interface IncidentCorrectiveActionsProps {
  incidentId: string;
  /** `incident:edit` AND `action:create` — see this file's own header. */
  canCreate: boolean;
  /** `action:edit` — gates whether the status-change menu renders at all. */
  canTransition: boolean;
}

export function IncidentCorrectiveActions({
  incidentId,
  canCreate,
  canTransition,
}: IncidentCorrectiveActionsProps): React.JSX.Element {
  const copy = incidents.correctiveActions;

  const [items, setItems] = useState<readonly Action[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const requestKey = `${incidentId}|${reloadToken}`;
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
      .listActions({ page: 1, pageSize: PAGE_SIZE, originType: 'INCIDENT', originId: incidentId })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` already derives from `incidentId`/`reloadToken`, mirroring `MyActionsView`'s identical, documented pattern.
  }, [requestKey]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await actionsApi.listActions({
        page: nextPage,
        pageSize: PAGE_SIZE,
        originType: 'INCIDENT',
        originId: incidentId,
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
        originType: 'INCIDENT',
        originId: incidentId,
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
            {/* `table-fixed` — see `incident-relationships-section.tsx`'s
                own C5 comment: `max-w-*` alone on a `<td>` is only a hint
                under `table-layout: auto`, which still grows a column to
                fit its longest unbroken content. Explicit percentage
                widths on `TableHead`, paired with `table-fixed`, make the
                table's own total width authoritative. */}
            <Table className="table-fixed">
              <TableCaption className="sr-only">{copy.cardTitle}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36%]">{copy.columns.title}</TableHead>
                  <TableHead className="w-[20%]">{copy.columns.responsible}</TableHead>
                  <TableHead className="w-[14%]">{copy.columns.dueOn}</TableHead>
                  <TableHead className="w-[20%]">{copy.columns.status}</TableHead>
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
                      <TableCell className="whitespace-normal break-words">
                        <div className="font-medium text-foreground">{action.title}</div>
                        {action.description ? (
                          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {action.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words">
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
                id="incident-corrective-action-title"
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
                id="incident-corrective-action-description"
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
                  id="incident-corrective-action-responsible"
                  label={copy.form.fields.responsible.label}
                  required
                  error={fieldErrors.responsible}
                >
                  {() => (
                    <UserPicker
                      value={responsible}
                      onChange={setResponsible}
                      onSearch={(q) => incidentsApi.searchUsers(q)}
                      disabled={submitting}
                      labels={{
                        placeholder: copy.form.fields.responsible.placeholder,
                        triggerAriaLabel: copy.form.fields.responsible.label,
                      }}
                    />
                  )}
                </FormField>

                <FormField
                  id="incident-corrective-action-due-on"
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
