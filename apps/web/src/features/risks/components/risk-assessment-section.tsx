/**
 * PharosGRC — risk detail, Assessment section (T130, US4, FR-069, FR-093,
 * ADR-006, redesigned 016-risk-detail-experience Área 2, 2026-09-17).
 *
 * Presents the risk's `currentAssessment` — already returned inline by
 * `GET /risks/{riskId}` (`RiskDetailResponse.currentAssessment`) — and never
 * re-fetches it separately. The methodology matrix is fetched independently
 * of `AssessmentForm`'s own fetch (same reasoning `risk-register-filters.tsx`
 * gives for its own duplicated reference-data loading): this section must
 * stay usable on its own, so it cannot depend on a sibling having already
 * fetched anything. That fetch happens when THIS section opens, not on page
 * mount — outside the two-request budget §4.9 protects (pre-existing
 * behaviour, unchanged by this redesign).
 *
 * ## Hierarchy: resultado → interpretação → contexto → ação (Área 2)
 *
 * 1. The matrix — inherent AND residual plotted together via `RiskMatrix`'s
 *    own multi-`highlighted` support — is the main analytical element,
 *    beside a compact score/level/probability/impact-TERM comparison for
 *    glance comparability (`RiskMatrix.highlighted` already carried both
 *    bases before this redesign; only the loading state and the layout
 *    around it changed).
 * 2. "Contexto da avaliação" (methodology version, date, assessor,
 *    rationale, controls considered) at subordinate visual weight —
 *    smaller type, muted, after the analytical result, never competing
 *    with it.
 * 3. A Causas/Consequências COMPARATIVE SUMMARY — first items and a count,
 *    never the full list a second time — with an explicit path to the real
 *    leaf section (`onViewCausesConsequences`, wired to `?section=causes-
 *    consequences` by the caller). Progressive disclosure, not duplication:
 *    the leaf section itself is untouched by this file.
 * 4. "Registrar nova avaliação" / "Alterar próxima revisão" are now
 *    CONTEXTUAL ACTIONS — `AssessmentForm`/`RiskReviewSchedule` are
 *    unmodified (zero blast radius on either component or its own test
 *    suite: both still render their full, always-complete form the instant
 *    they mount) — this section merely decides WHEN to mount them, via a
 *    local toggle exactly like `treatment-actions-table.tsx`'s canonical
 *    "list first, form behind a button" reference. Each auto-collapses on
 *    its own success callback — confirming returns the screen to its quiet
 *    read state, matching the round's cross-cutting principle (estado
 *    primeiro → ação quando solicitada). Neither form is nested inside this
 *    section's own `Card` — each keeps its own top-level `Card`, appearing
 *    as a sibling below when revealed, so revealing one never produces a
 *    card-in-card (CLAUDE.md §18.5).
 * 5. `AssessmentHistory` stays last, unconditionally visible — a permanent
 *    record, never behind an action.
 *
 * ## The loading state that used to be silent
 *
 * Before this redesign, `methodology === null && !methodologyError`
 * rendered nothing at all while the fetch was in flight — the matrix
 * appeared to simply not exist for however long the request took. This
 * file's own JSX below now has three branches for the matrix (`loading` /
 * loaded / `methodologyError`), never a fourth implicit "nothing" case.
 */
'use client';

import { LoadingState, RiskMatrix, RiskScore } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { risks } from '@/lib/messages/risks';

import { risksApi } from '../api';
import { formatDateOnly } from '../date';
import { toMatrixCells, toScaleLevels } from '../methodology-mapping';

import { AssessmentForm } from './assessment-form';
import { AssessmentHistory } from './assessment-history';
import { RiskReviewSchedule } from './risk-review-schedule';

import type { RiskDetail, RiskMethodologyVersion, ScalePoint } from '../types';
import type { RiskMatrixHighlight } from '@pharos/design-system/components';

export interface RiskAssessmentSectionProps {
  risk: RiskDetail;
  /** The risk's current `ETag` (ADR-013) — forwarded to `AssessmentForm`/`RiskReviewSchedule`, whichever is open. */
  etag: string;
  canAssess: boolean;
  onAssessed: () => void;
  onReviewSaved: (result: { risk: RiskDetail; etag: string }) => void;
  /** Bumped by the caller after a new assessment is recorded, so `AssessmentHistory` refetches. */
  assessmentHistoryRefreshToken: number;
  /** Jumps to the "Causas e Consequências" leaf section (`?section=causes-consequences`) — never a second copy of that list here. */
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
              {/*
                1. Resultado + interpretação. The matrix and the compact
                comparison are DELIBERATELY NOT grid/flex siblings sharing a
                track (2026-09-17, D1 fix): `RiskMatrix` is intrinsically
                wide and scrolls internally on its own, and a grid column
                that shares a row with it inherits that same content-driven
                minimum width, even on a LATER row of the same implicit
                column — the comparison's own short text ends up positioned
                past the visible edge of `<main>`'s viewport-driven scroll
                container at 390px and 1024px (measured: the term's own box
                sat at x=384/right=559 in a 390px-wide viewport). Stacking
                the comparison in its own, fully independent block below the
                matrix — never sharing a column/row track with it — removes
                the propagation path entirely rather than chasing a
                breakpoint threshold that would only mask it for today's
                methodology size.
              */}
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

              {/* 2. Contexto da avaliação — subordinate visual weight. */}
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

              {/* 3. Causas e Consequências — comparative SUMMARY, not a duplicate of the full leaf section. */}
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

          {/* 4. Ação — contextual triggers, never a permanently open form. */}
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
