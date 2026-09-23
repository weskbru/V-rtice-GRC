'use client';

import { FilterBar, ViewToggle } from '@pharos/design-system/components';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { common } from '@/lib/messages/common';
import { indicators } from '@/lib/messages/indicators';

import type { IndicatorDomain } from '../indicator-overview-model';

const SCROLL_STEP_PX = 160;

function useHorizontalScrollEdges(): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canScrollBack: boolean;
  canScrollForward: boolean;
  scrollBy: (deltaPx: number) => void;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure(): void {
      if (!container) return;
      setCanScrollBack(container.scrollLeft > 1);
      setCanScrollForward(container.scrollLeft + container.clientWidth < container.scrollWidth - 1);
    }

    measure();
    container.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => {
      container.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, []);

  function scrollBy(deltaPx: number): void {
    containerRef.current?.scrollBy({ left: deltaPx, behavior: 'smooth' });
  }

  return { containerRef, canScrollBack, canScrollForward, scrollBy };
}

const ALL_DOMAINS = 'ALL' as const;

export type IndicatorDomainFilterValue = IndicatorDomain | typeof ALL_DOMAINS;

export interface IndicatorDomainFilterOption {
  readonly value: IndicatorDomain;
  readonly count: number;
}

export interface IndicatorOverviewFiltersProps {
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly totalCount: number;
  readonly domainOptions: readonly IndicatorDomainFilterOption[];
  readonly activeDomain: IndicatorDomainFilterValue;
  readonly onDomainChange: (value: IndicatorDomainFilterValue) => void;
  readonly hasActiveFilters: boolean;
  readonly onClearFilters: () => void;
}

export function IndicatorOverviewFilters({
  query,
  onQueryChange,
  totalCount,
  domainOptions,
  activeDomain,
  onDomainChange,
  hasActiveFilters,
  onClearFilters,
}: IndicatorOverviewFiltersProps): React.JSX.Element {
  const filters = indicators.overview.filters;
  const { containerRef, canScrollBack, canScrollForward, scrollBy } = useHorizontalScrollEdges();

  const toggleOptions = [
    { value: ALL_DOMAINS, label: filters.domainAll(totalCount) },
    ...domainOptions.map((option) => ({
      value: option.value,
      label: filters.domainOption(indicators.overview.domainLabels[option.value], option.count),
    })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        label={filters.regionLabel}
        searchLabel={filters.searchLabel}
        searchValue={query}
        onSearchChange={onQueryChange}
        searchPlaceholder={filters.searchPlaceholder}
        collapsible
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        clearFiltersLabel={common.actions.clearFilters}
      />

      <div className="relative">
        <div ref={containerRef} className="overflow-x-auto scroll-smooth">
          <ViewToggle<IndicatorDomainFilterValue>
            label={filters.domainGroupLabel}
            options={toggleOptions}
            value={activeDomain}
            onChange={onDomainChange}
            className="h-auto w-max border-0 bg-transparent p-0 shadow-none md:h-auto md:w-full md:flex-wrap"
          />
        </div>

        {canScrollBack ? (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent"
            />
            <button
              type="button"
              aria-label={filters.scrollBack}
              onClick={() => scrollBy(-SCROLL_STEP_PX)}
              className="absolute inset-y-0 left-0 flex w-6 items-center justify-center text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
          </>
        ) : null}

        {canScrollForward ? (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
            />
            <button
              type="button"
              aria-label={filters.scrollForward}
              onClick={() => scrollBy(SCROLL_STEP_PX)}
              className="absolute inset-y-0 right-0 flex w-6 items-center justify-center text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
