import type { PageRequest } from '../../../../shared/pagination/page-request';
import type { PageResponse } from '../../../../shared/pagination/page-response';
import type { AttachableEntityType } from '@prisma/client';

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface AttachmentRecord {
  readonly id: string;
  readonly entityType: AttachableEntityType;
  readonly entityId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly storageKey: string;
  readonly uploadedBy: UserRefRecord;
  readonly createdAt: Date;
  readonly deletedAt: Date | undefined;
}

export interface CreateAttachmentInput {
  readonly entityType: AttachableEntityType;
  readonly entityId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly storageKey: string;
  readonly uploadedByUserId: string;
}

export abstract class AttachmentRepositoryPort {
  abstract create(input: CreateAttachmentInput): Promise<AttachmentRecord>;

  abstract findById(id: string): Promise<AttachmentRecord | undefined>;

  abstract listByParent(
    entityType: AttachableEntityType,
    entityId: string,
    page: PageRequest,
  ): Promise<PageResponse<AttachmentRecord>>;

  abstract withdraw(id: string, deletedByUserId: string): Promise<boolean>;
}
