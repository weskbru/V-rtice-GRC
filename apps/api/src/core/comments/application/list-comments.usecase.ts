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
