'use client';

/**
 * PharosGRC — risk detail, "Planos de Ação" tab content (T145, US5, FR-074,
 * FR-074a, FR-074b, FR-075, ADR-015; lifecycle/edit/summary added in the
 * follow-up that gave the risk module a real Action-Plan surface).
 *
 * ## Where this table lives, and why it moved
 *
 * This used to render inside the "Tratamento" tab, alongside
 * `RiskTreatmentSection`. It now renders under "Planos de Ação"
 * (`risk-detail-view.tsx`) — the tab that used to show a bare "not yet
 * available" placeholder while THIS table, one tab over, was already doing
 * the real work. Two tables of the same rows in neighboring tabs would have
 * been the exact duplication CLAUDE.md §18.12/§19.6 exist to prevent; moving
 * this one File, rather than writing a second one, avoids it. "Tratamento"
 * keeps `RiskTreatmentSection` (the treatment DECISION) and now shows a
 * short pointer (`risks.treatment.actionsMovedNotice`) to where its actions
 * live, so a caller who remembers this table here never reads its absence
 * as data loss.
 *
 * ## Every operation goes through the RISK's own routes — ALL FOUR of them
 *
 * Lists, creates, edits AND transitions a treatment action all go through
 * the RISK's own routes (`GET`/`POST /risks/{riskId}/treatment-actions`,
 * `PATCH .../treatment-actions/{actionId}`) — never the generic `POST
 * /actions` `IncidentCorrectiveActions`/`ProblemCorrectiveActions` use, and
 * never the shared `POST /actions/{actionId}/transitions` either. A first
 * pass of this table DID route the lifecycle transition through that shared
 * endpoint — wrong: it requires `action:edit`, not `risk:treat`, which would
 * have made this whole tab's single `risk:treat` gate a lie the moment a
 * caller held one permission but not the other. `PATCH .../treatment-
 * actions/{actionId}` (`UpdateRiskTreatmentActionRequestDto`) already
 * accepts `status`/`reopenReason` for exactly this — the OLD `<Select>` this
 * table used to render already sent status changes this same way, before
 * this table grew the legal-transitions menu.
 *
 * This is NOT a parallel lifecycle path: `UpdateTreatmentActionUseCase`
 * delegates a `status` change straight to `grc/action`'s own
 * `TransitionActionUseCase` — the identical transition table, the identical
 * reopen-reason invariant, the identical `action.*` audit events (D-1, D-3,
 * D-5, `update-treatment-action.usecase.ts`'s own header). What the risk
 * route does on top, and what calling the shared endpoint directly would
 * have silently skipped: confirms the URL's `:riskId` genuinely is this
 * action's origin (never trusting "the actor has scope over some origin"),
 * and advances the RISK's own `version`, which is what the `ETag` this
 * table already threads through `onEtagChanged` actually reflects.
 *
 * The legal-transitions MENU itself is still derived from
 * `availableTransitions`/`actionStatusLabel`/`actionStatusBadgeVariant`
 * (`features/actions/status.ts`) — a real improvement over the old
 * free-choice `<Select>`, and kept. Only the call underneath changed.
 *
 * The reopen-with-reason flow reuses `ReopenActionDialog`
 * (`features/actions/components/`) — the same component every other origin
 * screen uses — passing its own `onConfirm` so the write goes through the
 * risk route above. It briefly did NOT: the dialog used to call
 * `actionsApi.transitionAction` internally with no way to redirect the
 * request, so this file carried a byte-for-byte copy of it. That copy could
 * not drift in WORDS (both read `lib/messages/actions.ts`) but could drift
 * in markup, focus order and ARIA, which is the half that actually breaks
 * quietly. The dialog now takes the write as a parameter, and the copy is
 * gone.
 *
 * `risk:treat` is this table's ONE gate for creating, editing AND
 * transitioning — never a second, generic permission concept bleeding in:
 * a caller who can see the risk (`risk:view`) but cannot treat it sees the
 * list read-only, with neither "Adicionar ação" nor any row-action menu at
 * all. As always (CLAUDE.md §18.9), this is advisory only — the server
 * independently re-checks `risk:treat` on every one of these four calls.
 *
 * ## `code` is not part of this wire shape
 *
 * `RiskTreatmentAction` (`contracts/risks.openapi.yaml`) carries no `code`
 * — unlike the generic `Action` the shared `/actions` endpoints return,
 * `TreatmentActionResponse`'s own mapper never populates one. The title
 * itself links to `/actions/{id}` instead (a route another workstream is
 * building concurrently; the link is never conditionally rendered on it
 * existing yet, exactly like `my-actions-columns.tsx`'s own
 * `/risks/{originId}` link).
 *
 * ## Overdue is ALWAYS the server's answer (ADR-015)
 *
 * `RiskTreatmentAction.overdue` is computed on the server, on read, from
 * `dueOn`/`status` — this component only ever displays `action.overdue` as
 * returned, both in the table and in `summary` below, and NEVER compares
 * `action.dueOn` against a client-side `Date` itself (ADR-006's clock
 * disagreement applied to dates instead). Overdue is conveyed by an
 * `Alert`-style row tint AND `StatusBadge`'s own icon + text ("Vencida") —
 * never colour alone (SC-012).
 *
 * `../date.ts`'s `formatDateOnly` is used for `dueOn` — never
 * `new Date(dueOn).toLocaleDateString()` directly, which parses a
 * date-only string as UTC and can render the previous day in a timezone
 * behind UTC.
 */
import { FormField, StatusBadge } from '@pharos/design-system/components';
import { Loader2, MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { UserPicker } from '@/components/directory/user-picker';
import { Link } from '@/components/navigation/link';
import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ReopenActionDialog } from '@/features/actions/components/reopen-action-dialog';
import {
  actionStatusBadgeVariant,
  actionStatusLabel,
  availableTransitions,
} from '@/features/actions/status';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';

import { risksApi } from '../api';
import { formatDateOnly, todayDateOnly } from '../date';

import type { RiskTreatmentAction, TreatmentActionSummary, UserRef } from '../types';

const PAGE_SIZE = 20;

export interface TreatmentActionsTableProps {
  riskId: string;
  /** The risk's current `ETag` (ADR-013) — required by both `POST` and `PATCH` on this sub-resource. */
  etag: string;
  canTreat: boolean;
  /** The current treatment decision's id, if any (US5, FR-074) — a new action is attached to it automatically. */
  currentTreatmentId: string | null;
  /** `RiskDetail.treatmentActionSummary` — total/open/overdue counts, read
   * from data the risk detail screen already loaded (no dedicated request
   * for this table's own header). A snapshot as of the risk's last load:
   * `onChanged` below asks the caller to re-fetch the risk after a local
   * mutation, the same mechanism `RiskControlsSection` already uses, so it
   * never drifts for long. */
  summary: TreatmentActionSummary;
  /** Called with the fresh `ETag` after any mutation, so the caller (and any sibling section mutating the same risk) always uses the current version — mirrors `RiskCausesConsequences.onSaved`. */
  onEtagChanged: (etag: string) => void;
  /** Called after create, edit or a lifecycle transition succeeds, so the
   * caller can refresh the risk (and therefore `summary`) — mirrors
   * `RiskControlsSection`'s own `onChanged`. */
  onChanged: () => void;
}

interface ActionFormValues {
  title: string;
  description: string;
  responsibleUserId: string;
  dueOn: string;
}

interface ActionFormFieldErrors {
  title?: string;
  responsible?: string;
  dueOn?: string;
}

function emptyFormValues(): ActionFormValues {
  return { title: '', description: '', responsibleUserId: '', dueOn: todayDateOnly() };
}

function validateForm(values: ActionFormValues): ActionFormFieldErrors {
  const copy = risks.treatment.actionsTable.form.validation;
  const errors: ActionFormFieldErrors = {};
  if (!values.title.trim()) errors.title = copy.titleRequired;
  if (!values.responsibleUserId) errors.responsible = copy.responsibleRequired;
  if (!values.dueOn) errors.dueOn = copy.dueOnRequired;
  return errors;
}

export function TreatmentActionsTable({
  riskId,
  etag,
  canTreat,
  currentTreatmentId,
  summary,
  onEtagChanged,
  onChanged,
}: TreatmentActionsTableProps): React.JSX.Element {
  const copy = risks.treatment.actionsTable;

  const [items, setItems] = useState<readonly RiskTreatmentAction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [resolvedForRiskId, setResolvedForRiskId] = useState<string | null>(null);
  const loading = resolvedForRiskId !== riskId;

  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<ActionFormValues>(emptyFormValues());
  // S-10 — searched server-side now (`UserPicker`), never a preloaded
  // bounded list. The create form has no existing action to seed a label
  // from (starts unselected); the edit form seeds it from `action
  // .responsible` itself (already carries `fullName`) in `openEdit` below.
  const [createResponsible, setCreateResponsible] = useState<UserRef | undefined>(undefined);
  const [editResponsible, setEditResponsible] = useState<UserRef | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ActionFormFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<RiskTreatmentAction | null>(null);
  const [editValues, setEditValues] = useState<ActionFormValues>(emptyFormValues());
  const [editFieldErrors, setEditFieldErrors] = useState<ActionFormFieldErrors>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // The reopen-with-reason flow. `ReopenActionDialog` owns the form, the
  // validation and the error display; this table owns only which row is
  // pending and what the confirm button writes (see this file's header).
  const [pendingReopen, setPendingReopen] = useState<RiskTreatmentAction | null>(null);

  useEffect(() => {
    let cancelled = false;
    risksApi
      .listTreatmentActions(riskId, 1, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.data);
        setPage(1);
        setTotalPages(Math.max(1, result.meta.totalPages));
        setLoadError(false);
        setResolvedForRiskId(riskId);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setResolvedForRiskId(riskId);
      });
    return () => {
      cancelled = true;
    };
  }, [riskId]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await risksApi.listTreatmentActions(riskId, nextPage, PAGE_SIZE);
      setItems((current) => [...current, ...result.data]);
      setPage(nextPage);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    setFormError(null);
    const errors = validateForm(formValues);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    void submitCreate();
  }

  async function submitCreate(): Promise<void> {
    setSubmitting(true);
    try {
      const result = await risksApi.createTreatmentAction(
        riskId,
        {
          title: formValues.title.trim(),
          description: formValues.description.trim() ? formValues.description.trim() : null,
          responsibleUserId: formValues.responsibleUserId,
          dueOn: formValues.dueOn,
          treatmentDecisionId: currentTreatmentId,
        },
        etag,
      );
      setItems((current) => [result.action, ...current]);
      onEtagChanged(result.etag);
      onChanged();
      feedback.success(copy.form.submitSuccess);
      setFormValues(emptyFormValues());
      setCreateResponsible(undefined);
      setFieldErrors({});
      setShowForm(false);
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setFormError(copy.conflictError);
      } else {
        setFormError(copy.form.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(action: RiskTreatmentAction): void {
    setEditing(action);
    setEditValues({
      title: action.title,
      description: action.description ?? '',
      responsibleUserId: action.responsible.id,
      dueOn: action.dueOn,
    });
    setEditResponsible(action.responsible);
    setEditFieldErrors({});
    setEditError(null);
  }

  function handleEditSubmit(event: React.FormEvent): void {
    event.preventDefault();
    setEditError(null);
    const errors = validateForm(editValues);
    setEditFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    void submitEdit();
  }

  async function submitEdit(): Promise<void> {
    if (!editing) return;
    setEditSubmitting(true);
    try {
      const result = await risksApi.updateTreatmentAction(
        riskId,
        editing.id,
        {
          title: editValues.title.trim(),
          description: editValues.description.trim() ? editValues.description.trim() : null,
          responsibleUserId: editValues.responsibleUserId,
          dueOn: editValues.dueOn,
        },
        etag,
      );
      setItems((current) => current.map((item) => (item.id === editing.id ? result.action : item)));
      onEtagChanged(result.etag);
      onChanged();
      feedback.success(copy.editForm.submitSuccess);
      setEditing(null);
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setEditError(copy.conflictError);
      } else {
        setEditError(copy.editForm.genericError);
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  /** Every non-reason transition (start/complete/cancel) — through the
   * RISK's own `PATCH` route, `status` only. See this file's own header for
   * why this is the risk's route and not the shared `POST /actions/{id}/
   * transitions`: `UpdateTreatmentActionUseCase` delegates to the identical
   * `TransitionActionUseCase` underneath, so the legality table and audit
   * events are the SAME ones — this call additionally confirms `:riskId` is
   * this action's real origin and advances the risk's own `version`. */
  async function applyTransition(
    action: RiskTreatmentAction,
    to: RiskTreatmentAction['status'],
  ): Promise<void> {
    setTransitionError(null);
    setTransitioningId(action.id);
    try {
      const result = await risksApi.updateTreatmentAction(riskId, action.id, { status: to }, etag);
      setItems((current) => current.map((item) => (item.id === action.id ? result.action : item)));
      onEtagChanged(result.etag);
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setTransitionError(copy.conflictError);
      } else {
        setTransitionError(copy.transitionError);
      }
    } finally {
      setTransitioningId(null);
    }
  }

  function openReopenDialog(action: RiskTreatmentAction): void {
    setPendingReopen(action);
  }

  /** The ONE transition that needs a reason rather than a plain
   * confirmation (`COMPLETED -> OPEN`, Invariant A2) — enforced
   * authoritatively by the server (`action.entity.ts#assertReopenReasonProvided`,
   * reached here via `UpdateTreatmentActionUseCase` -> `TransitionActionUseCase`,
   * the SAME invariant `POST /actions/{id}/transitions` enforces). The
   * dialog's own emptiness check is a courtesy that saves a round trip,
   * never the actual gate (CLAUDE.md §18.9).
   *
   * Passed to `ReopenActionDialog` as its `onConfirm`: the dialog owns the
   * form and the error surface, this owns the write and the row/ETag state
   * the response carries. A 409 is re-thrown as the table's own conflict
   * message so the reader sees the same wording a conflicting create or
   * edit gives them, rather than the server's raw detail. */
  async function confirmReopen(reason: string): Promise<void> {
    if (!pendingReopen) {
      return;
    }
    try {
      const result = await risksApi.updateTreatmentAction(
        riskId,
        pendingReopen.id,
        { status: 'OPEN', reopenReason: reason },
        etag,
      );
      setItems((current) =>
        current.map((item) => (item.id === pendingReopen.id ? result.action : item)),
      );
      onEtagChanged(result.etag);
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        throw new Error(copy.conflictError);
      }
      throw error;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.cardTitle}</CardTitle>
        <CardDescription>{copy.cardDescription}</CardDescription>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
          <span>{copy.summary.total(summary.total)}</span>
          <span className={summary.overdue > 0 ? 'font-medium text-status-danger-fg' : undefined}>
            {copy.summary.overdue(summary.overdue)}
          </span>
        </div>
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
                  {canTreat ? (
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
                      {/*
                        016-risk-detail-experience, D3 (2026-09-17) —
                        `max-w-xs` alone caps the box but the shared
                        `TableCell` primitive still defaults to
                        `whitespace-nowrap`; a title longer than the cap
                        does not wrap, it spills into "Responsável" (an
                        overlap, not the table's own permitted horizontal
                        scroll — §18.11's exception covers the table being
                        wider than its container, not one cell painting over
                        its neighbour). Pre-existing since 3b8c90a, latent
                        until this phase's two-column `DetailLayout`
                        (`aa50418`) narrowed the main content column to a
                        fixed 320px aside's leftover width — `whitespace-
                        normal` is the same wrap-within-a-cap fix already
                        applied to `assessment-history.tsx`'s own long-text
                        column (D2, same rodada).
                      */}
                      <TableCell className="max-w-xs whitespace-normal">
                        <Link
                          href={`/actions/${action.id}`}
                          className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {action.title}
                        </Link>
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
                        <div className="flex items-center gap-2">
                          <span>{formatDateOnly(action.dueOn)}</span>
                          {action.overdue ? (
                            <StatusBadge variant="danger" label={copy.overdueBadge} />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <StatusBadge
                          variant={actionStatusBadgeVariant(action.status)}
                          label={actionStatusLabel(action.status)}
                        />
                      </TableCell>
                      {canTreat ? (
                        <TableCell>
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
                              <DropdownMenuItem onSelect={() => openEdit(action)}>
                                {copy.editAction}
                              </DropdownMenuItem>
                              {options.map((option) => (
                                <DropdownMenuItem
                                  key={option.to}
                                  onSelect={() => {
                                    if (option.requiresReason) {
                                      openReopenDialog(action);
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

        {canTreat ? (
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
                id="treatment-action-title"
                label={copy.form.fields.title.label}
                required
                error={fieldErrors.title}
              >
                {(field) => (
                  <Input
                    {...field}
                    value={formValues.title}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, title: event.target.value }))
                    }
                    disabled={submitting}
                  />
                )}
              </FormField>

              <FormField
                id="treatment-action-description"
                label={copy.form.fields.description.label}
                optionalIndicator={common.formField.optionalIndicator}
              >
                {(field) => (
                  <Textarea
                    {...field}
                    value={formValues.description}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, description: event.target.value }))
                    }
                    rows={2}
                    disabled={submitting}
                  />
                )}
              </FormField>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  id="treatment-action-responsible"
                  label={copy.form.fields.responsible.label}
                  required
                  error={fieldErrors.responsible}
                >
                  {() => (
                    <UserPicker
                      value={createResponsible}
                      onChange={(user) => {
                        setCreateResponsible(user);
                        setFormValues((current) => ({ ...current, responsibleUserId: user.id }));
                      }}
                      onSearch={(q) => risksApi.searchUsers(q)}
                      disabled={submitting}
                      labels={{
                        placeholder: copy.form.fields.responsible.placeholder,
                        triggerAriaLabel: copy.form.fields.responsible.label,
                      }}
                    />
                  )}
                </FormField>

                <FormField
                  id="treatment-action-due-on"
                  label={copy.form.fields.dueOn.label}
                  required
                  error={fieldErrors.dueOn}
                >
                  {(field) => (
                    <Input
                      {...field}
                      type="date"
                      value={formValues.dueOn}
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, dueOn: event.target.value }))
                      }
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
                    setFormValues(emptyFormValues());
                    setCreateResponsible(undefined);
                    setFieldErrors({});
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

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !editSubmitting) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.editForm.cardTitle}</DialogTitle>
            <DialogDescription className="sr-only">{copy.editForm.cardTitle}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} noValidate className="flex flex-col gap-3">
            {editError ? (
              <p role="alert" className="text-sm font-medium text-status-danger-fg">
                {editError}
              </p>
            ) : null}

            <FormField
              id="treatment-action-edit-title"
              label={copy.editForm.fields.title.label}
              required
              error={editFieldErrors.title}
            >
              {(field) => (
                <Input
                  {...field}
                  value={editValues.title}
                  onChange={(event) =>
                    setEditValues((current) => ({ ...current, title: event.target.value }))
                  }
                  disabled={editSubmitting}
                />
              )}
            </FormField>

            <FormField
              id="treatment-action-edit-description"
              label={copy.editForm.fields.description.label}
              optionalIndicator={common.formField.optionalIndicator}
            >
              {(field) => (
                <Textarea
                  {...field}
                  value={editValues.description}
                  onChange={(event) =>
                    setEditValues((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={2}
                  disabled={editSubmitting}
                />
              )}
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                id="treatment-action-edit-responsible"
                label={copy.editForm.fields.responsible.label}
                required
                error={editFieldErrors.responsible}
              >
                {() => (
                  <UserPicker
                    value={editResponsible}
                    onChange={(user) => {
                      setEditResponsible(user);
                      setEditValues((current) => ({ ...current, responsibleUserId: user.id }));
                    }}
                    onSearch={(q) => risksApi.searchUsers(q)}
                    disabled={editSubmitting}
                    labels={{
                      placeholder: copy.editForm.fields.responsible.placeholder,
                      triggerAriaLabel: copy.editForm.fields.responsible.label,
                    }}
                  />
                )}
              </FormField>

              <FormField
                id="treatment-action-edit-due-on"
                label={copy.editForm.fields.dueOn.label}
                required
                error={editFieldErrors.dueOn}
              >
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    value={editValues.dueOn}
                    onChange={(event) =>
                      setEditValues((current) => ({ ...current, dueOn: event.target.value }))
                    }
                    disabled={editSubmitting}
                  />
                )}
              </FormField>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={editSubmitting}
                onClick={() => setEditing(null)}
              >
                {copy.editForm.actions.cancel}
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : null}
                {editSubmitting ? copy.editForm.actions.submitting : copy.editForm.actions.submit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* The same dialog every other origin screen opens, with this table's
       * own write passed in — see this file's header for why the route
       * differs while the rule does not. */}
      <ReopenActionDialog
        action={pendingReopen}
        onOpenChange={(open) => {
          if (!open) setPendingReopen(null);
        }}
        onApplied={() => setPendingReopen(null)}
        onConfirm={confirmReopen}
      />
    </Card>
  );
}
