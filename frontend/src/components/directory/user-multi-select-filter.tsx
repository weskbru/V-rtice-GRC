'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown, Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { common } from '@/lib/messages/common';
import { cn } from '@/lib/utils';

import type { UserOption, UserSearchResult } from './user-option';

export interface UserMultiSelectFilterLabels {
  readonly label: string;
  readonly clearLabel?: string;
}

export interface UserMultiSelectFilterProps {
  readonly labels: UserMultiSelectFilterLabels;
  readonly selected: readonly string[];
  readonly onChange: (next: readonly string[]) => void;
  readonly onSearch: (query: string) => Promise<UserSearchResult>;
  readonly knownUsers?: ReadonlyMap<string, UserOption>;
  readonly disabled?: boolean;
  readonly className?: string;
}

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
  const [seen, setSeen] = useState<ReadonlyMap<string, UserOption>>(new Map());

  useEffect(() => {
    if (!open) return undefined;
    const requestId = ++requestIdRef.current;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  useEffect(() => {
    if (!open) {
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

export type { UserOption, UserSearchResult };
