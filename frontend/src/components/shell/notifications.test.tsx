import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationBell } from './notifications';

import type { Notification } from './notifications-api';

const { listMock, markAllReadMock, markReadMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  markAllReadMock: vi.fn(),
  markReadMock: vi.fn(),
}));

vi.mock('./notifications-api', () => ({
  notificationsApi: {
    list: listMock,
    markAllRead: markAllReadMock,
    markRead: markReadMock,
  },
}));

function notificationFixture(overrides: Partial<Notification>): Notification {
  return {
    id: 'notification-1',
    type: 'risk.approval.requested',
    title: 'Aprovação solicitada',
    body: 'Um risco aguarda sua aprovação.',
    entityType: 'RISK',
    entityId: 'risk-1',
    readAt: null,
    createdAt: '2026-09-05T14:32:00.000Z',
    ...overrides,
  };
}

function pageOf(items: Notification[], unreadCount: number) {
  return {
    data: items,
    meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 },
    unreadCount,
  };
}

beforeEach(() => {
  listMock.mockReset();
  markAllReadMock.mockReset();
  markReadMock.mockReset();
});

describe('NotificationBell', () => {
  it('renders the empty state as the honest, normal case when nothing has produced a notification yet', async () => {
    listMock.mockResolvedValue(pageOf([], 0));
    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

    expect(await screen.findByText('Nenhuma notificação por enquanto.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("shows the unread count in the bell's own accessible name and as a visible badge", async () => {
    listMock.mockResolvedValue(pageOf([notificationFixture({})], 3));
    render(<NotificationBell />);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Notificações (3 não lidas)' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('lists notifications and deep-links a RISK-scoped one to its risk', async () => {
    listMock.mockResolvedValue(pageOf([notificationFixture({})], 1));
    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: /Notificações/ }));

    const link = await screen.findByRole('link', { name: /Aprovação solicitada/ });
    expect(link).toHaveAttribute('href', '/risks/risk-1');
  });

  it('marks a single notification read and decrements the unread count', async () => {
    listMock.mockResolvedValue(
      pageOf([notificationFixture({ entityType: null, entityId: null })], 1),
    );
    markReadMock.mockResolvedValue(undefined);
    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: /Notificações/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como lida' }));

    await waitFor(() => expect(markReadMock).toHaveBeenCalledWith('notification-1'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notificações' })).toBeInTheDocument(),
    );
  });

  it('marks every notification read via "Marcar todas como lidas"', async () => {
    listMock.mockResolvedValue(pageOf([notificationFixture({})], 1));
    markAllReadMock.mockResolvedValue(undefined);
    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: /Notificações/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar todas como lidas' }));

    await waitFor(() => expect(markAllReadMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notificações' })).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: 'Marcar todas como lidas' }),
    ).not.toBeInTheDocument();
  });
});
