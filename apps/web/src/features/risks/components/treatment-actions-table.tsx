'use client';

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
  etag: string;
  canTreat: boolean;
  currentTreatmentId: string | null;
  summary: TreatmentActionSummary;
  onEtagChanged: (etag: string) => void;
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
