/**
 * T188/T189/T190 — persistence port for `Attachment` rows. Deliberately NOT
 * a `ScopedRepository`: attachments carry no organizational scope of their
 * own (FR-098 — "there is no independent access path"), so every method
 * here is unscoped by design, and authorization is entirely the caller's
 * responsibility via the parent-record accessor
 * (`core/comments/domain/entity-registry.ts`) BEFORE any of these methods
 * is reached.
 */
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

  /** `undefined` for a nonexistent id — SOFT-deleted rows are still
   * returned (with `deletedAt` populated) so callers can distinguish
   * "never existed" from "withdrawn" and treat both as not-found
   * identically at the presentation boundary (FR-030). */
  abstract findById(id: string): Promise<AttachmentRecord | undefined>;

  /** Lists non-withdrawn attachments for one parent record, newest first. */
  abstract listByParent(
    entityType: AttachableEntityType,
    entityId: string,
    page: PageRequest,
  ): Promise<PageResponse<AttachmentRecord>>;

  /** Soft-deletes the row. Returns `false` if `id` does not exist or is
   * already withdrawn (idempotent-refusal, not an error — the use case
   * maps this to the same 404 as "never existed"). */
  abstract withdraw(id: string, deletedByUserId: string): Promise<boolean>;
}
