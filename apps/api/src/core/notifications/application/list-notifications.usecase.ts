/**
 * T193 — `ListNotificationsUseCase`: `GET /notifications` (FR-101).
 * Requires only an authenticated session (`@NoPermissionRequired()` on the
 * controller) — every result is unconditionally filtered to
 * `recipientUserId = actorUserId`, so there is no permission narrower than
 * "is authenticated" that could ever apply (a user may always read their
 * own notifications).
 */
import { Injectable } from '@nestjs/common';

import { createPageRequest } from '../../../shared/pagination/page-request';
import { NotificationRepositoryPort } from '../domain/ports/notification-repository.port';

import type { RawPageRequest } from '../../../shared/pagination/page-request';
import type { PageResponse } from '../../../shared/pagination/page-response';
import type { NotificationRecord } from '../domain/ports/notification-repository.port';

export interface ListNotificationsInput extends RawPageRequest {
  readonly actorUserId: string;
  readonly unreadOnly: boolean;
}

export interface ListNotificationsResult {
  readonly page: PageResponse<NotificationRecord>;
  readonly unreadCount: number;
}

@Injectable()
export class ListNotificationsUseCase {
  constructor(private readonly notificationRepository: NotificationRepositoryPort) {}

  async execute(input: ListNotificationsInput): Promise<ListNotificationsResult> {
    const [page, unreadCount] = await Promise.all([
      this.notificationRepository.listForRecipient(
        input.actorUserId,
        createPageRequest(input),
        input.unreadOnly,
      ),
      this.notificationRepository.countUnread(input.actorUserId),
    ]);

    return { page, unreadCount };
  }
}
