/**
 * T031/002-shared-grc-foundation, US1 — `PrismaEvidenceLinkRepository`, the
 * sole implementation of `EvidenceLinkRepositoryPort`. No `ScopedRepository`
 * base here — like `PrismaRiskControlLinkRepository`, the caller
 * (`LinkEvidenceUseCase`/`UnlinkEvidenceUseCase`) has already resolved and
 * scope-checked the parent `Evidence` (via `EvidenceRepositoryPort`, scope
 * applied) AND the subject (via `EvidenceSubjectResolverPort`) before any
 * method here runs — this repository operates purely on `evidence_links`'
 * own columns and never re-derives either scope check.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import type {
  CreateEvidenceLinkInput,
  EvidenceLinkRecord,
  EvidenceLinkRepositoryPort,
} from '../domain/ports/evidence-link-repository.port';
import type { EvidenceSubjectType, Prisma } from '@prisma/client';

const EVIDENCE_LINK_INCLUDE = {
  linkedByUser: { select: { id: true, fullName: true } },
  unlinkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.EvidenceLinkInclude;

type EvidenceLinkWithRelations = Prisma.EvidenceLinkGetPayload<{
  include: typeof EVIDENCE_LINK_INCLUDE;
}>;

function toEvidenceLinkRecord(row: EvidenceLinkWithRelations): EvidenceLinkRecord {
  return {
    id: row.id,
    evidenceId: row.evidenceId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    note: row.note ?? undefined,
    linkedAt: row.linkedAt,
    linkedBy: { id: row.linkedByUser.id, fullName: row.linkedByUser.fullName },
    unlinkedAt: row.unlinkedAt ?? undefined,
    unlinkedBy: row.unlinkedByUser
      ? { id: row.unlinkedByUser.id, fullName: row.unlinkedByUser.fullName }
      : undefined,
  };
}

@Injectable()
export class PrismaEvidenceLinkRepository implements EvidenceLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateEvidenceLinkInput): Promise<EvidenceLinkRecord> {
    const created = await this.prisma.client.evidenceLink.create({
      data: {
        evidenceId: input.evidenceId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        note: input.note ?? null,
        linkedByUserId: input.linkedByUserId,
        linkedAt: input.linkedAt,
      },
      include: EVIDENCE_LINK_INCLUDE,
    });
    return toEvidenceLinkRecord(created);
  }

  async findActiveLink(
    evidenceId: string,
    subjectType: EvidenceSubjectType,
    subjectId: string,
  ): Promise<EvidenceLinkRecord | undefined> {
    const row = await this.prisma.client.evidenceLink.findFirst({
      where: { evidenceId, subjectType, subjectId, unlinkedAt: null },
      include: EVIDENCE_LINK_INCLUDE,
    });
    return row ? toEvidenceLinkRecord(row) : undefined;
  }

  async findById(evidenceId: string, linkId: string): Promise<EvidenceLinkRecord | undefined> {
    const row = await this.prisma.client.evidenceLink.findFirst({
      where: { id: linkId, evidenceId },
      include: EVIDENCE_LINK_INCLUDE,
    });
    return row ? toEvidenceLinkRecord(row) : undefined;
  }

  async unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<EvidenceLinkRecord> {
    const updated = await this.prisma.client.evidenceLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
      include: EVIDENCE_LINK_INCLUDE,
    });
    return toEvidenceLinkRecord(updated);
  }

  async listByEvidence(
    evidenceId: string,
    includeUnlinked: boolean,
  ): Promise<readonly EvidenceLinkRecord[]> {
    const rows = await this.prisma.client.evidenceLink.findMany({
      where: includeUnlinked ? { evidenceId } : { evidenceId, unlinkedAt: null },
      include: EVIDENCE_LINK_INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toEvidenceLinkRecord);
  }

  /** T017/005-audit-findings — see the port's own doc comment. A single
   * indexed existence check (`findFirst` + `select: { id: true }`), never a
   * full row fetch — the caller only needs a boolean. */
  async hasActiveLinkForSubject(
    subjectType: EvidenceSubjectType,
    subjectId: string,
  ): Promise<boolean> {
    const row = await this.prisma.client.evidenceLink.findFirst({
      where: { subjectType, subjectId, unlinkedAt: null },
      select: { id: true },
    });
    return row !== null;
  }
}
