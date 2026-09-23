'use client';

import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useId, useState } from 'react';

import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

export interface ActiveFilterChip {
  id: string;
  label: string;
  removeLabel: string;
  onRemove: () => void;
}

export interface FilterBarProps {
  label: string;
  searchLabel?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filtersLabel?: string;
  children?: ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  activeFilters?: readonly ActiveFilterChip[];
  activeFiltersLabel?: string;
  trailing?: ReactNode;
  searchTrailing?: ReactNode;
  collapsible?: boolean;
  filtersToggleLabel?: string;
  activeFilterCount?: number;
  filtersPanelLabel?: string;
  variant?: 'card' | 'register';
  className?: string;
}

export function FilterBar({
  label,
  searchLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filtersLabel,
  children,
  hasActiveFilters = false,
  onClearFilters,
  clearFiltersLabel = 'Limpar filtros',
  activeFilters = [],
  activeFiltersLabel,
  trailing,
  searchTrailing,
  collapsible = false,
  filtersToggleLabel,
  activeFilterCount,
  filtersPanelLabel,
  variant = 'card',
  className,
}: FilterBarProps): React.JSX.Element {
  const searchId = useId();
  const panelId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showClearAll = hasActiveFilters && Boolean(onClearFilters);
  const showActiveFiltersRow = activeFilters.length > 0 || showClearAll;
  const hasFilterControls = Boolean(children) || Boolean(trailing);
  const showDisclosure = collapsible && hasFilterControls;
  const filtersPanelHidden = collapsible && !filtersOpen;

  const searchBox = searchLabel ? (
    <div className={cn('relative w-full', collapsible ? 'min-w-0 flex-1' : 'sm:max-w-md')}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        id={searchId}
        type="search"
        value={searchValue ?? ''}
        onChange={(event) => onSearchChange?.(event.target.value)}
        placeholder={searchPlaceholder}
        className="h-10 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    </div>
  ) : null;

  if (collapsible && !searchBox) {
    const disclosureButton = showDisclosure ? (
      <button
        type="button"
        aria-expanded={filtersOpen}
        aria-controls={panelId}
        onClick={() => setFiltersOpen((open) => !open)}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-3.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4 text-muted-foreground" />
        {filtersToggleLabel}
        {activeFilterCount ? (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {activeFilterCount}
          </span>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            filtersOpen && 'rotate-180',
          )}
        />
      </button>
    ) : null;

    return (
      <div
        role="search"
        aria-label={label}
        className={cn(
          'flex flex-col gap-2',
          variant === 'register' && 'border-b border-border pb-4',
          className,
        )}
      >
        {disclosureButton || showActiveFiltersRow || searchTrailing ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {disclosureButton}
              {showActiveFiltersRow ? (
                <div
                  role="group"
                  aria-label={activeFiltersLabel}
                  className="flex flex-wrap items-center gap-2"
                >
                  {activeFilters.map((filter) => (
                    <span
                      key={filter.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/70 py-1 pr-1 pl-2.5 text-xs font-medium text-foreground"
                    >
                      {filter.label}
                      <button
                        type="button"
                        onClick={filter.onRemove}
                        aria-label={filter.removeLabel}
                        className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    </span>
                  ))}

                  {showClearAll ? (
                    <button
                      type="button"
                      onClick={onClearFilters}
                      className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {clearFiltersLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {searchTrailing ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">{searchTrailing}</div>
            ) : null}
          </div>
        ) : null}

        {hasFilterControls ? (
          <div
            id={panelId}
            role="group"
            aria-label={filtersPanelLabel}
            hidden={filtersPanelHidden}
            className={
              filtersPanelHidden
                ? undefined
                : 'flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4'
            }
          >
            {filtersPanelHidden ? null : (
              <>
                <div className="flex flex-wrap items-center gap-2">{children}</div>
                {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="search"
      aria-label={label}
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card p-4',
        collapsible ? 'gap-3' : 'gap-4',
        variant === 'register' &&
          'rounded-none border-x-0 border-t-0 bg-transparent px-0 pt-0 pb-4',
        className,
      )}
    >
      {collapsible && (searchBox || showDisclosure) ? (
        <div
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:items-center',
            searchTrailing && 'sm:flex-wrap [&>div:first-of-type]:sm:basis-64',
          )}
        >
          {searchBox ? (
            <label htmlFor={searchId} className="sr-only">
              {searchLabel}
            </label>
          ) : null}
          {searchBox}
          {showDisclosure ? (
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls={panelId}
              onClick={() => setFiltersOpen((open) => !open)}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-3.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <SlidersHorizontal aria-hidden="true" className="size-4 text-muted-foreground" />
              {filtersToggleLabel}
              {activeFilterCount ? (
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  filtersOpen && 'rotate-180',
                )}
              />
            </button>
          ) : null}
          {searchTrailing ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">{searchTrailing}</div>
          ) : null}
        </div>
      ) : null}

      {searchBox && !collapsible ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={searchId} className="text-xs font-medium text-muted-foreground">
            {searchLabel}
          </label>
          {searchBox}
        </div>
      ) : null}

      {hasFilterControls ? (
        <div
          id={panelId}
          role="group"
          aria-label={collapsible ? filtersPanelLabel : undefined}
          hidden={filtersPanelHidden}
          className={cn(
            filtersPanelHidden ? undefined : 'flex flex-wrap items-center gap-2',
            searchLabel ? 'border-t border-border/70 pt-4' : undefined,
          )}
        >
          {filtersPanelHidden ? null : (
            <>
              {filtersLabel && !collapsible ? (
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                  {filtersLabel}
                </span>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">{children}</div>
              {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
            </>
          )}
        </div>
      ) : null}

      {showActiveFiltersRow ? (
        <div
          role="group"
          aria-label={activeFiltersLabel}
          className={cn(
            'flex flex-wrap items-center gap-2',
            collapsible ? undefined : 'border-t border-border/70 pt-4',
          )}
        >
          {activeFiltersLabel && !collapsible ? (
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {activeFiltersLabel}:
            </span>
          ) : null}

          {activeFilters.map((filter) => (
            <span
              key={filter.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/70 py-1 pr-1 pl-2.5 text-xs font-medium text-foreground"
            >
              {filter.label}
              <button
                type="button"
                onClick={filter.onRemove}
                aria-label={filter.removeLabel}
                className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}

          {showClearAll ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {clearFiltersLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
