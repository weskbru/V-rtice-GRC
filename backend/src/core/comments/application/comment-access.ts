import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { getCommentableEntityAccessor } from '../domain/entity-registry';

import type { ParentRecordAccess } from '../domain/entity-registry';
import type { CommentRecord } from '../domain/ports/comment-repository.port';

const COMMENT_ENTITY_LABEL = 'Comentário';

export async function assertCommentAccessible(
  comment: CommentRecord,
  actorUserId: string,
): Promise<ParentRecordAccess> {
  if (comment.deletedAt) {
    throw new NotFoundDomainError(COMMENT_ENTITY_LABEL, comment.id);
  }

  try {
    const accessor = getCommentableEntityAccessor(comment.entityType);
    return await accessor.resolveViewableParent(actorUserId, comment.entityId);
  } catch (error) {
    if (error instanceof NotFoundDomainError) {
      throw new NotFoundDomainError(COMMENT_ENTITY_LABEL, comment.id);
    }
    throw error;
  }
}
