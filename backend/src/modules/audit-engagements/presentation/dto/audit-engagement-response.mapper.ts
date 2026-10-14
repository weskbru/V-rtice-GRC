import type {
  AuditEngagementOrgUnitRefRecord,
  AuditEngagementRecord,
  AuditEngagementUserRefRecord,
} from '../../domain/ports/audit-engagement-repository.port';
import type { AuditEngagementStatus } from '@prisma/client';

export interface AuditEngagementUserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface AuditEngagementOrgUnitRefResponse {
  readonly id: string;
  readonly name: string;
}

export interface AuditEngagementResponse {
  readonly id: string;
  readonly code: string;
  readonly objective: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly orgUnit: AuditEngagementOrgUnitRefResponse;
  readonly leadAuditor: AuditEngagementUserRefResponse;
  readonly status: AuditEngagementStatus;
  readonly startedAt: string | null;
  readonly startedBy: AuditEngagementUserRefResponse | null;
  readonly completedAt: string | null;
  readonly completedBy: AuditEngagementUserRefResponse | null;
  readonly cancelledAt: string | null;
  readonly cancelledBy: AuditEngagementUserRefResponse | null;
  readonly cancellationJustification: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toUserRefResponse(
  ref: AuditEngagementUserRefRecord | undefined,
): AuditEngagementUserRefResponse | null {
  return ref ? { id: ref.id, fullName: ref.fullName } : null;
}

function toOrgUnitRefResponse(
  ref: AuditEngagementOrgUnitRefRecord,
): AuditEngagementOrgUnitRefResponse {
  return { id: ref.id, name: ref.name };
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toAuditEngagementResponse(record: AuditEngagementRecord): AuditEngagementResponse {
  return {
    id: record.id,
    code: record.code,
    objective: record.objective,
    periodStart: toDateOnlyString(record.periodStart),
    periodEnd: toDateOnlyString(record.periodEnd),
    orgUnit: toOrgUnitRefResponse(record.orgUnit),
    leadAuditor: { id: record.leadAuditor.id, fullName: record.leadAuditor.fullName },
    status: record.status,
    startedAt: record.startedAt ? record.startedAt.toISOString() : null,
    startedBy: toUserRefResponse(record.startedBy),
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    completedBy: toUserRefResponse(record.completedBy),
    cancelledAt: record.cancelledAt ? record.cancelledAt.toISOString() : null,
    cancelledBy: toUserRefResponse(record.cancelledBy),
    cancellationJustification: record.cancellationJustification ?? null,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
