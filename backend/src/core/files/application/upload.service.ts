import { Inject, Injectable } from '@nestjs/common';
import { AttachableEntityType, AuditEntityType } from '@prisma/client';

import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { getAttachableEntityAccessor } from '../../comments/domain/entity-registry';
import { ATTACHMENT_SETTINGS, type AttachmentSettings } from '../domain/attachment-settings';
import { sniffContentType } from '../domain/magic-bytes';
import { AttachmentRepositoryPort } from '../domain/ports/attachment-repository.port';
import { FileStorageProvider } from '../domain/ports/file-storage-provider.port';

import type { AttachmentRecord } from '../domain/ports/attachment-repository.port';

export interface UploadAttachmentInput {
  readonly actorUserId: string;
  readonly entityType: AttachableEntityType;
  readonly entityId: string;
  readonly fileName: string;
  readonly declaredContentType: string;
  readonly content: Buffer;
}

@Injectable()
export class UploadService {
  constructor(
    @Inject(ATTACHMENT_SETTINGS) private readonly settings: AttachmentSettings,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly attachmentRepository: AttachmentRepositoryPort,
    private readonly fileStorage: FileStorageProvider,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: UploadAttachmentInput): Promise<AttachmentRecord> {
    const accessor = getAttachableEntityAccessor(input.entityType);
    const parentAccess = await accessor.resolveViewableParent(input.actorUserId, input.entityId);

    const { allowedMimeTypes, maxSizeBytes } = this.settings;

    if (!allowedMimeTypes.includes(input.declaredContentType)) {
      throw new ValidationDomainError(USER_MESSAGES.attachment.typeNotAllowed, [
        { field: 'file', message: USER_MESSAGES.attachment.typeNotAllowed },
      ]);
    }

    const sniffed = sniffContentType(input.content);
    if (!sniffed || sniffed !== input.declaredContentType) {
      throw new ValidationDomainError(USER_MESSAGES.attachment.typeMismatch, [
        { field: 'file', message: USER_MESSAGES.attachment.typeMismatch },
      ]);
    }

    if (input.content.length > maxSizeBytes) {
      throw new Error(
        'UploadService received a buffer larger than ATTACHMENT_MAX_SIZE_BYTES; the multer ' +
          'limits.fileSize guard upstream should have refused this before it reached here.',
      );
    }

    const stored = await this.fileStorage.put(input.content, parentAccess.organizationalUnitId);

    return this.transactionRunner.run(async () => {
      const attachment = await this.attachmentRepository.create({
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: input.fileName,
        contentType: input.declaredContentType,
        sizeBytes: stored.sizeBytes,
        checksumSha256: stored.checksumSha256,
        storageKey: stored.storageKey,
        uploadedByUserId: input.actorUserId,
      });

      await this.auditRecorder.record({
        action: 'attachment.uploaded',
        entityType: AuditEntityType.ATTACHMENT,
        entityId: attachment.id,
        actorLabel: attachment.uploadedBy.fullName,
        newValues: {
          entityType: attachment.entityType,
          entityId: attachment.entityId,
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
          checksumSha256: attachment.checksumSha256,
        },
        organizationalUnitId: parentAccess.organizationalUnitId,
      });

      return attachment;
    });
  }
}
