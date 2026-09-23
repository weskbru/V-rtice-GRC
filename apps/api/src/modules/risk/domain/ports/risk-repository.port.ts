import type { AssessmentRecord } from './risk-assessment-repository.port';
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { RiskLevel, RiskStatus } from '@prisma/client';

export interface ReferenceDataRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface RiskStatementRecord {
  readonly id: string;
  readonly description: string;
  readonly sortOrder: number;
}

export interface RiskRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly status: RiskStatus;
  readonly category: ReferenceDataRefRecord | undefined;
  readonly type: ReferenceDataRefRecord | undefined;
  readonly origin: ReferenceDataRefRecord | undefined;
  readonly orgUnit: OrgUnitRefRecord;
  readonly owner: UserRefRecord;
  readonly responsible: UserRefRecord | undefined;
  readonly inherentScore: number | undefined;
  readonly inherentLevel: RiskLevel | undefined;
  readonly residualScore: number | undefined;
  readonly residualLevel: RiskLevel | undefined;
  readonly currentAssessmentId: string | undefined;
  readonly currentAssessment: AssessmentRecord | undefined;
  readonly previousAssessmentLevels:
    Pick<AssessmentRecord, 'inherentLevel' | 'residualLevel'> | undefined;
  readonly currentTreatmentId: string | undefined;
  readonly identifiedOn: Date;
  readonly lastAssessedOn: Date | undefined;
  readonly nextReviewOn: Date | undefined;
  readonly pendingApprovalId: string | undefined;
  readonly archivedAt: Date | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly causes: readonly RiskStatementRecord[];
  readonly consequences: readonly RiskStatementRecord[];
}

export interface CreateRiskRecordInput {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly categoryId: string | undefined;
  readonly typeId: string | undefined;
  readonly originId: string | undefined;
  readonly orgUnitId: string;
  readonly ownerUserId: string;
  readonly responsibleUserId: string | undefined;
  readonly identifiedOn: Date;
  readonly nextReviewOn: Date | undefined;
  readonly causes: readonly string[];
  readonly consequences: readonly string[];
}

export interface UpdateRiskChanges {
  readonly title?: string;
  readonly description?: string;
  readonly categoryId?: string | null;
  readonly typeId?: string | null;
  readonly originId?: string | null;
  readonly orgUnitId?: string;
  readonly ownerUserId?: string;
  readonly responsibleUserId?: string | null;
  readonly identifiedOn?: Date;
  readonly nextReviewOn?: Date | null;
}

export type RiskUpdateResult =
  | { readonly outcome: 'UPDATED'; readonly record: RiskRecord }
  | { readonly outcome: 'NOT_FOUND' }
  | {
      readonly outcome: 'VERSION_CONFLICT';
      readonly currentVersion: number;
      readonly currentStatus: RiskStatus;
    };

export interface RiskAssessmentUpdateChanges {
  readonly currentAssessmentId: string;
  readonly inherentScore: number;
  readonly inherentLevel: RiskLevel;
  readonly residualScore: number;
  readonly residualLevel: RiskLevel;
  readonly lastAssessedOn: Date;
  readonly nextReviewOn?: Date;
}

export interface RiskTreatmentUpdateChanges {
  readonly currentTreatmentId: string;
}

export interface RiskLifecycleUpdateChanges {
  readonly status?: RiskStatus;
  readonly pendingApprovalId?: string | null;
  readonly archivedAt?: Date;
}

export abstract class RiskRepositoryPort {
  abstract create(input: CreateRiskRecordInput): Promise<RiskRecord>;

  abstract findById(scope: ScopeFilter, id: string): Promise<RiskRecord | undefined>;

  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract listIdsInScope(scope: ScopeFilter): Promise<readonly string[]>;

  abstract updateWithVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: UpdateRiskChanges,
  ): Promise<RiskUpdateResult>;

  abstract applyAssessmentResult(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: RiskAssessmentUpdateChanges,
  ): Promise<RiskUpdateResult>;

  abstract applyTreatmentDecision(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: RiskTreatmentUpdateChanges,
  ): Promise<RiskUpdateResult>;

  abstract touchVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
  ): Promise<RiskUpdateResult>;

  abstract applyLifecycleTransition(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: RiskLifecycleUpdateChanges,
  ): Promise<RiskUpdateResult>;

  abstract replaceCauses(
    riskId: string,
    items: readonly string[],
  ): Promise<readonly RiskStatementRecord[]>;

  abstract replaceConsequences(
    riskId: string,
    items: readonly string[],
  ): Promise<readonly RiskStatementRecord[]>;
}
