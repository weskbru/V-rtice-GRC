import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { getAttachableEntityAccessor } from '../../comments/domain/entity-registry';

import type { ParentRecordAccess } from '../../comments/domain/entity-registry';
import type { AttachmentRecord } from '../domain/ports/attachment-repository.port';

const ATTACHMENT_ENTITY_LABEL = 'Anexo';

export async function assertAttachmentAccessible(
  attachment: AttachmentRecord,
  actorUserId: string,
): Promise<ParentRecordAccess> {
  if (attachment.deletedAt) {
    throw new NotFoundDomainError(ATTACHMENT_ENTITY_LABEL, attachment.id);
  }

  try {
    const accessor = getAttachableEntityAccessor(attachment.entityType);
    return await accessor.resolveViewableParent(actorUserId, attachment.entityId);
  } catch (error) {
    if (error instanceof NotFoundDomainError) {
      throw new NotFoundDomainError(ATTACHMENT_ENTITY_LABEL, attachment.id);
    }
    throw error;
  }
}
