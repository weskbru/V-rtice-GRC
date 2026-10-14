'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';
import { FormField, RiskMatrix } from '@vertice/design-system/components';

import { risksApi } from '../api';
import { toMatrixCells, toScaleLevels } from '../methodology-mapping';

import type { RiskMethodologyVersion } from '../types';
import type { ApiProblem } from '@/lib/api-client';
import type { RiskMatrixCell, RiskMatrixHighlight } from '@vertice/design-system/components';

export interface AssessmentFormProps {
  riskId: string;
  etag: string;
  onAssessed: () => void;
}

interface ConflictState {
  currentVersion?: number;
  currentStatus?: string;
  modifiedAt?: string;
  modifiedBy?: { id: string; fullName: string };
}

function findFieldError(problem: ApiProblem, field: string): string | undefined {
  return problem.errors?.find((entry) => entry.field === field)?.message;
}

export function AssessmentForm({
  riskId,
  etag,
  onAssessed,
}: AssessmentFormProps): React.JSX.Element {
  const [methodology, setMethodology] = useState<RiskMethodologyVersion | null>(null);
  const [loadingMethodology, setLoadingMethodology] = useState(true);
  const [methodologyError, setMethodologyError] = useState(false);

  const [activeBasis, setActiveBasis] = useState<'inherent' | 'residual'>('inherent');
  const [inherentCell, setInherentCell] = useState<RiskMatrixCell | null>(null);
  const [residualCell, setResidualCell] = useState<RiskMatrixCell | null>(null);
  const [rationale, setRationale] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ inherent?: string; residual?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [methodologyChanged, setMethodologyChanged] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const active = await risksApi.getActiveMethodology();
        setMethodology(active);
        setMethodologyError(false);
      } catch {
        setMethodologyError(true);
      } finally {
        setLoadingMethodology(false);
      }
    }

    void load();
  }, []);

  function resetSelections(): void {
    setInherentCell(null);
    setResidualCell(null);
    setRationale('');
    setActiveBasis('inherent');
  }

  async function reloadMethodology(): Promise<void> {
    setMethodologyChanged(false);
    resetSelections();
    setLoadingMethodology(true);
    setMethodologyError(false);
    try {
      const active = await risksApi.getActiveMethodology();
      setMethodology(active);
    } catch {
      setMethodologyError(true);
    } finally {
      setLoadingMethodology(false);
    }
  }

  function handleSubmitError(error: unknown): void {
    if (error instanceof ApiError) {
      const problem = error.problem;
      if (problem.status === 409) {
        setConflict({
          currentVersion: problem.currentVersion,
          currentStatus: problem.currentStatus,
          modifiedAt: problem.modifiedAt,
          modifiedBy: problem.modifiedBy,
        });
        return;
      }
      if (problem.status === 422) {
        if (findFieldError(problem, 'methodologyVersionId')) {
          setMethodologyChanged(true);
          return;
        }
        setFormError(problem.detail ?? risks.assessment.form.genericError);
        return;
      }
    }
    setFormError(risks.assessment.form.genericError);
  }

  async function submitAssessment(ifMatch: string): Promise<void> {
    if (!methodology || !inherentCell || !residualCell) {
      return;
    }
    setSubmitting(true);
    try {
      await risksApi.createAssessment(
        riskId,
        {
          inherentProbability: inherentCell.probabilityValue,
          inherentImpact: inherentCell.impactValue,
          residualProbability: residualCell.probabilityValue,
          residualImpact: residualCell.impactValue,
          rationale: rationale.trim() ? rationale.trim() : null,
          methodologyVersionId: methodology.id,
        },
        ifMatch,
      );
      feedback.success(risks.assessment.form.submitSuccess);
      setConflict(null);
      resetSelections();
      onAssessed();
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    setFormError(null);
    setConflict(null);

    const nextFieldErrors: { inherent?: string; residual?: string } = {};
    if (!inherentCell) {
      nextFieldErrors.inherent = risks.assessment.form.validation.inherentCellRequired;
    }
    if (!residualCell) {
      nextFieldErrors.residual = risks.assessment.form.validation.residualCellRequired;
    }
    setFieldErrors(nextFieldErrors);
    if (nextFieldErrors.inherent || nextFieldErrors.residual) {
      return;
    }

    void submitAssessment(etag);
  }

  async function retryAfterConflict(): Promise<void> {
    if (!conflict?.currentVersion) {
      return;
    }
    await submitAssessment(`"${conflict.currentVersion}"`);
  }

  const disabled = submitting || loadingMethodology || !methodology;

  const highlighted: RiskMatrixHighlight[] = [
    ...(inherentCell ? [{ ...inherentCell, basis: 'inherent' as const }] : []),
    ...(residualCell ? [{ ...residualCell, basis: 'residual' as const }] : []),
  ];
  const selectedCell = activeBasis === 'inherent' ? inherentCell : residualCell;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{risks.assessment.form.cardTitle}</CardTitle>
        <CardDescription>{risks.assessment.form.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            >
              {formError}
            </p>
          ) : null}

          {methodologyChanged ? (
            <Alert variant="destructive">
              <AlertTitle>{risks.assessment.form.methodologyChanged.title}</AlertTitle>
              <AlertDescription>
                <p>{risks.assessment.form.methodologyChanged.description}</p>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void reloadMethodology()}
                  >
                    {risks.assessment.form.methodologyChanged.reloadAction}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {conflict ? (
            <Alert variant="destructive">
              <AlertTitle>{risks.assessment.form.conflict.title}</AlertTitle>
              <AlertDescription>
                <p>{risks.assessment.form.conflict.description}</p>
                {conflict.modifiedBy ? (
                  <p>{risks.assessment.form.conflict.modifiedBy(conflict.modifiedBy.fullName)}</p>
                ) : null}
                {conflict.modifiedAt ? (
                  <p>
                    {risks.assessment.form.conflict.modifiedAt(
                      new Date(conflict.modifiedAt).toLocaleString(),
                    )}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" type="button">
                    <a href={`/risks/${riskId}`} target="_blank" rel="noopener noreferrer">
                      {risks.assessment.form.conflict.reloadAction}
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={submitting}
                    onClick={() => void retryAfterConflict()}
                  >
                    {risks.assessment.form.conflict.retryAction}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={submitting}
                    onClick={() => setConflict(null)}
                  >
                    {risks.assessment.form.conflict.dismissAction}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {methodologyError ? (
            <p
              role="alert"
              className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            >
              {risks.assessment.form.methodologyError}
            </p>
          ) : null}

          {loadingMethodology ? (
            <p className="text-sm text-muted-foreground">
              {risks.assessment.form.loadingMethodology}
            </p>
          ) : null}

          {methodology ? (
            <>
              <div
                role="group"
                aria-label={risks.assessment.form.basisToggle.groupLabel}
                className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={activeBasis === 'inherent' ? 'default' : 'ghost'}
                  aria-pressed={activeBasis === 'inherent'}
                  onClick={() => setActiveBasis('inherent')}
                >
                  {risks.assessment.form.basisToggle.inherentAction}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeBasis === 'residual' ? 'default' : 'ghost'}
                  aria-pressed={activeBasis === 'residual'}
                  onClick={() => setActiveBasis('residual')}
                >
                  {risks.assessment.form.basisToggle.residualAction}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                {activeBasis === 'inherent'
                  ? risks.assessment.form.sections.inherent.description
                  : risks.assessment.form.sections.residual.description}
              </p>

              <RiskMatrix
                probabilityScale={toScaleLevels(methodology.probabilityScale)}
                impactScale={toScaleLevels(methodology.impactScale)}
                matrix={toMatrixCells(methodology)}
                selectedCell={selectedCell}
                highlighted={highlighted}
                onCellSelect={(cell) =>
                  activeBasis === 'inherent' ? setInherentCell(cell) : setResidualCell(cell)
                }
                labels={risks.assessment.form.matrixLabels(activeBasis)}
              />

              <dl className="flex flex-col gap-1 text-sm">
                <dt className="sr-only">{risks.assessment.form.sections.inherent.title}</dt>
                <dd className={fieldErrors.inherent ? 'font-medium text-status-danger-fg' : ''}>
                  {risks.assessment.form.selectionSummary(
                    risks.basisName('inherent'),
                    inherentCell
                      ? {
                          score: inherentCell.score,
                          levelLabel: risks.riskLevelBadge.levelName(inherentCell.level),
                        }
                      : null,
                  )}
                </dd>
                <dt className="sr-only">{risks.assessment.form.sections.residual.title}</dt>
                <dd className={fieldErrors.residual ? 'font-medium text-status-danger-fg' : ''}>
                  {risks.assessment.form.selectionSummary(
                    risks.basisName('residual'),
                    residualCell
                      ? {
                          score: residualCell.score,
                          levelLabel: risks.riskLevelBadge.levelName(residualCell.level),
                        }
                      : null,
                  )}
                </dd>
              </dl>
              {fieldErrors.inherent ? (
                <p role="alert" className="text-sm font-medium text-status-danger-fg">
                  {fieldErrors.inherent}
                </p>
              ) : null}
              {fieldErrors.residual ? (
                <p role="alert" className="text-sm font-medium text-status-danger-fg">
                  {fieldErrors.residual}
                </p>
              ) : null}

              <FormField
                id="assessment-rationale"
                label={risks.assessment.form.fields.rationale.label}
                optionalIndicator={common.formField.optionalIndicator}
                description={risks.assessment.form.fields.rationale.description}
              >
                {(field) => (
                  <Textarea
                    {...field}
                    value={rationale}
                    onChange={(event) => setRationale(event.target.value)}
                    rows={3}
                    disabled={submitting}
                  />
                )}
              </FormField>
            </>
          ) : null}

          <div>
            <Button type="submit" disabled={disabled}>
              {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {submitting
                ? risks.assessment.form.actions.submitting
                : risks.assessment.form.actions.submit}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
