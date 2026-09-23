'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';

import { Link } from '@/components/navigation/link';
import { shell } from '@/lib/messages/shell';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';

import { BrandMark } from './brand-mark';
import { navigationRegistry } from './navigation-registry';
import { navigationSectionLabel, navigationSectionOf } from './navigation-sections';

import type { NavigationEntry } from './navigation-registry';
import type { NavigationSection } from './navigation-sections';

const SIDEBAR_EXPANDABLE_QUERY = '(min-width: 1024px)';

function subscribeToExpandableChange(onStoreChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(SIDEBAR_EXPANDABLE_QUERY);
  mediaQueryList.addEventListener('change', onStoreChange);
  return () => mediaQueryList.removeEventListener('change', onStoreChange);
}

function getIsExpandable(): boolean {
  return window.matchMedia(SIDEBAR_EXPANDABLE_QUERY).matches;
}

function getIsExpandableServerSnapshot(): boolean {
  return true;
}

interface NavigationGroup {
  section: NavigationSection;
  label: string | null;
  entries: NavigationEntry[];
}

function groupBySection(entries: readonly NavigationEntry[]): NavigationGroup[] {
  const groups: NavigationGroup[] = [];
  for (const entry of entries) {
    const section = navigationSectionOf(entry);
    const current = groups[groups.length - 1];
    if (current?.section === section) {
      current.entries.push(entry);
    } else {
      groups.push({ section, label: navigationSectionLabel[section], entries: [entry] });
    }
  }
  return groups;
}

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const [userCollapsed, setUserCollapsed] = useState(false);
  const isExpandable = useSyncExternalStore(
    subscribeToExpandableChange,
    getIsExpandable,
    getIsExpandableServerSnapshot,
  );
  const isNarrow = !isExpandable;

  const collapsed = isNarrow || userCollapsed;

  const visibleEntries = navigationRegistry.filter((entry) => {
    if (entry.status === 'planned') {
      return true;
    }
    return !entry.requiredPermission || hasPermission(entry.requiredPermission);
  });

  const groups = groupBySection(visibleEntries);

  return (
    <nav
      aria-label={shell.sidebar.ariaLabel}
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2 border-b border-border',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <BrandMark tileClassName="size-8" markClassName="size-5" />
        {collapsed ? (
          <span className="sr-only">{shell.brandFallback}</span>
        ) : (
          <span className="truncate text-base font-semibold tracking-tight text-foreground">
            {shell.brandFallback}
          </span>
        )}
      </div>

      <div
        data-sidebar-nav
        className="flex min-h-0 flex-1 flex-col gap-3 overscroll-contain overflow-y-auto p-2"
      >
        {groups.map((group, index) => (
          <div key={`${group.section}-${index}`}>
            {group.label && !collapsed ? (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.label}
              </p>
            ) : null}
            <ul aria-label={group.label ?? undefined} className="flex flex-col gap-0.5">
              {group.entries.map((entry) => (
                <NavigationRow
                  key={entry.id}
                  entry={entry}
                  collapsed={collapsed}
                  isActive={
                    entry.status === 'implemented' &&
                    (pathname === entry.href || pathname.startsWith(`${entry.href}/`))
                  }
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {!isNarrow && (
        <div className="shrink-0 border-t border-border p-2">
          <button
            type="button"
            onClick={() => setUserCollapsed((current) => !current)}
            aria-label={collapsed ? shell.sidebar.expand : shell.sidebar.collapse}
            title={collapsed ? shell.sidebar.expand : shell.sidebar.collapse}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
              collapsed && 'justify-center px-2',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-4 shrink-0" />
            )}
            {!collapsed && <span>{shell.sidebar.collapse}</span>}
          </button>
        </div>
      )}
    </nav>
  );
}

export function NavigationRow({
  entry,
  collapsed,
  isActive,
}: {
  entry: NavigationEntry;
  collapsed: boolean;
  isActive: boolean;
}): React.JSX.Element {
  const Icon = entry.icon;

  if (entry.status === 'planned') {
    return (
      <li>
        <div
          aria-disabled="true"
          title={shell.sidebar.plannedTitle(entry.label)}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground',
            collapsed && 'justify-center px-2',
          )}
        >
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          {collapsed ? (
            <span className="sr-only">{shell.sidebar.plannedTitle(entry.label)}</span>
          ) : (
            <>
              <span className="truncate">{entry.label}</span>
              <span className="ml-auto shrink-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {shell.sidebar.plannedBadge}
              </span>
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={entry.href}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? entry.label : undefined}
        className={cn(
          'relative flex items-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
          collapsed ? 'justify-center px-2' : 'px-3',
          isActive
            ? 'bg-primary/10 font-semibold text-primary-on-surface hover:bg-primary/15'
            : 'text-foreground hover:bg-muted',
        )}
      >
        {isActive ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary"
          />
        ) : null}
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {collapsed ? (
          <span className="sr-only">{entry.label}</span>
        ) : (
          <span className="truncate">{entry.label}</span>
        )}
      </Link>
    </li>
  );
}
