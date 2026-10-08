import { Injectable } from '@nestjs/common';

import { NotificationRepositoryPort } from '../domain/ports/notification-repository.port';

@Injectable()
export class MarkAllNotificationsReadUseCase {
  constructor(private readonly notificationRepository: NotificationRepositoryPort) {}

  async execute(actorUserId: string): Promise<void> {
    await this.notificationRepository.markAllRead(actorUserId);
  }
}
