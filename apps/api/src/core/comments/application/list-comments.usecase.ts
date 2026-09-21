/**
 * T192 — `ListCommentsUseCase`: `GET /comments` (FR-095, FR-098, FR-030).
 * See `core/files/application/list-attachments.usecase.ts`'s header — the
 * identical reasoning applies here for propagating the parent accessor's
 * own `NotFoundDomainError` as-is.
 */
import { Injectable } from '@nestjs/common';

import { createPageRequest } from '../../../shared/pagination/page-request';
import { getCommentableEntityAccessor } from '../domain/entity-registry';
import { CommentRepositoryPort } from '../domain/ports/comment-repository.port';

import type { RawPageRequest } from '../../../shared/pagination/page-request';
import type { PageResponse } from '../../../shared/pagination/page-response';
import type { CommentRecord } from '../domain/ports/comment-repository.port';
import type { CommentableEntityType } from '@prisma/client';

export interface ListCommentsInput extends RawPageRequest {
  readonly actorUserId: string;
  readonly entityType: CommentableEntityType;
  readonly entityId: string;
}

@Injectable()
export class ListCommentsUseCase {
  constructor(private readonly commentRepository: CommentRepositoryPort) {}

  async execute(input: ListCommentsInput): Promise<PageResponse<CommentRecord>> {
    const accessor = getCommentableEntityAccessor(input.entityType);
    await accessor.resolveViewableParent(input.actorUserId, input.entityId);

    return this.commentRepository.listByParent(
      input.entityType,
      input.entityId,
      createPageRequest(input),
    );
  }
}
