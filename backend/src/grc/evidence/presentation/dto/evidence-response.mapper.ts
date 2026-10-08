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
