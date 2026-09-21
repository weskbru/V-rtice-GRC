/**
 * T193 — persistence port for `Notification` rows.
 */
import type { PageRequest } from '../../../../shared/pagination/page-request';
import type { PageResponse } from '../../../../shared/pagination/page-response';
import type { CommentableEntityType } from '@prisma/client';

export interface NotificationRecord {
  readonly id: string;
  readonly recipientUserId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string | undefined;
  readonly entityType: CommentableEntityType | undefined;
  readonly entityId: string | undefined;
  readonly readAt: Date | undefined;
  readonly createdAt: Date;
}

export interface CreateNotificationInput {
  readonly recipientUserId: string;
  readonly type: string;
  readonly title: string;
  readonly body?: string | undefined;
  readonly entityType?: CommentableEntityType | undefined;
  readonly entityId?: string | undefined;
}

export abstract class NotificationRepositoryPort {
  abstract create(input: CreateNotificationInput): Promise<NotificationRecord>;

  /** `undefined` for a nonexistent id. Callers must independently check
   * `recipientUserId` — this method does not filter by recipient, since it
   * is the read side of "does this id belong to this caller" (FR-030: a
   * notification addressed to someone else must 404, not disclose that a
   * DIFFERENT notification id exists). */
  abstract findById(id: string): Promise<NotificationRecord | undefined>;

  abstract listForRecipient(
    recipientUserId: string,
    page: PageRequest,
    unreadOnly: boolean,
  ): Promise<PageResponse<NotificationRecord>>;

  abstract countUnread(recipientUserId: string): Promise<number>;

  /** Idempotent: marking an already-read notification read again is a
   * no-op success, matching the contract's own "Idempotent" description. */
  abstract markRead(id: string): Promise<void>;

  abstract markAllRead(recipientUserId: string): Promise<void>;
}
