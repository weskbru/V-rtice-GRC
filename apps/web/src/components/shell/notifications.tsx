'use client';

/**
 * PharosGRC application shell — notification bell and list (T196, US9,
 * FR-101).
 *
 * Consumes `GET /notifications`, `POST /notifications`
 * (`{ action: 'MARK_ALL_READ' }`) and `POST /notifications/{id}/read`
 * through `notificationsApi` (`./notifications-api.ts`). Mounted once in
 * `Header`, alongside `UserMenu` — platform-wide chrome, not scoped to any
 * one business record.
 *
 * ## The empty state is the honest, expected case — not an error
 *
 * Nothing in this platform release produces a notification yet: the
 * capability (`core/notifications`) is built and tested, but no lifecycle
 * event (a risk assessed, an approval requested, a treatment action
 * overdue, ...) is wired to call it — `docs/architecture.md` §6 states this
 * plainly, and wiring a producer is explicitly out of this task's scope.
 * `shell.notifications.empty` therefore reads as a calm, normal state
 * ("Nenhuma notificação por enquanto"), never as a failure or a "coming
 * soon" placeholder — a real signed-in user opening this panel today sees
 * exactly this, and that is correct behavior, not a gap to hide.
 *
 * ## No realtime channel
 *
 * The unread badge is refreshed on mount and again whenever the panel
 * opens or a mutation completes — there is no WebSocket/SSE/polling loop
 * in this release, so the count can be briefly stale if a notification
 * arrives while the panel is closed. Introducing realtime delivery is a
 * separate, unrequested capability (CLAUDE.md §2 — no premature
 * abstraction) and is not built here.
 */
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

/** The deep-link target for a notification that refers to a record — `null` for one that does not (e.g. a purely informational message). `RISK` is the only registered entity type today (ADR-008); a future module's own notifications add their own case here. */
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

  // Derived "loading" — mirrors `RiskHistorySection`/`RiskCommentsSection`'s
  // own convention exactly: never `setLoading(true)` synchronously in the
  // effect body (`react-hooks/set-state-in-effect`). Bumping `refreshToken`
  // (panel opened, or a mutation's own failure fallback) re-runs the fetch
  // below; `resolvedToken` tracks which fetch last resolved.
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
    // Optimistic — reflected immediately so the unread dot/badge do not lag
    // behind the click; a failure re-fetches from the server rather than
    // trusting the optimistic guess (never a security/audit concern — the
    // server's own state is authoritative regardless of what this renders).
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
