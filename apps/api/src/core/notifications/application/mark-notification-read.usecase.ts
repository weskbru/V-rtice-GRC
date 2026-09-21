/**
 * T193 — `MarkNotificationReadUseCase`: `POST /notifications/{id}/read`
 * (FR-101, FR-030). A notification addressed to a DIFFERENT user is
 * answered with `NotFoundDomainError`, never `ForbiddenDomainError` — its
 * existence must not be disclosed to anyone but its recipient. Idempotent:
 * marking an already-read notification read again still succeeds.
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { NotificationRepositoryPort } from '../domain/ports/notification-repository.port';

const NOTIFICATION_ENTITY_LABEL = 'Notificação';

export interface MarkNotificationReadInput {
  readonly actorUserId: string;
  readonly notificationId: string;
}

@Injectable()
export class MarkNotificationReadUseCase {
  constructor(private readonly notificationRepository: NotificationRepositoryPort) {}

  async execute(input: MarkNotificationReadInput): Promise<void> {
    const notification = await this.notificationRepository.findById(input.notificationId);
    if (notification?.recipientUserId !== input.actorUserId) {
      throw new NotFoundDomainError(NOTIFICATION_ENTITY_LABEL, input.notificationId);
    }

    await this.notificationRepository.markRead(input.notificationId);
  }
}
