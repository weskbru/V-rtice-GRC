/**
 * PharosGRC — notification bell API wrapper (T196, US9, FR-101).
 *
 * Hand-written against `platform.openapi.yaml`'s `/notifications` paths,
 * for the same reason `apps/web/src/features/risks/types.ts` is
 * hand-written (T205 will replace this with `@pharos/api-types` once it is
 * generated). Kept in `components/shell/` rather than a `features/`
 * directory because notifications are platform-wide chrome — addressed to
 * the signed-in user directly, never scoped to one business record — not a
 * Risk Management concern the way `risksApi` is.
 */
import { apiClient } from '@/lib/api-client';

import type { Page } from '@/features/risks/types';

/** Mirrors `Notification` (platform.openapi.yaml, FR-101). `entityType`/`entityId` are the deep-link target when the notification refers to a record — `null` for one that does not. */
export interface Notification {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body?: string;
  readonly entityType: 'RISK' | null;
  readonly entityId: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface NotificationPage extends Page<Notification> {
  readonly unreadCount: number;
}

export const notificationsApi = {
  /** `GET /notifications` — the caller's own notifications only, newest first, with the unread count (FR-101). */
  list(page: number, pageSize: number, unreadOnly = false): Promise<NotificationPage> {
    return apiClient.get<NotificationPage>(
      `/notifications?page=${page}&pageSize=${pageSize}&unreadOnly=${String(unreadOnly)}`,
    );
  },

  /** `POST /notifications` with `{ action: 'MARK_ALL_READ' }` — idempotent. */
  markAllRead(): Promise<void> {
    return apiClient.post<void>('/notifications', { action: 'MARK_ALL_READ' });
  },

  /** `POST /notifications/{notificationId}/read` — idempotent; `404` for a notification addressed to another user (FR-030). */
  markRead(notificationId: string): Promise<void> {
    return apiClient.post<void>(`/notifications/${notificationId}/read`, undefined);
  },
};
