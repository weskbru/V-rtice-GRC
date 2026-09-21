/**
 * T034/002-shared-grc-foundation, US1 — maps `EvidenceRecord`
 * (`domain/ports/evidence-repository.port.ts`) to the wire shape
 * `contracts/grc-foundation.openapi.yaml`'s `Evidence` schema describes
 * (revised: no `fileId` — see that document's own revision note). ONE
 * mapper is the only place a domain object becomes this DTO (ADR-009),
 * mirroring `risk-response.mapper.ts`'s discipline.
 *
 * `expired` is computed HERE, on read, from `validUntil` and a
 * caller-supplied reference instant — never stored (data-model.md §6).
 * `linkCount` is populated only when the use case supplied it
 * (`EvidenceWithLinkCount`, R-010) — `undefined` maps to `0` rather than
 * omitting the field, since the schema types it as a plain (non-nullable)
 * integer.
 */
import { isEvidenceExpired } from '../../domain/evidence.entity';

import type { EvidenceRecord } from '../../domain/ports/evidence-repository.port';
import type { EvidenceSource, EvidenceStatus, EvidenceType } from '@prisma/client';

export interface OrgUnitRefResponse {
  readonly id: string;
  readonly name: string;
}

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface EvidenceResponse {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefResponse;
  readonly title: string;
  readonly description: string | null;
  readonly type: EvidenceType;
  readonly source: EvidenceSource;
  readonly owner: UserRefResponse;
  readonly collectedOn: string;
  readonly validUntil: string | null;
  readonly status: EvidenceStatus;
  readonly expired: boolean;
  readonly externalUrl: string | null;
  readonly observation: string | null;
  readonly linkCount: number;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toEvidenceResponse(
  record: EvidenceRecord & { readonly linkCount?: number },
  referenceDate: Date = new Date(),
): EvidenceResponse {
  return {
    id: record.id,
    code: record.code,
    orgUnit: { id: record.orgUnit.id, name: record.orgUnit.name },
    title: record.title,
    description: record.description ?? null,
    type: record.type,
    source: record.source,
    owner: { id: record.owner.id, fullName: record.owner.fullName },
    collectedOn: toDateOnly(record.collectedOn),
    validUntil: record.validUntil ? toDateOnly(record.validUntil) : null,
    status: record.status,
    expired: isEvidenceExpired(record.validUntil, referenceDate),
    externalUrl: record.externalUrl ?? null,
    observation: record.observation ?? null,
    linkCount: record.linkCount ?? 0,
    archivedAt: record.archivedAt ? record.archivedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
