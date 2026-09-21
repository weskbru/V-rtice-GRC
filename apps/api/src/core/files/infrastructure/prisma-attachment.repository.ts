/**
 * T188/T189/T190 — the sole Prisma-backed `AttachmentRepositoryPort`
 * implementation. Unscoped by design — see that port's header comment.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { createPageResponse } from '../../../shared/pagination/page-response';
import {
  AttachmentRepositoryPort,
  type AttachmentRecord,
  type CreateAttachmentInput,
} from '../domain/ports/attachment-repository.port';

import type { PageRequest } from '../../../shared/pagination/page-request';
import type { PageResponse } from '../../../shared/pagination/page-response';
import type { AttachableEntityType, Prisma } from '@prisma/client';

const UPLOADED_BY_SELECT = { select: { id: true, fullName: true, email: true } } as const;

const ATTACHMENT_INCLUDE = {
  uploadedByUser: UPLOADED_BY_SELECT,
} satisfies Prisma.AttachmentInclude;

type AttachmentWithRelations = Prisma.AttachmentGetPayload<{ include: typeof ATTACHMENT_INCLUDE }>;

@Injectable()
export class PrismaAttachmentRepository extends AttachmentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateAttachmentInput): Promise<AttachmentRecord> {
    const created = await this.prisma.client.attachment.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: BigInt(input.sizeBytes),
        checksumSha256: input.checksumSha256,
        storageKey: input.storageKey,
        uploadedByUserId: input.uploadedByUserId,
      },
      include: ATTACHMENT_INCLUDE,
    });
    return toAttachmentRecord(created);
  }

  async findById(id: string): Promise<AttachmentRecord | undefined> {
    const row = await this.prisma.client.attachment.findUnique({
      where: { id },
      include: ATTACHMENT_INCLUDE,
    });
    return row ? toAttachmentRecord(row) : undefined;
  }

  async listByParent(
    entityType: AttachableEntityType,
    entityId: string,
    page: PageRequest,
  ): Promise<PageResponse<AttachmentRecord>> {
    const where: Prisma.AttachmentWhereInput = { entityType, entityId, deletedAt: null };

    const [rows, total] = await Promise.all([
      this.prisma.client.attachment.findMany({
        where,
        include: ATTACHMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.client.attachment.count({ where }),
    ]);

    return createPageResponse(rows.map(toAttachmentRecord), page, total);
  }

  async withdraw(id: string, deletedByUserId: string): Promise<boolean> {
    const result = await this.prisma.client.attachment.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), deletedByUserId },
    });
    return result.count > 0;
  }
}

function toAttachmentRecord(row: AttachmentWithRelations): AttachmentRecord {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: Number(row.sizeBytes),
    checksumSha256: row.checksumSha256,
    storageKey: row.storageKey,
    uploadedBy: {
      id: row.uploadedByUser.id,
      fullName: row.uploadedByUser.fullName,
      email: row.uploadedByUser.email,
    },
    createdAt: row.createdAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}
