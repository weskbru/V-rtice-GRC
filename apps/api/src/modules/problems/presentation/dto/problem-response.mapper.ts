import type { ProblemRecord } from '../../domain/ports/problem-repository.port';
import type { ProblemSeverity, ProblemStatus } from '@prisma/client';

export interface ProblemUserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface ProblemOrgUnitRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ProblemSummaryResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly severity: ProblemSeverity;
  readonly status: ProblemStatus;
  readonly orgUnit: ProblemOrgUnitRefResponse;
  readonly owner: ProblemUserRefResponse;
  readonly identifiedOn: string;
  readonly updatedAt: string;
}

export interface ProblemDetailResponse extends ProblemSummaryResponse {
  readonly description: string;
  readonly rootCause: string | null;
  readonly resolvedAt: string | null;
  readonly resolvedBy: ProblemUserRefResponse | null;
  readonly closedAt: string | null;
  readonly closedBy: ProblemUserRefResponse | null;
  readonly cancellationReason: string | null;
  readonly createdAt: string;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toProblemSummaryResponse(record: ProblemRecord): ProblemSummaryResponse {
  return {
    id: record.id,
    code: record.code,
    title: record.title,
    severity: record.severity,
    status: record.status,
    orgUnit: { id: record.orgUnit.id, code: record.orgUnit.code, name: record.orgUnit.name },
    owner: { id: record.owner.id, fullName: record.owner.fullName },
    identifiedOn: toDateOnly(record.identifiedOn),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toProblemDetailResponse(record: ProblemRecord): ProblemDetailResponse {
  return {
    ...toProblemSummaryResponse(record),
    description: record.description,
    rootCause: record.rootCause ?? null,
    resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : null,
    resolvedBy: record.resolvedBy
      ? { id: record.resolvedBy.id, fullName: record.resolvedBy.fullName }
      : null,
    closedAt: record.closedAt ? record.closedAt.toISOString() : null,
    closedBy: record.closedBy
      ? { id: record.closedBy.id, fullName: record.closedBy.fullName }
      : null,
    cancellationReason: record.cancellationReason ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}
