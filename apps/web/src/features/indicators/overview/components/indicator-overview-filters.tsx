'use client';

/**
 * PharosGRC — search + domain filter toolbar for the redesigned
 * `/indicators` first screen (indicators-round, S1 ownership, coordinator
 * PLAN.md §2 step 3, refined per the coordinator's rendered review of the
 * first pass).
 *
 * ## Two visually distinct pieces, not one boxed toolbar
 *
 * The first pass put both search AND the domain toggle group inside
 * `FilterBar`'s single bordered card as sibling "filter controls" — at 1440
 * that produced a visibly boxed radiogroup wrapping to 2 rows inside an
 * already-bordered card; at 390 it wrapped to roughly 7 rows, the rendered
 * review's own measurement. This version separates the two:
 *
 *   - **Search** — `FilterBar` in its `collapsible` disposition WITH NO
 *     CHILDREN. `hasFilterControls` is then `false`
 *     (`packages/design-system/src/components/data-table/filter-bar.tsx`'s
 *     own logic), so `FilterBar` renders exactly one thing: the search box,
 *     full width, with a screen-reader-only label (no visible "Buscar
 *     indicadores" caption above it) — never the disclosure button, since
 *     there are no filter controls behind it to disclose. `hasActiveFilters`
 *     still covers BOTH search and domain, so "Limpar filtros" still appears
 *     under the search box the moment either one is active.
 *   - **Domain** — `ViewToggle` (the SAME keyboard-operable, single-choice
 *     `role="radiogroup"` segmented control every Cards/Tabela toggle in
 *     this codebase already uses), stripped of its own default border/
 *     background/padding via `className` overrides (`border-0 bg-transparent
 *     p-0 shadow-none` — `tailwind-merge` resolves each against the
 *     component's own base classes, never leaving two conflicting border
 *     declarations) so it reads as a light, unboxed row of pills rather than
 *     a second bordered card sitting inside the first. Individual segments
 *     keep their own selected/unselected pill styling
 *     (`view-toggle.tsx`'s own per-button classes) — only the OUTER
 *     container's chrome is removed.
 *
 * ## Wrap from `md` up; scroll only below it — never hide a filter behind a
 * ## chevron on a desktop-width monitoring screen
 *
 * The first cut of this refinement made the row scroll (`overflow-x-auto`,
 * an edge fade/chevron) at EVERY width, including 1440 — measured directly:
 * an 11-segment row is ~1366px wide, wider than the ~1120px visible area
 * even at 1440px main width, so "Auditoria"/"Achados" sat scrolled out of
 * view with only a chevron hinting they existed. The coordinator's own
 * second review named this correctly: a monitoring screen must not hide a
 * filter OPTION behind a scroll gesture on a screen this wide — a manager
 * scanning available domains at a desk should see all eleven without
 * discovering an affordance first. Segments are now also TEXT-ONLY (no
 * per-domain icon on the pill itself — `IndicatorDomainCaption` already
 * prints that icon on every card below, so the pill row does not need a
 * second copy of it), which alone recovers meaningful width per segment.
 *
 * `md:flex-wrap md:w-full` on `ViewToggle` lets the row wrap into 1-2 lines
 * from `md` (768px) up — verified at 1024 and 1440 that a plain CSS wrap is
 * enough for every one of the 11 segments to be simultaneously visible with
 * no scrolling at all. Below `md`, the row keeps `useHorizontalScrollEdges`'
 * own scroll-with-edge-cue behaviour from the first refinement (`w-max`, no
 * wrap) — a 390px phone genuinely cannot fit 11 segments in 1-2 rows without
 * pushing the sections far down the page, so a horizontal strip stays the
 * right trade-off there, never higher up.
 *
 * The scroll-edge hook below is now a no-op at `md`+ by construction, not by
 * a special case: once the row wraps instead of overflowing horizontally,
 * `scrollWidth` never exceeds `clientWidth`, so `canScrollBack`/
 * `canScrollForward` measure `false` on their own and the fade/chevron
 * simply never render — the exact same measurement this file's first pass
 * already had, now correct for both dispositions without an added branch.
 */
import { FilterBar, ViewToggle } from '@pharos/design-system/components';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { common } from '@/lib/messages/common';
import { indicators } from '@/lib/messages/indicators';

import type { IndicatorDomain } from '../indicator-overview-model';

const SCROLL_STEP_PX = 160;

/** See this file's own header — a local reproduction of `EntityTabs`'s own `useHorizontalOverflow`, sized for one container instead of two refs (this row has no separate "content" node narrower than its scroll container). */
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

    // 1px tolerance absorbs sub-pixel rounding from browser zoom/DPI — see
    // `useHorizontalOverflow`'s own identical comment.
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
  /** Present items in this domain — always ≥ 1 (a domain with zero items is never offered as a chip). */
  readonly count: number;
}

export interface IndicatorOverviewFiltersProps {
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  /** The closed catalog's own total (11) — used for the "Todos (N)" segment, never derived from `domainOptions` (which only lists domains actually present). */
  readonly totalCount: number;
  /** Only domains with at least one item, in sidebar order (`sortByIndicatorDomainOrder`/`buildIndicatorDomainCounts`, `../filter-indicator-items.ts`). */
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

  // Text-only — `IndicatorDomainCaption` already prints each domain's icon
  // on every card below, so the pill itself does not repeat it (this file's
  // own header).
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
