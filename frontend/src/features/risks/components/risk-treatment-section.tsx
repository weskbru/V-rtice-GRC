'use client';

import { FormField, ReadOnlyField, StatusBadge } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';

import { risksApi } from '../api';
import { formatDateOnly } from '../date';

import type { RiskDetail, RiskTreatmentDecision, TreatmentStrategy } from '../types';
import type { ApiProblem } from '@/lib/api-client';

const TREATMENT_STRATEGIES: readonly TreatmentStrategy[] = [
  'MITIGATE',
  'ACCEPT',
  'TRANSFER',
  'AVOID',
];

export interface RiskTreatmentSectionProps {
  risk: RiskDetail;
  etag: string;
  canTreat: boolean;
  onTreated: () => void;
}

interface ConflictState {
  currentVersion?: number;
  currentStatus?: string;
  modifiedAt?: string;
  modifiedBy?: { id: string; fullName: string };
}

function toConflictState(problem: ApiProblem): ConflictState {
  return {
    currentVersion: problem.currentVersion,
    currentStatus: problem.currentStatus,
    modifiedAt: problem.modifiedAt,
    modifiedBy: problem.modifiedBy,
  };
}

const PAGE_SIZE = 20;

function TreatmentHistory({
  riskId,
  refreshToken,
}: {
  riskId: string;
  refreshToken: number;
}): React.JSX.Element {
  const [items, setItems] = useState<readonly RiskTreatmentDecision[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const requestKey = `${riskId}|${refreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    risksApi
      .listTreatments(riskId, 1, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.data);
        setPage(1);
        setTotalPages(Math.max(1, result.meta.totalPages));
        setError(false);
        setResolvedRequestKey(requestKey);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setResolvedRequestKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva das dependências listadas.
  }, [riskId, refreshToken]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await risksApi.listTreatments(riskId, nextPage, PAGE_SIZE);
      setItems((current) => [...current, ...result.data]);
      setPage(nextPage);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{risks.treatment.history.cardTitle}</CardTitle>
        <CardDescription>{risks.treatment.history.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">{risks.treatment.history.loading}</p>
        ) : error && items.length === 0 ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {risks.treatment.history.loadError}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{risks.treatment.history.empty}</p>
        ) : (
          <>
            <Table>
              <TableCaption className="sr-only">{risks.treatment.history.cardTitle}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{risks.treatment.history.columns.strategy}</TableHead>
                  <TableHead>{risks.treatment.history.columns.description}</TableHead>
                  <TableHead>{risks.treatment.history.columns.deadline}</TableHead>
                  <TableHead>{risks.treatment.history.columns.decidedBy}</TableHead>
                  <TableHead>{risks.treatment.history.columns.decidedAt}</TableHead>
                  <TableHead>{risks.treatment.history.columns.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((decision) => (
                  <TableRow key={decision.id}>
                    <TableCell className="whitespace-nowrap">
                      {risks.treatment.strategyLabels[decision.strategy]}
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap">
                      {decision.description}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {decision.deadline
                        ? formatDateOnly(decision.deadline)
                        : risks.treatment.section.noDeadline}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {decision.decidedBy.fullName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(decision.decidedAt).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {decision.supersededAt ? (
                        <StatusBadge
                          variant="neutral"
                          label={risks.treatment.history.supersededBadge(
                            new Date(decision.supersededAt).toLocaleDateString('pt-BR'),
                          )}
                        />
                      ) : (
                        <StatusBadge
                          variant="success"
                          label={risks.treatment.history.currentBadge}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
                  {risks.treatment.history.loadMore}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskTreatmentSection({
  risk,
  etag,
  canTreat,
  onTreated,
}: RiskTreatmentSectionProps): React.JSX.Element {
  const current = risk.currentTreatment;

  const [strategy, setStrategy] = useState<TreatmentStrategy | ''>('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ strategy?: string; description?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [showForm, setShowForm] = useState(false);

  function resetForm(): void {
    setStrategy('');
    setDescription('');
    setDeadline('');
  }

  function cancelForm(): void {
    setShowForm(false);
    resetForm();
    setFieldErrors({});
    setFormError(null);
    setConflict(null);
  }

  async function submit(ifMatch: string): Promise<void> {
    if (!strategy) return;
    setSubmitting(true);
    try {
      await risksApi.createTreatment(
        risk.id,
        { strategy, description: description.trim(), deadline: deadline || null },
        ifMatch,
      );
      feedback.success(risks.treatment.form.submitSuccess);
      setConflict(null);
      resetForm();
      setShowForm(false);
      setHistoryRefreshToken((token) => token + 1);
      onTreated();
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setConflict(toConflictState(error.problem));
      } else {
        setFormError(risks.treatment.form.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    setFormError(null);
    setConflict(null);

    const nextFieldErrors: { strategy?: string; description?: string } = {};
    if (!strategy) {
      nextFieldErrors.strategy = risks.treatment.form.validation.strategyRequired;
    }
    if (!description.trim()) {
      nextFieldErrors.description = risks.treatment.form.validation.descriptionRequired;
    }
    setFieldErrors(nextFieldErrors);
    if (nextFieldErrors.strategy || nextFieldErrors.description) {
      return;
    }

    void submit(etag);
  }

  async function retryAfterConflict(): Promise<void> {
    if (!conflict?.currentVersion) return;
    await submit(`"${conflict.currentVersion}"`);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{risks.treatment.section.cardTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!current ? (
            <div className="flex flex-col items-start gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {risks.treatment.section.notTreatedTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  {risks.treatment.section.notTreatedDescription}
                </p>
              </div>
              {canTreat && !showForm ? (
                <Button type="button" size="sm" onClick={() => setShowForm(true)}>
                  {risks.treatment.section.recordNewAction}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <ReadOnlyField
                  label={risks.treatment.section.fields.strategy}
                  value={
                    <span className="flex items-center gap-2">
                      {risks.treatment.strategyLabels[current.strategy]}
                      {current.deadlineOverdue ? (
                        <StatusBadge
                          variant="danger"
                          label={risks.treatment.section.deadlineOverdueLabel}
                        />
                      ) : null}
                    </span>
                  }
                />
                <ReadOnlyField
                  label={risks.treatment.section.fields.deadline}
                  value={
                    current.deadline
                      ? formatDateOnly(current.deadline)
                      : risks.treatment.section.noDeadline
                  }
                />
                <ReadOnlyField
                  label={risks.treatment.section.fields.description}
                  value={current.description}
                  full
                />
              </dl>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                <span>{risks.treatment.section.fields.decidedBy(current.decidedBy.fullName)}</span>
                <span>
                  {risks.treatment.section.fields.decidedAt(
                    new Date(current.decidedAt).toLocaleString('pt-BR'),
                  )}
                </span>
              </div>
              {canTreat && !showForm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => setShowForm(true)}
                >
                  {risks.treatment.section.recordNewAction}
                </Button>
              ) : null}
            </div>
          )}

          {canTreat && showForm ? (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-4 rounded-md border border-border p-4"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {risks.treatment.form.cardTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  {risks.treatment.form.cardDescription}
                </p>
              </div>

              {formError ? (
                <p
                  role="alert"
                  className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
                >
                  {formError}
                </p>
              ) : null}

              {current ? (
                <Alert>
                  <AlertTitle>{risks.treatment.section.recordNewAction}</AlertTitle>
                  <AlertDescription>
                    {risks.treatment.form.supersessionWarning(
                      risks.treatment.strategyLabels[current.strategy],
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}

              {conflict ? (
                <Alert variant="destructive">
                  <AlertTitle>{risks.treatment.form.conflict.title}</AlertTitle>
                  <AlertDescription>
                    <p>{risks.treatment.form.conflict.description}</p>
                    {conflict.modifiedBy ? (
                      <p>
                        {risks.treatment.form.conflict.modifiedBy(conflict.modifiedBy.fullName)}
                      </p>
                    ) : null}
                    {conflict.modifiedAt ? (
                      <p>
                        {risks.treatment.form.conflict.modifiedAt(
                          new Date(conflict.modifiedAt).toLocaleString('pt-BR'),
                        )}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm" type="button">
                        <a href={`/risks/${risk.id}`} target="_blank" rel="noopener noreferrer">
                          {risks.treatment.form.conflict.reloadAction}
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={submitting}
                        onClick={() => void retryAfterConflict()}
                      >
                        {risks.treatment.form.conflict.retryAction}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={submitting}
                        onClick={() => setConflict(null)}
                      >
                        {risks.treatment.form.conflict.dismissAction}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}

              <FormField
                id="treatment-strategy"
                label={risks.treatment.form.fields.strategy.label}
                required
                error={fieldErrors.strategy}
              >
                {(field) => (
                  <Select
                    value={strategy}
                    onValueChange={(value) => setStrategy(value as TreatmentStrategy)}
                    disabled={submitting}
                  >
                    <SelectTrigger
                      id={field.id}
                      className="w-full"
                      aria-describedby={field['aria-describedby']}
                      aria-invalid={field['aria-invalid']}
                    >
                      <SelectValue placeholder={risks.treatment.form.fields.strategy.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {TREATMENT_STRATEGIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {risks.treatment.strategyLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField
                id="treatment-description"
                label={risks.treatment.form.fields.description.label}
                required
                description={risks.treatment.form.fields.description.description}
                error={fieldErrors.description}
              >
                {(field) => (
                  <Textarea
                    {...field}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    disabled={submitting}
                  />
                )}
              </FormField>

              <FormField
                id="treatment-deadline"
                label={risks.treatment.form.fields.deadline.label}
                optionalIndicator={common.formField.optionalIndicator}
              >
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    disabled={submitting}
                    className="w-fit"
                  />
                )}
              </FormField>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : null}
                  {submitting
                    ? risks.treatment.form.actions.submitting
                    : risks.treatment.form.actions.submit}
                </Button>
                <Button type="button" variant="ghost" disabled={submitting} onClick={cancelForm}>
                  {risks.treatment.form.actions.cancel}
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <TreatmentHistory riskId={risk.id} refreshToken={historyRefreshToken} />
    </div>
  );
}
