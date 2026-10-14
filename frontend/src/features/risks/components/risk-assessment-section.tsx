'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { risks } from '@/lib/messages/risks';
import { LoadingState, RiskMatrix, RiskScore } from '@vertice/design-system/components';

import { risksApi } from '../api';
import { formatDateOnly } from '../date';
import { toMatrixCells, toScaleLevels } from '../methodology-mapping';

import { AssessmentForm } from './assessment-form';
import { AssessmentHistory } from './assessment-history';
import { RiskReviewSchedule } from './risk-review-schedule';

import type { RiskDetail, RiskMethodologyVersion, ScalePoint } from '../types';
import type { RiskMatrixHighlight } from '@vertice/design-system/components';

export interface RiskAssessmentSectionProps {
  risk: RiskDetail;
  etag: string;
  canAssess: boolean;
  onAssessed: () => void;
  onReviewSaved: (result: { risk: RiskDetail; etag: string }) => void;
  assessmentHistoryRefreshToken: number;
  onViewCausesConsequences: () => void;
}

function scaleLabel(scale: readonly ScalePoint[], value: number): string {
  return scale.find((point) => point.value === value)?.label ?? String(value);
}

export function RiskAssessmentSection({
  risk,
  etag,
  canAssess,
  onAssessed,
  onReviewSaved,
  assessmentHistoryRefreshToken,
  onViewCausesConsequences,
}: RiskAssessmentSectionProps): React.JSX.Element {
  const [methodology, setMethodology] = useState<RiskMethodologyVersion | null>(null);
  const [methodologyError, setMethodologyError] = useState(false);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    risksApi
      .getActiveMethodology()
      .then((active) => {
        if (!cancelled) setMethodology(active);
      })
      .catch(() => {
        if (!cancelled) setMethodologyError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const assessment = risk.currentAssessment;
  const m = risks.assessment.section;
  const ccSummary = risks.assessment.causesConsequencesSummary;

  const highlighted: RiskMatrixHighlight[] = assessment
    ? [
        {
          probabilityValue: assessment.inherentProbability,
          impactValue: assessment.inherentImpact,
          basis: 'inherent',
        },
        {
          probabilityValue: assessment.residualProbability,
          impactValue: assessment.residualImpact,
          basis: 'residual',
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.cardTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!assessment ? (
            <div>
              <p className="text-sm font-medium text-foreground">{m.notAssessedTitle}</p>
              <p className="text-sm text-muted-foreground">{m.notAssessedDescription}</p>
            </div>
          ) : (
            <>
              <div>
                {methodology ? (
                  <RiskMatrix
                    probabilityScale={toScaleLevels(methodology.probabilityScale)}
                    impactScale={toScaleLevels(methodology.impactScale)}
                    matrix={toMatrixCells(methodology)}
                    highlighted={highlighted}
                    labels={risks.riskMatrixLabels(m.matrixCaption)}
                  />
                ) : methodologyError ? (
                  <p className="text-sm text-muted-foreground">{m.matrixLoadError}</p>
                ) : (
                  <LoadingState variant="block" label={m.matrixLoading} />
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:max-w-sm">
                <RiskScore
                  score={assessment.inherentScore}
                  level={assessment.inherentLevel}
                  basis="inherent"
                  emphasis="solid"
                  labels={risks.riskScoreLabels}
                />
                <RiskScore
                  score={assessment.residualScore}
                  level={assessment.residualLevel}
                  basis="residual"
                  emphasis="solid"
                  labels={risks.riskScoreLabels}
                />
                {methodology ? (
                  <dl className="grid grid-cols-[auto_1fr_1fr] items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <dt className="font-medium text-foreground">{m.comparison.probabilityLabel}</dt>
                    <dd>
                      {scaleLabel(methodology.probabilityScale, assessment.inherentProbability)}
                    </dd>
                    <dd>
                      {scaleLabel(methodology.probabilityScale, assessment.residualProbability)}
                    </dd>
                    <dt className="font-medium text-foreground">{m.comparison.impactLabel}</dt>
                    <dd>{scaleLabel(methodology.impactScale, assessment.inherentImpact)}</dd>
                    <dd>{scaleLabel(methodology.impactScale, assessment.residualImpact)}</dd>
                  </dl>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {m.contextHeading}
                </h3>
                <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="sr-only">{m.assessedOnFieldLabel}</dt>
                    <dd>{m.assessedOn(formatDateOnly(assessment.assessedOn))}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">{m.assessedByFieldLabel}</dt>
                    <dd>{m.assessedBy(assessment.assessedBy.fullName)}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">{m.methodologyFieldLabel}</dt>
                    <dd>{m.methodologyVersion(assessment.methodologyVersion.versionNumber)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {m.rationaleLabel}
                    </dt>
                    <dd className="whitespace-pre-wrap">{assessment.rationale ?? m.noRationale}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {ccSummary.causesHeading}
                    </h4>
                    {risk.causes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{ccSummary.empty}</p>
                    ) : (
                      <ul className="flex flex-col gap-0.5 text-sm text-foreground">
                        {risk.causes.slice(0, 2).map((cause) => (
                          <li key={cause.id} className="truncate">
                            {cause.description}
                          </li>
                        ))}
                        {risk.causes.length > 2 ? (
                          <li className="text-xs text-muted-foreground">
                            {ccSummary.andMore(risk.causes.length - 2)}
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {ccSummary.consequencesHeading}
                    </h4>
                    {risk.consequences.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{ccSummary.empty}</p>
                    ) : (
                      <ul className="flex flex-col gap-0.5 text-sm text-foreground">
                        {risk.consequences.slice(0, 2).map((consequence) => (
                          <li key={consequence.id} className="truncate">
                            {consequence.description}
                          </li>
                        ))}
                        {risk.consequences.length > 2 ? (
                          <li className="text-xs text-muted-foreground">
                            {ccSummary.andMore(risk.consequences.length - 2)}
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto w-fit p-0"
                  onClick={onViewCausesConsequences}
                >
                  {ccSummary.viewAllAction}
                </Button>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {canAssess && !showAssessmentForm ? (
              <Button type="button" onClick={() => setShowAssessmentForm(true)}>
                {risks.assessment.actions.recordNew}
              </Button>
            ) : null}
            {!showReviewForm ? (
              <Button type="button" variant="outline" onClick={() => setShowReviewForm(true)}>
                {risks.assessment.actions.changeNextReview}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {showAssessmentForm ? (
        <AssessmentForm
          riskId={risk.id}
          etag={etag}
          onAssessed={() => {
            onAssessed();
            setShowAssessmentForm(false);
          }}
        />
      ) : null}

      {showReviewForm ? (
        <RiskReviewSchedule
          risk={risk}
          etag={etag}
          onSaved={(result) => {
            onReviewSaved(result);
            setShowReviewForm(false);
          }}
        />
      ) : null}

      <AssessmentHistory riskId={risk.id} refreshToken={assessmentHistoryRefreshToken} />
    </div>
  );
}
