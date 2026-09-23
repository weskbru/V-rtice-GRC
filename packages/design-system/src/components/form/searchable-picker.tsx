'use client';

import * as Popover from '@radix-ui/react-popover';
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

export interface SearchablePickerOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface SearchablePickerResult {
  readonly options: readonly SearchablePickerOption[];
  readonly isPartial: boolean;
}

export interface SearchablePickerLabels {
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly emptyText: string;
  readonly loadingText: string;
  readonly partialResultsText: (shownCount: number) => string;
  readonly triggerAriaLabel: string;
}

export interface SearchablePickerProps {
  readonly value: SearchablePickerOption | undefined;
  readonly onChange: (option: SearchablePickerOption) => void;
  readonly onSearch: (query: string) => Promise<SearchablePickerResult>;
  readonly labels: SearchablePickerLabels;
  readonly disabled?: boolean;
  readonly debounceMs?: number;
}

export function SearchablePicker({
  value,
  onChange,
  onSearch,
  labels,
  disabled = false,
  debounceMs = 300,
}: SearchablePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchablePickerResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return undefined;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    const timeout = setTimeout(
      () => {
        void onSearch(query)
          .then((next) => {
            if (requestIdRef.current === requestId) {
              setResult(next);
            }
          })
          .catch(() => {
            if (requestIdRef.current === requestId) {
              setResult({ options: [], isPartial: false });
            }
          })
          .finally(() => {
            if (requestIdRef.current === requestId) {
              setIsLoading(false);
            }
          });
      },
      query === '' ? 0 : debounceMs,
    );

    return () => clearTimeout(timeout);
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResult(undefined);
    }
  }, [open]);

  const options = result?.options ?? [];
  const showEmpty = !isLoading && result !== undefined && options.length === 0;
  const showPartialHint = !isLoading && (result?.isPartial ?? false) && options.length > 0;

  const triggerLabel = useMemo(() => value?.label ?? labels.placeholder, [value, labels]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={labels.triggerAriaLabel}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <span className={cn('truncate text-left', !value && 'text-muted-foreground')}>
            {triggerLabel}
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 w-[--radix-popover-trigger-width] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <CommandPrimitive shouldFilter={false} className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search aria-hidden="true" className="size-4 shrink-0 opacity-50" />
              <CommandPrimitive.Input
                value={query}
                onValueChange={setQuery}
                placeholder={labels.searchPlaceholder}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
              {isLoading ? (
                <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin opacity-50" />
              ) : null}
            </div>
            <CommandPrimitive.List className="max-h-72 overflow-y-auto overflow-x-hidden p-1">
              {showEmpty ? (
                <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                  {labels.emptyText}
                </CommandPrimitive.Empty>
              ) : null}
              {isLoading && options.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {labels.loadingText}
                </div>
              ) : null}
              {options.map((option) => {
                const isSelected = option.id === value?.id;
                return (
                  <CommandPrimitive.Item
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    aria-label={
                      option.description ? `${option.label} ${option.description}` : option.label
                    }
                    className={cn(
                      'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none',
                      'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
                    )}
                  >
                    <Check
                      aria-hidden="true"
                      className={cn('size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{option.label}</span>
                      {option.description ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </CommandPrimitive.Item>
                );
              })}
            </CommandPrimitive.List>
            {showPartialHint ? (
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                {labels.partialResultsText(options.length)}
              </div>
            ) : null}
          </CommandPrimitive>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
