import { Injectable } from '@nestjs/common';

import { NotificationRepositoryPort } from '../domain/ports/notification-repository.port';

import type { NotificationRecord } from '../domain/ports/notification-repository.port';
import type { CommentableEntityType } from '@prisma/client';

export interface NotifyInput {
  readonly recipientUserId: string;
  readonly type: string;
  readonly title: string;
  readonly body?: string | undefined;
  readonly entityType?: CommentableEntityType | undefined;
  readonly entityId?: string | undefined;
}

@Injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepositoryPort) {}

  async notify(input: NotifyInput): Promise<NotificationRecord> {
    return this.notificationRepository.create({
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }
}
