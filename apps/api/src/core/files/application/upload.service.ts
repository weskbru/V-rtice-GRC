/**
 * T189 — `UploadService`: upload validation (type allow-list, magic-byte
 * sniffing, size limit, checksum) and storage (FR-097, FR-098, FR-100,
 * ADR-010).
 *
 * ## Order of operations, and why nothing is stored on a rejected upload
 *
 * 1. Resolve the PARENT record's accessibility (`entity-registry.ts`) —
 *    permission and organizational scope, combined, throwing
 *    `NotFoundDomainError` on refusal (FR-098, FR-030). Done FIRST so an
 *    upload to a parent the caller cannot see is refused before any
 *    validation work is spent on the file itself.
 * 2. Validate the DECLARED content type against the configured allow-list.
 * 3. Sniff the actual bytes (`domain/magic-bytes.ts`) and require it to
 *    equal the declared type exactly.
 * 4. Defensive size re-check — `AttachmentController`'s `FileInterceptor`
 *    already enforces `ATTACHMENT_MAX_SIZE_BYTES` via multer's own
 *    `limits.fileSize` (surfacing as `413` before this service is ever
 *    reached for a genuinely oversized upload), so reaching this branch
 *    with an oversized buffer should be unreachable in practice; kept as a
 *    second, independent boundary rather than trusting a single check
 *    (CLAUDE.md §12).
 *
 * Every one of 2-4 throws BEFORE `FileStorageProvider.put(...)` is ever
 * called — the storage write and the database row are the LAST two things
 * this method does, in that order, only once every validation has passed.
 * There is no code path that writes bytes to disk and then discovers a
 * validation failure, and no code path that creates the database row
 * before the bytes are safely stored.
 */
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

    // Defensive only — see file header. `AttachmentController`'s multer
    // configuration already refuses a genuinely oversized upload with 413
    // before this service is ever invoked.
    if (input.content.length > maxSizeBytes) {
      throw new Error(
        'UploadService received a buffer larger than ATTACHMENT_MAX_SIZE_BYTES; the multer ' +
          'limits.fileSize guard upstream should have refused this before it reached here.',
      );
    }

    // F-26 fix (research.md D-12/D-R12): `parentAccess.organizationalUnitId`
    // is already resolved server-side, above, before any validation ran —
    // no new resolution, no new trust boundary. Partitions the storage key
    // by scope so identical content in different organizational units is
    // never deduplicated into one shared object (the cross-scope existence
    // oracle F-26 measured); `undefined` here gets its own explicit
    // `unscoped` bucket in `LocalDiskStorageProvider`, never the legacy
    // prefix and never another caller's scoped bucket.
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
