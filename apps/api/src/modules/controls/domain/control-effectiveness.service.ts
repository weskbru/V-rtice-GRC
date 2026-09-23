import type { ControlAssessmentResult, ControlFrequency } from '@prisma/client';

export type ControlEffectiveness =
  'NOT_ASSESSED' | 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'EXPIRED';

export const CONTROL_EFFECTIVENESS_VALUES: readonly ControlEffectiveness[] = [
  'NOT_ASSESSED',
  'EFFECTIVE',
  'PARTIALLY_EFFECTIVE',
  'INEFFECTIVE',
  'EXPIRED',
];

export interface ControlAssessmentForEffectiveness {
  readonly assessedOn: Date;
  readonly createdAt: Date;
  readonly result: ControlAssessmentResult;
  readonly attestedAt: Date | null;
}

export const FREQUENCY_WINDOW_DAYS: Readonly<Record<ControlFrequency, number>> = {
  CONTINUOUS: 1,
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
  SEMIANNUAL: 182,
  ANNUAL: 365,
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function isAttested(
  assessment: ControlAssessmentForEffectiveness,
): assessment is ControlAssessmentForEffectiveness & { attestedAt: Date } {
  return assessment.attestedAt !== null;
}

function mostRecent(
  assessments: readonly ControlAssessmentForEffectiveness[],
): ControlAssessmentForEffectiveness {
  return assessments.reduce((latest, candidate) => {
    if (candidate.assessedOn.getTime() !== latest.assessedOn.getTime()) {
      return candidate.assessedOn.getTime() > latest.assessedOn.getTime() ? candidate : latest;
    }
    return candidate.createdAt.getTime() > latest.createdAt.getTime() ? candidate : latest;
  });
}

function toEffectiveness(result: ControlAssessmentResult): ControlEffectiveness {
  return result;
}

export function calculateControlEffectiveness(
  assessments: readonly ControlAssessmentForEffectiveness[],
  frequency: ControlFrequency | null,
  referenceDate: Date,
): ControlEffectiveness {
  const attested = assessments.filter(isAttested);
  if (attested.length === 0) {
    return 'NOT_ASSESSED';
  }

  const latest = mostRecent(attested);

  if (frequency === null) {
    return toEffectiveness(latest.result);
  }

  const windowDays = FREQUENCY_WINDOW_DAYS[frequency];
  const cutoff = referenceDate.getTime() - windowDays * MILLISECONDS_PER_DAY;
  if (latest.assessedOn.getTime() < cutoff) {
    return 'EXPIRED';
  }

  return toEffectiveness(latest.result);
}
