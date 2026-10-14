import { apiClient } from '@/lib/api-client';

import type { Page } from '@/features/risks/types';

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
  list(page: number, pageSize: number, unreadOnly = false): Promise<NotificationPage> {
    return apiClient.get<NotificationPage>(
      `/notifications?page=${page}&pageSize=${pageSize}&unreadOnly=${String(unreadOnly)}`,
    );
  },

  markAllRead(): Promise<void> {
    return apiClient.post<void>('/notifications', { action: 'MARK_ALL_READ' });
  },

  markRead(notificationId: string): Promise<void> {
    return apiClient.post<void>(`/notifications/${notificationId}/read`, undefined);
  },
};
