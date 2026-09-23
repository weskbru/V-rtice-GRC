import type { UserRefRecord } from './evidence-repository.port';
import type { EvidenceSubjectType } from '@prisma/client';

export interface EvidenceLinkRecord {
  readonly id: string;
  readonly evidenceId: string;
  readonly subjectType: EvidenceSubjectType;
  readonly subjectId: string;
  readonly note: string | undefined;
  readonly linkedAt: Date;
  readonly linkedBy: UserRefRecord;
  readonly unlinkedAt: Date | undefined;
  readonly unlinkedBy: UserRefRecord | undefined;
}

export interface CreateEvidenceLinkInput {
  readonly evidenceId: string;
  readonly subjectType: EvidenceSubjectType;
  readonly subjectId: string;
  readonly note: string | undefined;
  readonly linkedByUserId: string;
  readonly linkedAt: Date;
}

export abstract class EvidenceLinkRepositoryPort {
  abstract create(input: CreateEvidenceLinkInput): Promise<EvidenceLinkRecord>;

  abstract findActiveLink(
    evidenceId: string,
    subjectType: EvidenceSubjectType,
    subjectId: string,
  ): Promise<EvidenceLinkRecord | undefined>;

  abstract findById(evidenceId: string, linkId: string): Promise<EvidenceLinkRecord | undefined>;

  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<EvidenceLinkRecord>;

  abstract listByEvidence(
    evidenceId: string,
    includeUnlinked: boolean,
  ): Promise<readonly EvidenceLinkRecord[]>;

  abstract hasActiveLinkForSubject(
    subjectType: EvidenceSubjectType,
    subjectId: string,
  ): Promise<boolean>;
}
