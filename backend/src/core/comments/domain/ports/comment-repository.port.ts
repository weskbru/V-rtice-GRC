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

  abstract findById(id: string): Promise<CommentRecord | undefined>;

  abstract listByParent(
    entityType: CommentableEntityType,
    entityId: string,
    page: PageRequest,
  ): Promise<PageResponse<CommentRecord>>;

  abstract withdraw(id: string, deletedByUserId: string): Promise<boolean>;
}
