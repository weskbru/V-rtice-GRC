'use client';

/**
 * PharosGRC — risk assessment form (T129, US4, FR-061 to FR-068, ADR-006).
 *
 * ## Never computes a score or a level (ADR-006, "guarantees drift" clause)
 *
 * `CreateRiskAssessmentRequest` (`../types`) has no `inherentScore`,
 * `inherentLevel`, `residualScore` or `residualLevel` field — the type
 * itself makes the mistake unrepresentable, and the API additionally
 * rejects any of those four properties as unknown
 * (`additionalProperties: false`, FR-062, FR-063; T118's contract test
 * exercises the rejection). The only numbers this component ever reads for
 * a probability/impact combination are values ALREADY present on the
 * fetched `RiskMethodologyVersion.matrix` (`GET /risk-methodology`, itself
 * entirely server-derived) — `RiskMatrix.onCellSelect` hands back the exact
 * matrix cell the assessor clicked, `{ score, level }` included, so this
 * component never even performs the lookup itself, let alone the
 * arithmetic behind it.
 *
 * ## Inherent vs residual are unmistakable (ADR-006's basis-naming clause)
 *
 * One shared `RiskMatrix`, driven by a two-way "Selecionando" toggle
 * (`basisToggle`) that decides which basis `onCellSelect` currently writes
 * to. Both selections, once made, stay visible together on the SAME grid
 * via `highlighted` — `RiskMatrix` renders each with its own corner marker
 * shape (solid ring "I" vs dashed ring "R"), never colour alone, so a
 * colour-blind assessor can see exactly where both values landed at once,
 * and the two are never visually confusable with each other or with an
 * ordinary unselected cell. `selectionSummary` repeats both as plain text
 * beneath the matrix for a reader who prefers not to parse the grid at all.
 *
 * ## Methodology-changed 422 (US4 AS5, FR-068)
 *
 * The methodology version resolved when the form loaded is pinned and sent
 * explicitly as `methodologyVersionId` on every submit — never omitted — so
 * if the active version changes between load and submit, the server's 422
 * is guaranteed to fire rather than the request silently completing against
 * a version the assessor never saw. `methodologyChanged` renders that
 * specific 422 as an explicit, actionable state (reload the methodology,
 * redo the selections) instead of the generic error banner other 422s get.
 */
import { FormField, RiskMatrix } from '@pharos/design-system/components';
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

import { risksApi } from '../api';
import { toMatrixCells, toScaleLevels } from '../methodology-mapping';

import type { RiskMethodologyVersion } from '../types';
import type { ApiProblem } from '@/lib/api-client';
import type { RiskMatrixCell, RiskMatrixHighlight } from '@pharos/design-system/components';

export interface AssessmentFormProps {
  riskId: string;
  /** The risk's current `ETag` (ADR-013) — required by `POST .../assessments` (`If-Match`). */
  etag: string;
  /** Called after a successful assessment. The response carries only the assessment, not the risk's updated denormalized levels — the caller re-reads the risk (`risksApi.getRisk`) rather than this form guessing at the new state. */
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
    // Declared inline, matching `risk-form.tsx`'s own reference-data effect
    // — `react-hooks/set-state-in-effect` traces a same-file named function
    // called from an effect more conservatively than an inline one, so this
    // form is what stays lint-clean while still only setting state after
    // the fetch settles.
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

  /** Re-fetches the methodology after the methodology-changed 422 (US4 AS5) — an event-handler call, not an effect, so setting `loadingMethodology`/`methodologyError` synchronously here is unproblematic. */
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
        // US4 AS5, FR-068 — the pinned `methodologyVersionId` is no longer
        // active. This is never treated as a generic failure: the assessor
        // needs to understand the methodology moved under them.
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
          // Pinned explicitly, never omitted — omitting it would let the
          // server silently score against whatever is active NOW instead of
          // surfacing that it changed since this form loaded (US4 AS5).
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
