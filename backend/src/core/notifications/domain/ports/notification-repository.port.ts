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

  abstract findById(id: string): Promise<NotificationRecord | undefined>;

  abstract listForRecipient(
    recipientUserId: string,
    page: PageRequest,
    unreadOnly: boolean,
  ): Promise<PageResponse<NotificationRecord>>;

  abstract countUnread(recipientUserId: string): Promise<number>;

  abstract markRead(id: string): Promise<void>;

  abstract markAllRead(recipientUserId: string): Promise<void>;
}
