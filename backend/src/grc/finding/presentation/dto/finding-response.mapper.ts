import type { FindingRecord } from '../../domain/ports/finding-repository.port';
import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingStatus,
} from '@prisma/client';

export interface OrgUnitRefResponse {
  readonly id: string;
  readonly name: string;
}

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface FindingResponse {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefResponse;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string | null;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly owner: UserRefResponse;
  readonly identifiedOn: string;
  readonly status: FindingStatus;
  readonly openActionCount: number;
  readonly evidenceCount: number;
  readonly closedAt: string | null;
  readonly closureJustification: string | null;
  readonly auditEngagementId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toFindingResponse(record: FindingRecord): FindingResponse {
  return {
    id: record.id,
    code: record.code,
    orgUnit: { id: record.orgUnit.id, name: record.orgUnit.name },
    title: record.title,
    description: record.description,
    recommendation: record.recommendation ?? null,
    category: record.category,
    origin: record.origin,
    severity: record.severity,
    priority: record.priority,
    owner: { id: record.owner.id, fullName: record.owner.fullName },
    identifiedOn: toDateOnly(record.identifiedOn),
    status: record.status,
    openActionCount: record.openActionCount,
    evidenceCount: record.evidenceCount,
    closedAt: record.closedAt ? record.closedAt.toISOString() : null,
    closureJustification: record.closureJustification ?? null,
    auditEngagementId: record.auditEngagementId ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
