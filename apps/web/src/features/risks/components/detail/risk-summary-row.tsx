/** Three presentation groups over the same five server-provided summary facts. */
import { ArrowRight, CalendarClock, ShieldCheck, Wrench } from 'lucide-react';

import { formatDateOnly } from '../../date';

import styles from './risk-detail-visual.module.css';

import type { RiskDetail, RiskLevel } from '../../types';

import { risks } from '@/lib/messages/risks';

function levelTone(level: RiskLevel | null): string {
  if (level === null) return 'neutral';
  if (level === 'LOW') return 'success';
  if (level === 'MEDIUM') return 'warning';
  return 'danger';
}
export interface RiskSummaryRowProps {
  risk: RiskDetail;
}
export function RiskSummaryRow({ risk }: RiskSummaryRowProps): React.JSX.Element {
  const summary = risks.detail.summary;
  const treatment = risk.currentTreatment;
  const treatmentHint = treatment
    ? treatment.deadlineOverdue
      ? risks.treatment.section.deadlineOverdueLabel
      : treatment.deadline
        ? formatDateOnly(treatment.deadline)
        : risks.treatment.section.noDeadline
    : undefined;

  const reviewHint = risk.nextReviewOn
    ? risk.overdueReview
      ? summary.review.hintOverdue
      : summary.review.hintOnTime
    : undefined;

  return (
    <section aria-label={summary.regionLabel} className={styles.summary}>
      <div className={styles.summaryBlock}>
        <h2 className={styles.summaryHeading}>
          <ShieldCheck aria-hidden="true" />
          {summary.groups.exposure}
        </h2>
        <div className={styles.exposure}>
          <dl className={styles.metric}>
            <dt>{summary.inherentLevel.label}</dt>
            <dd
              className={`${styles.value} ${styles.level}`}
              data-tone={levelTone(risk.inherentLevel ?? null)}
            >
              {risk.inherentLevel
                ? risks.riskLevelLabels[risk.inherentLevel]
                : summary.inherentLevel.notAssessed}
            </dd>
            <dd className={styles.hint}>{summary.inherentLevel.hint}</dd>
          </dl>
          <ArrowRight aria-hidden="true" className={styles.arrow} />
          <dl className={styles.metric}>
            <dt>{summary.residualLevel.label}</dt>
            <dd
              className={`${styles.value} ${styles.level}`}
              data-tone={levelTone(risk.residualLevel ?? null)}
            >
              {risk.residualLevel
                ? risks.riskLevelLabels[risk.residualLevel]
                : summary.residualLevel.notAssessed}
            </dd>
            <dd className={styles.hint}>{summary.residualLevel.hint}</dd>
          </dl>
        </div>
      </div>
      <div className={styles.summaryBlock}>
        <h2 className={styles.summaryHeading}>
          <Wrench aria-hidden="true" />
          {summary.groups.response}
        </h2>
        <div className={styles.response}>
          <dl className={styles.metric}>
            <dt>{summary.treatment.label}</dt>
            <dd className={styles.value}>
              {treatment ? risks.treatment.strategyLabels[treatment.strategy] : '—'}
            </dd>
            <dd
              className={styles.hint}
              data-tone={treatment?.deadlineOverdue ? 'warning' : undefined}
            >
              {treatment ? treatmentHint : summary.treatment.notDefined}
            </dd>
          </dl>
          <dl className={styles.metric}>
            <dt>{summary.actionPlans.label}</dt>
            <dd className={styles.value}>
              {risk.treatmentActionSummary.total > 0
                ? risk.treatmentActionSummary.total.toLocaleString('pt-BR')
                : summary.actionPlans.none}
            </dd>
            <dd
              className={styles.hint}
              data-tone={risk.treatmentActionSummary.overdue > 0 ? 'danger' : undefined}
            >
              {summary.actionPlans.hint(
                risk.treatmentActionSummary.open,
                risk.treatmentActionSummary.overdue,
              )}
            </dd>
          </dl>
        </div>
      </div>
      <div className={styles.summaryBlock}>
        <h2 className={styles.summaryHeading}>
          <CalendarClock aria-hidden="true" />
          {summary.groups.governance}
        </h2>
        <dl className={styles.metric}>
          <dt>{summary.review.label}</dt>
          <dd className={styles.value}>
            {risk.nextReviewOn ? formatDateOnly(risk.nextReviewOn) : '—'}
          </dd>
          <dd className={styles.hint} data-tone={risk.overdueReview ? 'danger' : undefined}>
            {risk.nextReviewOn ? reviewHint : summary.review.none}
          </dd>
        </dl>
      </div>
    </section>
  );
}
