/**
 * T192 — persistence port for `Comment` rows. Unscoped by design, exactly
 * like `AttachmentRepositoryPort` (`core/files/domain/ports/
 * attachment-repository.port.ts`) — see that port's header for why.
 */
import type { PageRequest } from '../../../../shared/pagination/page-request';
import type { PageResponse } from '../../../../shared/pagination/page-response';
import type { CommentableEntityType } from '@prisma/client';

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface CommentRecord {
  readonly id: string;
  readonly entityType: CommentableEntityType;
  readonly entityId: string;
  readonly body: string;
  readonly author: UserRefRecord;
  readonly createdAt: Date;
  readonly deletedAt: Date | undefined;
}

export interface CreateCommentInput {
  readonly entityType: CommentableEntityType;
  readonly entityId: string;
  readonly body: string;
  readonly authorUserId: string;
}

export abstract class CommentRepositoryPort {
  abstract create(input: CreateCommentInput): Promise<CommentRecord>;

  /** `undefined` for a nonexistent id. Withdrawn rows are still returned
   * (`deletedAt` populated) — see `AttachmentRepositoryPort.findById`'s
   * identical contract. */
  abstract findById(id: string): Promise<CommentRecord | undefined>;

  /** Lists non-withdrawn comments for one parent record, newest first. */
  abstract listByParent(
    entityType: CommentableEntityType,
    entityId: string,
    page: PageRequest,
  ): Promise<PageResponse<CommentRecord>>;

  /** Soft-deletes the row. Returns `false` if `id` does not exist or is
   * already withdrawn. */
  abstract withdraw(id: string, deletedByUserId: string): Promise<boolean>;
}
