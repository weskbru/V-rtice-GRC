import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { createPageResponse } from '../../../shared/pagination/page-response';
import {
  NotificationRepositoryPort,
  type CreateNotificationInput,
  type NotificationRecord,
} from '../domain/ports/notification-repository.port';

import type { PageRequest } from '../../../shared/pagination/page-request';
import type { PageResponse } from '../../../shared/pagination/page-response';
import type { Notification, Prisma } from '@prisma/client';

@Injectable()
export class PrismaNotificationRepository extends NotificationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const created = await this.prisma.client.notification.create({
      data: {
        recipientUserId: input.recipientUserId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    });
    return toNotificationRecord(created);
  }

  async findById(id: string): Promise<NotificationRecord | undefined> {
    const row = await this.prisma.client.notification.findUnique({ where: { id } });
    return row ? toNotificationRecord(row) : undefined;
  }

  async listForRecipient(
    recipientUserId: string,
    page: PageRequest,
    unreadOnly: boolean,
  ): Promise<PageResponse<NotificationRecord>> {
    const where: Prisma.NotificationWhereInput = {
      recipientUserId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.client.notification.count({ where }),
    ]);

    return createPageResponse(rows.map(toNotificationRecord), page, total);
  }

  async countUnread(recipientUserId: string): Promise<number> {
    return this.prisma.client.notification.count({ where: { recipientUserId, readAt: null } });
  }

  async markRead(id: string): Promise<void> {
    await this.prisma.client.notification.updateMany({
      where: { id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(recipientUserId: string): Promise<void> {
    await this.prisma.client.notification.updateMany({
      where: { recipientUserId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

function toNotificationRecord(row: Notification): NotificationRecord {
  return {
    id: row.id,
    recipientUserId: row.recipientUserId,
    type: row.type,
    title: row.title,
    body: row.body ?? undefined,
    entityType: row.entityType ?? undefined,
    entityId: row.entityId ?? undefined,
    readAt: row.readAt ?? undefined,
    createdAt: row.createdAt,
  };
}
