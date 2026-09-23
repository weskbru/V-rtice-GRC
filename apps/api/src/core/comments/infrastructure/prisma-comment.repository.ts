import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { createPageResponse } from '../../../shared/pagination/page-response';
import {
  CommentRepositoryPort,
  type CommentRecord,
  type CreateCommentInput,
} from '../domain/ports/comment-repository.port';

import type { PageRequest } from '../../../shared/pagination/page-request';
import type { PageResponse } from '../../../shared/pagination/page-response';
import type { CommentableEntityType, Prisma } from '@prisma/client';

const AUTHOR_SELECT = { select: { id: true, fullName: true, email: true } } as const;

const COMMENT_INCLUDE = {
  authorUser: AUTHOR_SELECT,
} satisfies Prisma.CommentInclude;

type CommentWithRelations = Prisma.CommentGetPayload<{ include: typeof COMMENT_INCLUDE }>;

@Injectable()
export class PrismaCommentRepository extends CommentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateCommentInput): Promise<CommentRecord> {
    const created = await this.prisma.client.comment.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        body: input.body,
        authorUserId: input.authorUserId,
      },
      include: COMMENT_INCLUDE,
    });
    return toCommentRecord(created);
  }

  async findById(id: string): Promise<CommentRecord | undefined> {
    const row = await this.prisma.client.comment.findUnique({
      where: { id },
      include: COMMENT_INCLUDE,
    });
    return row ? toCommentRecord(row) : undefined;
  }

  async listByParent(
    entityType: CommentableEntityType,
    entityId: string,
    page: PageRequest,
  ): Promise<PageResponse<CommentRecord>> {
    const where: Prisma.CommentWhereInput = { entityType, entityId, deletedAt: null };

    const [rows, total] = await Promise.all([
      this.prisma.client.comment.findMany({
        where,
        include: COMMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.client.comment.count({ where }),
    ]);

    return createPageResponse(rows.map(toCommentRecord), page, total);
  }

  async withdraw(id: string, deletedByUserId: string): Promise<boolean> {
    const result = await this.prisma.client.comment.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), deletedByUserId },
    });
    return result.count > 0;
  }
}

function toCommentRecord(row: CommentWithRelations): CommentRecord {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    body: row.body,
    author: {
      id: row.authorUser.id,
      fullName: row.authorUser.fullName,
      email: row.authorUser.email,
    },
    createdAt: row.createdAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}
