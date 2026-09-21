/**
 * T042/T043/005-audit-findings, User Story 2 — maps `FindingRecord`
 * (`grc/finding/domain/ports/finding-repository.port.ts`) to the wire shape
 * `contracts/audit.openapi.yaml`'s `FindingSummary` schema describes: a
 * purpose-fit projection of `Finding`, NOT the exhaustive shape
 * `grc-foundation.openapi.yaml`'s own `Finding` schema owns — a local,
 * minimal copy for a resource owned elsewhere, the same precedent every
 * prior phase's contract already sets (that schema's own description).
 * Used by both `createFindingFromEngagement`'s `201` body and
 * `listAuditEngagementFindings`'s `data[]`.
 */
import type { FindingRecord } from '../../../../grc/finding/domain/ports/finding-repository.port';
import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingStatus,
} from '@prisma/client';

export interface FindingSummaryUserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface FindingSummaryResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly owner: FindingSummaryUserRefResponse;
  readonly status: FindingStatus;
  readonly auditEngagementId: string | null;
  readonly identifiedOn: string;
  readonly createdAt: string;
}

export function toFindingSummaryResponse(record: FindingRecord): FindingSummaryResponse {
  return {
    id: record.id,
    code: record.code,
    title: record.title,
    description: record.description,
    category: record.category,
    origin: record.origin,
    severity: record.severity,
    priority: record.priority,
    owner: { id: record.owner.id, fullName: record.owner.fullName },
    status: record.status,
    auditEngagementId: record.auditEngagementId ?? null,
    identifiedOn: toDateOnly(record.identifiedOn),
    createdAt: record.createdAt.toISOString(),
  };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
