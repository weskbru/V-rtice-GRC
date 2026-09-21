/**
 * T184/T190 — shared helper for `WithdrawAttachmentUseCase` and
 * `GetAttachmentContentUseCase`: given an ALREADY-LOADED `Attachment` row,
 * resolves whether `actorUserId` may act on it via its parent record's own
 * accessor, and — this is the load-bearing part — re-throws any refusal as
 * a fresh `NotFoundDomainError` keyed by the ATTACHMENT's own id, never the
 * parent's.
 *
 * Why: `entity-registry.ts`'s accessors throw `NotFoundDomainError` keyed
 * by the PARENT's id (exactly right for `ListAttachmentsUseCase`, which
 * never has an attachment id in play at all). But `DomainError.message`
 * embeds its `entityId` argument (`shared/errors/domain-error.ts`), so a
 * 404 for attachment X that used the parent's id in its message would be
 * byte-DIFFERENT from the 404 for a nonexistent attachment id Y — which
 * would itself be a disclosure: comparing the two response bodies would
 * reveal that X exists and names a real, resolvable parent, while Y does
 * not. Converting to the attachment's OWN id here is what makes "this
 * attachment id does not exist" and "this attachment id exists but its
 * parent is not accessible to you" produce IDENTICAL response bytes
 * (T184's whole point).
 */
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { getAttachableEntityAccessor } from '../../comments/domain/entity-registry';

import type { ParentRecordAccess } from '../../comments/domain/entity-registry';
import type { AttachmentRecord } from '../domain/ports/attachment-repository.port';

const ATTACHMENT_ENTITY_LABEL = 'Anexo';

/** Throws `NotFoundDomainError('Anexo', attachment.id)` if `attachment` is
 * already withdrawn (`deletedAt` set) or its parent is not accessible to
 * `actorUserId`. Returns the parent's organizational unit id on success. */
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
