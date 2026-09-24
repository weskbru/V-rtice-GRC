'use client';

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
