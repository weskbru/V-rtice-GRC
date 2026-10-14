import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { AttachmentRepositoryPort } from '../domain/ports/attachment-repository.port';
import { FileStorageProvider } from '../domain/ports/file-storage-provider.port';

import { assertAttachmentAccessible } from './attachment-access';

import type { AttachmentRecord } from '../domain/ports/attachment-repository.port';
import type { Readable } from 'node:stream';

const ATTACHMENT_ENTITY_LABEL = 'Anexo';

export interface AttachmentContent {
  readonly attachment: AttachmentRecord;
  readonly stream: Readable;
}

export interface GetAttachmentContentInput {
  readonly actorUserId: string;
  readonly attachmentId: string;
}

@Injectable()
export class GetAttachmentContentUseCase {
  constructor(
    private readonly attachmentRepository: AttachmentRepositoryPort,
    private readonly fileStorage: FileStorageProvider,
  ) {}

  async execute(input: GetAttachmentContentInput): Promise<AttachmentContent> {
    const attachment = await this.attachmentRepository.findById(input.attachmentId);
    if (!attachment) {
      throw new NotFoundDomainError(ATTACHMENT_ENTITY_LABEL, input.attachmentId);
    }

    await assertAttachmentAccessible(attachment, input.actorUserId);

    const stream = await this.fileStorage.get(attachment.storageKey);
    return { attachment, stream };
  }
}
