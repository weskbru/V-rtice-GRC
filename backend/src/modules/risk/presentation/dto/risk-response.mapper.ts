import { todayDateOnlyUtc } from '../../../../grc/shared/domain/overdue.service';
import { isOverdueReview } from '../../domain/risk-overdue';

import { toApprovalResponse, type ApprovalResponse } from './approval-response.mapper';
import { toAssessmentResponse, type AssessmentResponse } from './assessment-response.mapper';
import {
  toControlLinkResponse,
  toEntityLinkResponse,
  type ControlLinkResponse,
  type EntityLinkResponse,
} from './risk-relationship-response.mapper';
import {
  toTreatmentDecisionResponse,
  type TreatmentDecisionResponse,
} from './treatment-decision-response.mapper';

import type { RiskDetailAggregate } from '../../application/get-risk-detail.usecase';
import type { RiskRecord, RiskStatementRecord } from '../../domain/ports/risk-repository.port';
import type { RiskLevel, RiskStatus } from '@prisma/client';

export interface ReferenceDataRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface OrgUnitRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface RiskStatementResponse {
  readonly id: string;
  readonly description: string;
  readonly sortOrder: number;
}

export interface TreatmentActionSummaryResponse {
  readonly total: number;
  readonly open: number;
  readonly overdue: number;
}

export interface RiskDetailResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly status: RiskStatus;
  readonly category: ReferenceDataRefResponse | null;
  readonly type: ReferenceDataRefResponse | null;
  readonly origin: ReferenceDataRefResponse | null;
  readonly orgUnit: OrgUnitRefResponse;
  readonly owner: UserRefResponse;
  readonly responsible: UserRefResponse | null;
  readonly causes: readonly RiskStatementResponse[];
  readonly consequences: readonly RiskStatementResponse[];
  readonly currentAssessment: AssessmentResponse | null;
  readonly currentTreatment: TreatmentDecisionResponse | null;
  readonly controls: readonly ControlLinkResponse[];
  readonly processes: readonly EntityLinkResponse[];
  readonly assets: readonly EntityLinkResponse[];
  readonly treatmentActionSummary: TreatmentActionSummaryResponse;
  readonly pendingApprovalDetail: ApprovalResponse | null;
  readonly inherentScore: number | null;
  readonly inherentLevel: RiskLevel | null;
  readonly residualScore: number | null;
  readonly residualLevel: RiskLevel | null;
  readonly identifiedOn: string;
  readonly lastAssessedOn: string | null;
  readonly nextReviewOn: string | null;
  readonly overdueReview: boolean;
  readonly overdueTreatment: boolean;
  readonly pendingApproval: boolean;
  readonly version: number;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toEmptyRiskDetailAggregate(risk: RiskRecord): RiskDetailAggregate {
  return {
    risk,
    currentTreatment: undefined,
    currentTreatmentHasOutstandingActions: false,
    controls: [],
    processes: [],
    assets: [],
    treatmentActionSummary: { total: 0, open: 0, overdue: 0 },
    pendingApprovalDetail: undefined,
  };
}

export function toRiskDetailResponse(aggregate: RiskDetailAggregate): RiskDetailResponse {
  const record = aggregate.risk;
  return {
    id: record.id,
    code: record.code,
    title: record.title,
    description: record.description,
    status: record.status,
    category: toReferenceDataRefResponse(record.category),
    type: toReferenceDataRefResponse(record.type),
    origin: toReferenceDataRefResponse(record.origin),
    orgUnit: { id: record.orgUnit.id, code: record.orgUnit.code, name: record.orgUnit.name },
    owner: toUserRefResponse(record.owner),
    responsible: record.responsible ? toUserRefResponse(record.responsible) : null,
    causes: toRiskStatementResponses(record.causes),
    consequences: toRiskStatementResponses(record.consequences),
    currentAssessment: record.currentAssessment
      ? toAssessmentResponse(record.currentAssessment, record.previousAssessmentLevels)
      : null,
    currentTreatment: aggregate.currentTreatment
      ? toTreatmentDecisionResponse(
          aggregate.currentTreatment,
          aggregate.currentTreatmentHasOutstandingActions,
        )
      : null,
    controls: aggregate.controls.map(toControlLinkResponse),
    processes: aggregate.processes.map(toEntityLinkResponse),
    assets: aggregate.assets.map(toEntityLinkResponse),
    treatmentActionSummary: aggregate.treatmentActionSummary,
    pendingApprovalDetail: aggregate.pendingApprovalDetail
      ? toApprovalResponse(aggregate.pendingApprovalDetail)
      : null,
    inherentScore: record.inherentScore ?? null,
    inherentLevel: record.inherentLevel ?? null,
    residualScore: record.residualScore ?? null,
    residualLevel: record.residualLevel ?? null,
    identifiedOn: toDateOnlyString(record.identifiedOn),
    lastAssessedOn: record.lastAssessedOn ? toDateOnlyString(record.lastAssessedOn) : null,
    nextReviewOn: record.nextReviewOn ? toDateOnlyString(record.nextReviewOn) : null,
    overdueReview: isOverdueReview(record.nextReviewOn, todayDateOnlyUtc()),
    overdueTreatment: aggregate.treatmentActionSummary.overdue > 0,
    pendingApproval: record.pendingApprovalId !== undefined,
    version: record.version,
    archivedAt: record.archivedAt ? record.archivedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toReferenceDataRefResponse(
  ref: { id: string; code: string; name: string } | undefined,
): ReferenceDataRefResponse | null {
  return ref ? { id: ref.id, code: ref.code, name: ref.name } : null;
}

function toUserRefResponse(ref: { id: string; fullName: string; email: string }): UserRefResponse {
  return { id: ref.id, fullName: ref.fullName, email: ref.email };
}

export function toRiskStatementResponses(
  statements: readonly RiskStatementRecord[],
): readonly RiskStatementResponse[] {
  return statements.map((statement) => ({
    id: statement.id,
    description: statement.description,
    sortOrder: statement.sortOrder,
  }));
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
