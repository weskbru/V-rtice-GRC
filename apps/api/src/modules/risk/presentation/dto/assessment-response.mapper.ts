import type { RiskLevelValue } from '../../domain/methodology.schema';
import type { AssessmentRecord } from '../../domain/ports/risk-assessment-repository.port';

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface ControlRefResponse {
  readonly id: string;
}

export interface LevelChangeResponse {
  readonly previousInherentLevel: RiskLevelValue | null;
  readonly previousResidualLevel: RiskLevelValue | null;
  readonly direction: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | null;
}

export interface AssessmentResponse {
  readonly id: string;
  readonly assessedBy: UserRefResponse;
  readonly assessedOn: string;
  readonly methodologyVersion: { readonly id: string; readonly versionNumber: number };
  readonly inherentProbability: number;
  readonly inherentImpact: number;
  readonly inherentScore: number;
  readonly inherentLevel: RiskLevelValue;
  readonly residualProbability: number;
  readonly residualImpact: number;
  readonly residualScore: number;
  readonly residualLevel: RiskLevelValue;
  readonly controlsConsidered: readonly ControlRefResponse[];
  readonly rationale: string | null;
  readonly previousAssessmentId: string | null;
  readonly levelChange: LevelChangeResponse;
}

export function toAssessmentResponse(
  current: AssessmentRecord,
  previous: Pick<AssessmentRecord, 'inherentLevel' | 'residualLevel'> | undefined,
): AssessmentResponse {
  return {
    id: current.id,
    assessedBy: current.assessedBy,
    assessedOn: toDateOnlyString(current.assessedOn),
    methodologyVersion: current.methodologyVersion,
    inherentProbability: current.inherentProbability,
    inherentImpact: current.inherentImpact,
    inherentScore: current.inherentScore,
    inherentLevel: current.inherentLevel,
    residualProbability: current.residualProbability,
    residualImpact: current.residualImpact,
    residualScore: current.residualScore,
    residualLevel: current.residualLevel,
    controlsConsidered: current.controlsConsidered.map((id) => ({ id })),
    rationale: current.rationale,
    previousAssessmentId: current.previousAssessmentId,
    levelChange: toLevelChange(current, previous),
  };
}

function toLevelChange(
  current: AssessmentRecord,
  previous: Pick<AssessmentRecord, 'inherentLevel' | 'residualLevel'> | undefined,
): LevelChangeResponse {
  if (!previous) {
    return { previousInherentLevel: null, previousResidualLevel: null, direction: null };
  }

  return {
    previousInherentLevel: previous.inherentLevel,
    previousResidualLevel: previous.residualLevel,
    direction: compareLevels(previous.residualLevel, current.residualLevel),
  };
}

const LEVEL_RANK: Record<RiskLevelValue, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

function compareLevels(
  previous: RiskLevelValue,
  current: RiskLevelValue,
): 'INCREASED' | 'DECREASED' | 'UNCHANGED' {
  if (LEVEL_RANK[current] > LEVEL_RANK[previous]) return 'INCREASED';
  if (LEVEL_RANK[current] < LEVEL_RANK[previous]) return 'DECREASED';
  return 'UNCHANGED';
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
