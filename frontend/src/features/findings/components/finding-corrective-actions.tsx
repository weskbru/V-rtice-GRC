'use client';

import { Loader2, MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { UserPicker } from '@/components/directory/user-picker';
import { Link } from '@/components/navigation/link';
import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
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
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';
import { FormField, StatusBadge } from '@vertice/design-system/components';

import { findingsApi } from '../api';
import { formatDateOnly } from '../date';

import type { UserRef } from '../types';
import type { Action, ActionStatus } from '@/features/actions/types';

const PAGE_SIZE = 20;

export interface FindingCorrectiveActionsProps {
  findingId: string;
  regionLabel: string;
  onActionsChanged?: () => void;
}

export function FindingCorrectiveActions({
  findingId,
  regionLabel,
  onActionsChanged,
}: FindingCorrectiveActionsProps): React.JSX.Element {
  const copy = auditEngagements.correctiveActions;

  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('finding:edit') && hasPermission('action:create');
  const canTransition = hasPermission('action:edit');

  const [items, setItems] = useState<readonly Action[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const requestKey = `${findingId}|${reloadToken}`;
  const loading = resolvedKey !== requestKey;

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
      .listActions({ page: 1, pageSize: PAGE_SIZE, originType: 'FINDING', originId: findingId })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva das dependências listadas.
  }, [requestKey]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await actionsApi.listActions({
        page: nextPage,
        pageSize: PAGE_SIZE,
        originType: 'FINDING',
        originId: findingId,
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

  function refreshAfterMutation(): void {
    setReloadToken((token) => token + 1);
    onActionsChanged?.();
  }

  async function submitCreate(): Promise<void> {
    setSubmitting(true);
    try {
      await actionsApi.createAction({
        originType: 'FINDING',
        originId: findingId,
        title: title.trim(),
        description: description.trim() ? description.trim() : undefined,
        responsibleUserId: responsible!.id,
        dueOn,
      });
      feedback.success(copy.form.submitSuccess);
      resetForm();
      setShowForm(false);
      refreshAfterMutation();
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
      refreshAfterMutation();
    } catch (error) {
      const detail = error instanceof ApiError ? error.problem.detail : undefined;
      setTransitionError(detail ?? copy.transitionError);
    } finally {
      setTransitioningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{copy.sectionTitle}</h2>
        <p className="text-xs text-muted-foreground">{copy.sectionDescription}</p>
      </div>

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
        <div className="overflow-x-auto">
          <Table>
            <TableCaption className="sr-only">{regionLabel}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.columns.code}</TableHead>
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
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/actions/${action.id}`}
                        className="font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {action.code}
                      </Link>
                    </TableCell>
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
        </div>
      )}

      {page < totalPages ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {copy.loadMore}
          </Button>
        </div>
      ) : null}

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
              id={`finding-corrective-action-title-${findingId}`}
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
              id={`finding-corrective-action-description-${findingId}`}
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
                id={`finding-corrective-action-responsible-${findingId}`}
                label={copy.form.fields.responsible.label}
                required
                error={fieldErrors.responsible}
              >
                {() => (
                  <UserPicker
                    value={responsible}
                    onChange={setResponsible}
                    onSearch={(q) => findingsApi.searchUsers(q)}
                    disabled={submitting}
                    labels={{
                      placeholder: copy.form.fields.responsible.placeholder,
                      triggerAriaLabel: copy.form.fields.responsible.label,
                    }}
                  />
                )}
              </FormField>

              <FormField
                id={`finding-corrective-action-due-on-${findingId}`}
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
                {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
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

      <ReopenActionDialog
        action={pendingReopen}
        onOpenChange={(open) => {
          if (!open) setPendingReopen(null);
        }}
        onApplied={() => {
          setPendingReopen(null);
          refreshAfterMutation();
        }}
      />
    </div>
  );
}
