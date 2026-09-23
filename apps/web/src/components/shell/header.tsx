'use client';

import { usePathname } from 'next/navigation';

import { shell } from '@/lib/messages/shell';

import { navigationRegistry } from './navigation-registry';
import { navigationSectionLabel, navigationSectionOf } from './navigation-sections';
import { NotificationBell } from './notifications';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

import type { ImplementedNavigationEntry } from './navigation-registry';
import type { ComponentType, SVGProps } from 'react';

function humanize(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function findImplementedMatch(pathname: string): ImplementedNavigationEntry | undefined {
  return navigationRegistry.find(
    (entry): entry is ImplementedNavigationEntry =>
      entry.status === 'implemented' &&
      (pathname === entry.href || pathname.startsWith(`${entry.href}/`)),
  );
}

function fallbackLabel(pathname: string): string {
  const firstSegment = pathname.split('/').find(Boolean);
  if (!firstSegment) {
    return shell.brandFallback;
  }
  const fallbackLabels: Record<string, string> = shell.header.fallbackLabels;
  return fallbackLabels[firstSegment] ?? humanize(firstSegment);
}

export function Header(): React.JSX.Element {
  const pathname = usePathname();
  const match = findImplementedMatch(pathname);
  const label = match?.label ?? fallbackLabel(pathname);
  const Icon: ComponentType<SVGProps<SVGSVGElement>> | null = match?.icon ?? null;
  const sectionLabel = match ? navigationSectionLabel[navigationSectionOf(match)] : null;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary-on-surface"
          >
            <Icon aria-hidden="true" className="size-4" />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col justify-center leading-tight">
          {sectionLabel ? (
            <span className="truncate text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {sectionLabel}
            </span>
          ) : null}
          <nav aria-label={shell.header.breadcrumbAriaLabel}>
            <ol className="flex items-center gap-1 text-sm font-semibold text-foreground">
              <li className="truncate">{label}</li>
            </ol>
          </nav>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <div aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
