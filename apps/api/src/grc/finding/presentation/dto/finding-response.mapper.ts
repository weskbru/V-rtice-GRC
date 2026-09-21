/**
 * T073/002-shared-grc-foundation, US3 — maps `FindingRecord`
 * (`domain/ports/finding-repository.port.ts`) to the wire shape
 * `contracts/grc-foundation.openapi.yaml`'s `Finding` schema describes.
 * ONE mapper is the only place a domain object becomes this DTO
 * (ADR-009), mirroring `evidence-response.mapper.ts`/
 * `action-response.mapper.ts`'s discipline.
 *
 * `auditEngagementId` (T089/005-audit-findings, research.md D-5) — `null`
 * for a finding recorded manually (`POST /findings`, FR-008); set for one
 * produced by `POST /audits/{auditId}/findings`
 * (`CreateFindingFromEngagementUseCase`, SC-001). Populated on EVERY read
 * of a `Finding`, not only the audit-engagement module's own
 * `FindingSummary` projection — the whole point of this task being tracked
 * separately from the rest of Phase 4 (`tasks.md` T089's own note).
 */
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
