import type { UserRefResponse } from './evidence-response.mapper';
import type { EvidenceLinkRecord } from '../../domain/ports/evidence-link-repository.port';
import type { EvidenceSubjectType } from '@prisma/client';

export interface EvidenceLinkResponse {
  readonly id: string;
  readonly evidenceId: string;
  readonly subjectType: EvidenceSubjectType;
  readonly subjectId: string;
  readonly subjectLabel: string | undefined;
  readonly note: string | null;
  readonly linkedAt: string;
  readonly linkedBy: UserRefResponse;
  readonly unlinkedAt: string | null;
  readonly unlinkedBy: UserRefResponse | null;
}

export function toEvidenceLinkResponse(
  link: EvidenceLinkRecord & { readonly subjectLabel?: string },
): EvidenceLinkResponse {
  return {
    id: link.id,
    evidenceId: link.evidenceId,
    subjectType: link.subjectType,
    subjectId: link.subjectId,
    subjectLabel: link.subjectLabel,
    note: link.note ?? null,
    linkedAt: link.linkedAt.toISOString(),
    linkedBy: { id: link.linkedBy.id, fullName: link.linkedBy.fullName },
    unlinkedAt: link.unlinkedAt ? link.unlinkedAt.toISOString() : null,
    unlinkedBy: link.unlinkedBy
      ? { id: link.unlinkedBy.id, fullName: link.unlinkedBy.fullName }
      : null,
  };
}
