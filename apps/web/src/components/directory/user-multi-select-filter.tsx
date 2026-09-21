'use client';

/**
 * PharosGRC — S-10, the multi-select sibling of `UserPicker` for register
 * filter toolbars (risk/control owner, and any future multi-value user
 * filter). `@pharos/design-system`'s own `MultiSelectFilter` has no search —
 * it is correct for bounded option sets (status, category, risk level) but
 * was never meant for an unbounded directory, and this component does not
 * modify it (owned by another workstream this phase; CLAUDE.md §18.3 still
 * applies: reuse its exact visual language — trigger button with a count
 * badge, popover panel, checkbox rows, `clear` action — rather than invent
 * a third one). The search row itself (icon, input, loading spinner) copies
 * `SearchablePicker`'s own markup verbatim for the same reason.
 *
 * ## Resolving a label for an ALREADY-selected id outside the current search
 *
 * `GET /users` (`list-directory-users-query.dto.ts`) accepts `q` (name/
 * e-mail) and `assignableForOrgUnitId`, never a lookup by id, and no id-based
 * endpoint is reachable without administrative permission
 * (`GET /admin/users/{userId}` requires `user:administer`) — so a filter
 * value persisted in the URL cannot always be re-resolved to a name by this
 * component alone. `knownUsers` lets the caller pass in labels it already
 * has for free — every register view already renders each row's own
 * owner/lead-auditor object, so a selected id that matches at least one
 * visible row (the common case: that is usually WHY the filter matched
 * anything) resolves with no extra request. When a selected id is in
 * neither `knownUsers` nor anything this component has itself searched up
 * so far, it falls back to showing the raw id — the same degraded, but
 * never silently wrong, behaviour the register filters already had before
 * this fix, now scoped to a documented, residual edge case instead of the
 * common one (S-10's actual defect).
 */
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown, Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { common } from '@/lib/messages/common';
import { cn } from '@/lib/utils';

import type { UserOption, UserSearchResult } from './user-option';

export interface UserMultiSelectFilterLabels {
  /** Visible trigger text AND the popover panel's accessible name (e.g. "Responsável"). */
  readonly label: string;
  readonly clearLabel?: string;
}

export interface UserMultiSelectFilterProps {
  readonly labels: UserMultiSelectFilterLabels;
  readonly selected: readonly string[];
  readonly onChange: (next: readonly string[]) => void;
  readonly onSearch: (query: string) => Promise<UserSearchResult>;
  /** Labels for already-selected ids the caller already knows about (e.g.
   * derived from the currently loaded register rows) — see this file's own
   * header for why this exists instead of a by-id lookup. */
  readonly knownUsers?: ReadonlyMap<string, UserOption>;
  readonly disabled?: boolean;
  readonly className?: string;
}

/** Debounce window — mirrors `SearchablePicker`'s own default exactly. */
const DEBOUNCE_MS = 300;

export function UserMultiSelectFilter({
  labels,
  selected,
  onChange,
  onSearch,
  knownUsers,
  disabled = false,
  className,
}: UserMultiSelectFilterProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<UserSearchResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);
  // Every user this component has ever seen (any search result, plus
  // `knownUsers`) — accumulated so a row already shown once does not lose
  // its name if it scrolls out of the current search result set.
  const [seen, setSeen] = useState<ReadonlyMap<string, UserOption>>(new Map());

  useEffect(() => {
    if (!open) return undefined;
    const requestId = ++requestIdRef.current;

    // Nested and invoked, rather than a bare top-level `setState` in the
    // effect body — `react-hooks/set-state-in-effect` (a synchronous
    // setState directly in an effect risks a cascading render); one that
    // kicks off an async fetch and reports its outcome does not. Mirrors
    // `RiskForm`'s own identical `run()`/`void run()` shape.
    function start(): ReturnType<typeof setTimeout> {
      setIsLoading(true);
      return setTimeout(
        () => {
          void onSearch(query)
            .then((next) => {
              if (requestIdRef.current !== requestId) return;
              setResult(next);
              setSeen((current) => {
                const merged = new Map(current);
                for (const user of next.data) merged.set(user.id, user);
                return merged;
              });
            })
            .catch(() => {
              if (requestIdRef.current === requestId) setResult({ data: [], isPartial: false });
            })
            .finally(() => {
              if (requestIdRef.current === requestId) setIsLoading(false);
            });
        },
        query === '' ? 0 : DEBOUNCE_MS,
      );
    }

    const timeout = start();
    return () => clearTimeout(timeout);
    // `onSearch` deliberately excluded — same reasoning as `SearchablePicker`
    // (`packages/design-system/src/components/form/searchable-picker.tsx`):
    // it is expected to be referentially stable per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      // Nested and invoked — same `react-hooks/set-state-in-effect` reasoning as above.
      function reset(): void {
        setQuery('');
        setResult(undefined);
      }
      reset();
    }
  }, [open]);

  const resolvedLabels = useMemo(() => {
    const merged = new Map(seen);
    if (knownUsers) {
      for (const [id, user] of knownUsers) if (!merged.has(id)) merged.set(id, user);
    }
    return merged;
  }, [seen, knownUsers]);

  function labelFor(id: string): string {
    return resolvedLabels.get(id)?.fullName ?? id;
  }

  function toggle(id: string): void {
    if (selected.includes(id)) {
      onChange(selected.filter((entry) => entry !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  const options = result?.data ?? [];
  const showEmpty = !isLoading && result !== undefined && options.length === 0;
  const showPartialHint = !isLoading && (result?.isPartial ?? false) && options.length > 0;
  // Selected ids not present in the current search result still need a row
  // so the user can see what is active and clear it from here too.
  const selectedNotInResults = selected.filter((id) => !options.some((user) => user.id === id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="true"
          aria-expanded={open}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span>{labels.label}</span>
          {selected.length > 0 ? (
            <span
              aria-hidden="true"
              className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              {selected.length}
            </span>
          ) : null}
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-72 overflow-hidden p-0">
        <CommandPrimitive shouldFilter={false} className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search aria-hidden="true" className="size-4 shrink-0 opacity-50" />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder={common.userPicker.searchPlaceholder}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isLoading ? (
              <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin opacity-50" />
            ) : null}
          </div>
          <CommandPrimitive.List
            role="group"
            aria-label={labels.label}
            className="max-h-72 overflow-y-auto overflow-x-hidden p-1"
          >
            {selectedNotInResults.length > 0 ? (
              <div className="flex flex-col gap-0.5 border-b border-border pb-1">
                {selectedNotInResults.map((id) => (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggle(id)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span className="truncate">{labelFor(id)}</span>
                  </label>
                ))}
              </div>
            ) : null}

            {showEmpty ? (
              <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                {common.userPicker.emptyText}
              </CommandPrimitive.Empty>
            ) : null}
            {isLoading && options.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {common.searchablePicker.loadingText}
              </div>
            ) : null}
            {options.map((user) => {
              const checked = selected.includes(user.id);
              return (
                <CommandPrimitive.Item
                  key={user.id}
                  value={user.id}
                  onSelect={() => toggle(user.id)}
                  aria-label={user.email ? `${user.fullName} ${user.email}` : user.fullName}
                  className="relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <Check
                    aria-hidden="true"
                    className={cn('size-4 shrink-0', checked ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{user.fullName}</span>
                    {user.email ? (
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    ) : null}
                  </span>
                </CommandPrimitive.Item>
              );
            })}
          </CommandPrimitive.List>
          {showPartialHint ? (
            <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {common.searchablePicker.partialResultsText(options.length)}
            </div>
          ) : null}
          {selected.length > 0 ? (
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {labels.clearLabel ?? common.userPicker.clearLabel}
              </button>
            </div>
          ) : null}
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  );
}

/** Re-exported so callers don't need a second import for the same shape `UserPicker` already exports. */
export type { UserOption, UserSearchResult };
