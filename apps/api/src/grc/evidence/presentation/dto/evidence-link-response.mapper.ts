/**
 * T034/002-shared-grc-foundation, US1 — maps `VisibleEvidenceLink`
 * (`application/evidence-link-visibility.service.ts`) to the wire shape
 * `contracts/grc-foundation.openapi.yaml`'s `EvidenceLink` schema
 * describes. ONE mapper, mirroring `evidence-response.mapper.ts`.
 */
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

/** `link.subjectLabel` is present for a `VisibleEvidenceLink`
 * (`listEvidenceLinks`/`linkEvidence`, both of which resolved the subject
 * accessor already) and absent for `unlinkEvidence`'s plain
 * `EvidenceLinkRecord` (deliberately NOT re-resolved on unlink — see
 * `UnlinkEvidenceUseCase`'s own header). The schema does not require
 * `subjectLabel`, so omitting it there is contract-conformant, not a gap. */
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
