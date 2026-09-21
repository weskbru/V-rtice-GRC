'use client';

/**
 * PharosGRC — today's date in the dashboard header ("Sábado, 12 de setembro
 * de 2026").
 *
 * Client-only. The page is server-rendered first, and the server's clock and
 * time zone are not the reader's: printing the date during SSR would hydrate
 * against a different string around midnight or across zones. So the server
 * snapshot is `null` (an empty placeholder of the same line height, so the
 * header does not shift), and the browser supplies the real date.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: React's own
 * primitive for a value that differs between server and client, which
 * reconciles after hydration without a setState inside an effect (the
 * cascading-render pattern the React hooks lint rule rejects). The date does
 * not need to tick while the page is open, so the subscription is a no-op.
 */
import { useSyncExternalStore } from 'react';

function formatToday(date: Date): string {
  const text = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function subscribe(): () => void {
  return () => undefined;
}

function getClientSnapshot(): string {
  return formatToday(new Date());
}

function getServerSnapshot(): string | null {
  return null;
}

export function DashboardToday(): React.JSX.Element {
  const today = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  return <p className="min-h-5 text-sm whitespace-nowrap text-muted-foreground">{today}</p>;
}
