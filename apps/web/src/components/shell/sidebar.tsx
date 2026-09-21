'use client';

/**
 * PharosGRC application shell — persistent sidebar navigation (T073, FR-039).
 *
 * Renders exclusively from `navigationRegistry` (T071) — no module name,
 * route or icon is hard-coded here. Implemented entries the caller lacks
 * `requiredPermission` for are hidden entirely (FR-042, advisory only —
 * ADR-003); planned entries are always shown, but as non-interactive,
 * clearly labeled items rather than links (FR-043).
 *
 * Wave 2 (CLAUDE.md §18) additions, all purely presentational — the registry
 * itself is untouched:
 *
 * - Brand: the lighthouse mark plus live text, per CLAUDE.md §18.6
 *   ("compose [symbol] + the text 'PharosGRC' rendered by the interface"
 *   rather than an image of the full wordmark). Rendered by `BrandMark`
 *   (`./brand-mark.tsx`), which picks the positive or the inverse asset per
 *   theme. This used to sit the fixed two-tone mark on a permanent white
 *   tile so the navy tone would not vanish against a dark sidebar — which
 *   worked, and put a bright white block in the corner of the dark theme,
 *   brighter than anything else on screen. See that component's header for
 *   why the fix is an inverse ASSET and not a CSS filter.
 * - Section grouping (`navigation-sections.ts`) — GRC modules and
 *   Administration are visually different kinds of thing; Dashboard sits
 *   above both, unlabelled, as the one cross-module entry point.
 * - Planned-module noise: previously every one of the ten planned entries
 *   carried a bordered, filled `StatusBadge` pill — competing visually with
 *   the three real destinations. Replaced with a quiet, unfilled inline
 *   marker (no border, no background, small uppercase caption type) plus
 *   dimmed row content — still individually, honestly labeled (the marker
 *   text, and the `title` tooltip, both still say "planned"), just no
 *   longer loud enough to dominate the list.
 * - Active-item state: a solid left accent bar + brand-colored bold label,
 *   not merely a pale fill — CLAUDE.md §18.11 ("seleção ativa é visível?").
 * - Collapsible: `w-64` <-> `w-16`. Collapsed, labels become `sr-only`
 *   (still in the accessibility tree) and rows fall back to a native
 *   tooltip (`title`); at widths that can afford the expanded rail, the
 *   toggle is always visible, in both states, as the "way back".
 *
 * Narrow-viewport behaviour (defect fix, CLAUDE.md §18.1/§18.11): below the
 * `lg` breakpoint (1024px) the rail collapses automatically and the toggle
 * is not offered at all — there is nothing to expand into, only content to
 * re-crush. 1024px is not an arbitrary pick: it is the same breakpoint the
 * shell already treats as the "has room" threshold for its own content
 * column (`app-shell.tsx`'s `lg:px-(--layout-page-padding-x-lg)`), and a
 * 768px capture with the rail expanded showed multi-line risk codes and
 * two-character card titles — visibly too little room for a 256px rail.
 * Above the breakpoint the user's own explicit choice (`userCollapsed`)
 * governs, and survives narrowing past the breakpoint and back: the media
 * query only ever forces the *narrow* state, it never resets the user's
 * preference, so resizing wide again restores exactly what the user chose
 * last, per CLAUDE.md §18.9 (no silent behavioural surprise).
 *
 * First paint is always the pre-media-query default (expandable, i.e. the
 * rail affords `userCollapsed`'s own state) — the server has no viewport,
 * so the initial render must match what the client commits on hydration.
 * `useSyncExternalStore` (React's own primitive for exactly this — an
 * external, mutable, browser-only source of truth like `matchMedia`) is
 * what makes that safe: `getServerSnapshot` supplies the SSR/hydration
 * value, `getSnapshot` supplies the real measured value, and React itself
 * reconciles the two after mount with an ordinary re-render — never a
 * hydration-mismatch warning (CLAUDE.md §18's "no first paint React then
 * contradicts").
 */
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

/**
 * `lg` in Tailwind's default scale — matches the shell's own "has room"
 * threshold (`app-shell.tsx`'s `lg:px-(--layout-page-padding-x-lg)`), and
 * confirmed against `docs/reviews/ui/after-narrow` (768px, broken with the
 * rail expanded) vs `docs/reviews/ui/after` (1440px, correct).
 */
const SIDEBAR_EXPANDABLE_QUERY = '(min-width: 1024px)';

/** `useSyncExternalStore` subscription to the breakpoint media query. */
function subscribeToExpandableChange(onStoreChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(SIDEBAR_EXPANDABLE_QUERY);
  mediaQueryList.addEventListener('change', onStoreChange);
  return () => mediaQueryList.removeEventListener('change', onStoreChange);
}

/** Real, measured value — only ever read client-side (after mount/on change). */
function getIsExpandable(): boolean {
  return window.matchMedia(SIDEBAR_EXPANDABLE_QUERY).matches;
}

/**
 * SSR/first-paint value: the server has no viewport, so assume the rail
 * fits (matches the pre-existing, pre-breakpoint default) until the real
 * width is measured client-side.
 */
function getIsExpandableServerSnapshot(): boolean {
  return true;
}

interface NavigationGroup {
  section: NavigationSection;
  label: string | null;
  entries: NavigationEntry[];
}

/** Groups already-filtered, already-ordered entries by section, preserving registry order (see module doc). */
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

  // Below the breakpoint the rail is always collapsed, regardless of the
  // user's own choice — that choice is preserved untouched in
  // `userCollapsed` and takes over again the moment the viewport is wide
  // enough to afford the expanded rail (requirement 3: survives a resize
  // round trip).
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

      {/*
       * The rail's scroll region. `min-h-0` states the flex limit that lets it
       * shrink below its content instead of pushing the collapse control below
       * the viewport, so it scrolls only on a window too short for the whole
       * navigation — on a normal window there is no second scrollbar here.
       */}
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

      {/*
       * Below the breakpoint there is nothing to offer: the rail is forced
       * collapsed and expanding it would only re-crush the content (the
       * defect this fix addresses). Omitting the control entirely — rather
       * than rendering it disabled — avoids a button that is visibly
       * present but does nothing when pressed.
       */}
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

/**
 * Exported for `sidebar-planned-entry.test.tsx`, which proves the FR-043
 * rendering of a `status: 'planned'` entry against an explicit fixture.
 * It used to be proven through `Sidebar` itself, against whichever module
 * happened to be unbuilt at the time — the last one ("Planos de Ação") was
 * removed once Action stopped being described as a planned module, and a
 * guard whose subject can vanish that way was proving the registry's
 * contents rather than this renderer's contract.
 */
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
