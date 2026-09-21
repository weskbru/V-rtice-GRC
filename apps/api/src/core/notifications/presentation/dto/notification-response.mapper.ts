/**
 * T193 — maps `NotificationRecord` to `contracts/platform.openapi.yaml`'s
 * `Notification` schema.
 */
import type { NotificationRecord } from '../../domain/ports/notification-repository.port';

export interface NotificationResponse {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export function toNotificationResponse(record: NotificationRecord): NotificationResponse {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    body: record.body ?? null,
    entityType: record.entityType ?? null,
    entityId: record.entityId ?? null,
    readAt: record.readAt ? record.readAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
  };
}
