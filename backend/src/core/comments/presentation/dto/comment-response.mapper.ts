import type { CommentRecord } from '../../domain/ports/comment-repository.port';

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface CommentResponse {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly body: string;
  readonly author: UserRefResponse;
  readonly createdAt: string;
}

export function toCommentResponse(record: CommentRecord): CommentResponse {
  return {
    id: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    body: record.body,
    author: {
      id: record.author.id,
      fullName: record.author.fullName,
      email: record.author.email,
    },
    createdAt: record.createdAt.toISOString(),
  };
}
