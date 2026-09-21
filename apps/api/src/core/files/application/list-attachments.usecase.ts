/**
 * T190 — `ListAttachmentsUseCase`: `GET /attachments` (FR-096, FR-098,
 * FR-030). No attachment id is in play here (unlike `WithdrawAttachmentUseCase`/
 * `GetAttachmentContentUseCase`), so the parent accessor's own
 * `NotFoundDomainError` (keyed by the PARENT's id) is exactly the right
 * refusal to propagate as-is — see `attachment-access.ts`'s header for why
 * that is NOT the case once an attachment id already exists.
 */
import { Injectable } from '@nestjs/common';

import { createPageRequest } from '../../../shared/pagination/page-request';
import { getAttachableEntityAccessor } from '../../comments/domain/entity-registry';
import { AttachmentRepositoryPort } from '../domain/ports/attachment-repository.port';

import type { RawPageRequest } from '../../../shared/pagination/page-request';
import type { PageResponse } from '../../../shared/pagination/page-response';
import type { AttachmentRecord } from '../domain/ports/attachment-repository.port';
import type { AttachableEntityType } from '@prisma/client';

export interface ListAttachmentsInput extends RawPageRequest {
  readonly actorUserId: string;
  readonly entityType: AttachableEntityType;
  readonly entityId: string;
}

@Injectable()
export class ListAttachmentsUseCase {
  constructor(private readonly attachmentRepository: AttachmentRepositoryPort) {}

  async execute(input: ListAttachmentsInput): Promise<PageResponse<AttachmentRecord>> {
    const accessor = getAttachableEntityAccessor(input.entityType);
    await accessor.resolveViewableParent(input.actorUserId, input.entityId);

    return this.attachmentRepository.listByParent(
      input.entityType,
      input.entityId,
      createPageRequest(input),
    );
  }
}
