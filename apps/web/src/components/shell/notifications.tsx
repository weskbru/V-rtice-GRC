'use client';

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { shell } from '@/lib/messages/shell';

import { notificationsApi } from './notifications-api';

import type { Notification } from './notifications-api';

const PAGE_SIZE = 20;

function entityHref(notification: Notification): string | null {
  if (notification.entityType === 'RISK' && notification.entityId) {
    return `/risks/${notification.entityId}`;
  }
  return null;
}

export function NotificationBell(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<readonly Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const [refreshToken, setRefreshToken] = useState(0);
  const [resolvedToken, setResolvedToken] = useState<number | null>(null);
  const loading = resolvedToken !== refreshToken;
  const loaded = resolvedToken !== null;

  useEffect(() => {
    let cancelled = false;
    notificationsApi
      .list(1, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.data);
        setUnreadCount(result.unreadCount);
        setError(false);
        setResolvedToken(refreshToken);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setResolvedToken(refreshToken);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  function refresh(): void {
    setRefreshToken((token) => token + 1);
  }

  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen);
    if (nextOpen) {
      refresh();
    }
  }

  async function handleMarkOneRead(notification: Notification): Promise<void> {
    if (notification.readAt) return;
    setItems((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await notificationsApi.markRead(notification.id);
    } catch {
      refresh();
    }
  }

  async function handleMarkAllRead(): Promise<void> {
    setMarkingAll(true);
    const now = new Date().toISOString();
    try {
      await notificationsApi.markAllRead();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      setUnreadCount(0);
    } catch {
      refresh();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? shell.notifications.bellAriaLabelWithUnread(unreadCount)
              : shell.notifications.bellAriaLabel
          }
        >
          <Bell aria-hidden="true" className="size-5" />
          {unreadCount > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">
            {shell.notifications.panelTitle}
          </span>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={markingAll}
              onClick={() => void handleMarkAllRead()}
            >
              {shell.notifications.markAllRead}
            </Button>
          ) : null}
        </div>
        <ScrollArea className="max-h-96">
          {loading && !loaded ? (
            <p
              role="status"
              aria-busy="true"
              className="px-4 py-6 text-center text-sm text-muted-foreground"
            >
              {shell.notifications.loading}
            </p>
          ) : error ? (
            <p role="alert" className="px-4 py-6 text-center text-sm text-status-danger-fg">
              {shell.notifications.loadError}
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {shell.notifications.empty}
            </p>
          ) : (
            <ol
              role="list"
              aria-label={shell.notifications.panelTitle}
              className="flex list-none flex-col divide-y divide-border pl-0"
            >
              {items.map((notification) => {
                const href = entityHref(notification);
                const isUnread = !notification.readAt;
                const body = (
                  <div className="flex flex-col gap-0.5 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {notification.title}
                      </span>
                      {isUnread ? (
                        <span
                          aria-label={shell.notifications.unreadIndicatorLabel}
                          className="mt-1 size-2 shrink-0 rounded-full bg-primary"
                        />
                      ) : null}
                    </div>
                    {notification.body ? (
                      <p className="text-xs text-muted-foreground">{notification.body}</p>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                );

                return (
                  <li key={notification.id} role="listitem">
                    {href ? (
                      <Link
                        href={href}
                        insideDismissingOverlay
                        onClick={() => void handleMarkOneRead(notification)}
                        className="block hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={!isUnread}
                        onClick={() => void handleMarkOneRead(notification)}
                        aria-label={isUnread ? shell.notifications.markOneReadLabel : undefined}
                        className="block w-full text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
