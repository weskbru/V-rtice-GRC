import type {
  OrgUnitRefResponse,
  ReferenceDataRefResponse,
  UserRefResponse,
} from './risk-response.mapper';
import type { RiskRegisterRow } from '../../domain/ports/risk-query.port';
import type { RiskLevel, RiskStatus } from '@prisma/client';

export interface RiskSummaryResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly descriptionExcerpt: string | null;
  readonly status: RiskStatus;
  readonly category: ReferenceDataRefResponse | null;
  readonly orgUnit: OrgUnitRefResponse;
  readonly owner: UserRefResponse;
  readonly responsible: UserRefResponse | null;
  readonly inherentScore: number | null;
  readonly inherentLevel: RiskLevel | null;
  readonly residualScore: number | null;
  readonly residualLevel: RiskLevel | null;
  readonly lastAssessedOn: string | null;
  readonly nextReviewOn: string | null;
  readonly overdueReview: boolean;
  readonly overdueTreatment: boolean;
  readonly pendingApproval: boolean;
  readonly version: number;
  readonly updatedAt: string;
}

export function toRiskSummaryResponse(row: RiskRegisterRow): RiskSummaryResponse {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    descriptionExcerpt: row.descriptionExcerpt,
    status: row.status,
    category: row.category
      ? { id: row.category.id, code: row.category.code, name: row.category.name }
      : null,
    orgUnit: { id: row.orgUnit.id, code: row.orgUnit.code, name: row.orgUnit.name },
    owner: { id: row.owner.id, fullName: row.owner.fullName, email: row.owner.email },
    responsible: row.responsible
      ? { id: row.responsible.id, fullName: row.responsible.fullName, email: row.responsible.email }
      : null,
    inherentScore: row.inherentScore ?? null,
    inherentLevel: row.inherentLevel ?? null,
    residualScore: row.residualScore ?? null,
    residualLevel: row.residualLevel ?? null,
    lastAssessedOn: row.lastAssessedOn ? toDateOnlyString(row.lastAssessedOn) : null,
    nextReviewOn: row.nextReviewOn ? toDateOnlyString(row.nextReviewOn) : null,
    overdueReview: row.overdueReview,
    overdueTreatment: row.overdueTreatment,
    pendingApproval: row.pendingApproval,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
