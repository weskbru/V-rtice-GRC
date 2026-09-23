import type { RiskLevelValue } from '../methodology.schema';
import type { UserRefRecord } from './risk-repository.port';

export interface AssessmentMethodologyVersionRef {
  readonly id: string;
  readonly versionNumber: number;
}

export interface AssessmentRecord {
  readonly id: string;
  readonly riskId: string;
  readonly methodologyVersion: AssessmentMethodologyVersionRef;
  readonly assessedBy: UserRefRecord;
  readonly assessedOn: Date;
  readonly inherentProbability: number;
  readonly inherentImpact: number;
  readonly inherentScore: number;
  readonly inherentLevel: RiskLevelValue;
  readonly residualProbability: number;
  readonly residualImpact: number;
  readonly residualScore: number;
  readonly residualLevel: RiskLevelValue;
  readonly controlsConsidered: readonly string[];
  readonly rationale: string | null;
  readonly previousAssessmentId: string | null;
}

export interface CreateAssessmentRecordInput {
  readonly riskId: string;
  readonly methodologyVersionId: string;
  readonly assessedByUserId: string;
  readonly assessedOn: Date;
  readonly inherentProbability: number;
  readonly inherentImpact: number;
  readonly inherentScore: number;
  readonly inherentLevel: RiskLevelValue;
  readonly residualProbability: number;
  readonly residualImpact: number;
  readonly residualScore: number;
  readonly residualLevel: RiskLevelValue;
  readonly controlsConsidered: readonly string[];
  readonly rationale: string | null;
  readonly previousAssessmentId: string | null;
}

export interface AssessmentPage {
  readonly items: readonly AssessmentRecord[];
  readonly total: number;
}

export abstract class RiskAssessmentRepositoryPort {
  abstract create(input: CreateAssessmentRecordInput): Promise<AssessmentRecord>;

  abstract findById(id: string): Promise<AssessmentRecord | undefined>;

  abstract listByRisk(riskId: string, page: number, pageSize: number): Promise<AssessmentPage>;
}
