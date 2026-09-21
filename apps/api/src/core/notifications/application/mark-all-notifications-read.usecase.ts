/**
 * T193 — `MarkAllNotificationsReadUseCase`: `POST /notifications`'s
 * `MARK_ALL_READ` action (FR-101). Idempotent — marks every currently
 * unread notification addressed to the caller as read; calling it again
 * with nothing left unread is a no-op success.
 */
import { Injectable } from '@nestjs/common';

import { NotificationRepositoryPort } from '../domain/ports/notification-repository.port';

@Injectable()
export class MarkAllNotificationsReadUseCase {
  constructor(private readonly notificationRepository: NotificationRepositoryPort) {}

  async execute(actorUserId: string): Promise<void> {
    await this.notificationRepository.markAllRead(actorUserId);
  }
}
