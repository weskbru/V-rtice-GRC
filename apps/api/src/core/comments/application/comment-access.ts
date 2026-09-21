/**
 * T184/T192 — shared helper for `WithdrawCommentUseCase`, mirroring
 * `core/files/application/attachment-access.ts` exactly. See that file's
 * header for the full rationale: converts any refusal from the parent
 * accessor into a fresh `NotFoundDomainError` keyed by the COMMENT's own
 * id, so "this comment id does not exist" and "this comment id exists but
 * its parent is not accessible to you" produce identical response bytes.
 */
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
