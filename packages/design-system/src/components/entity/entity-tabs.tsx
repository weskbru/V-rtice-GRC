'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

import type { ComponentType, ReactNode, SVGProps } from 'react';

export interface EntityTab {
  /** Stable slug — used as the Radix tab value and the React key. Never shown to the user. */
  id: string;
  label: string;
  content: ReactNode;
  /**
   * Optional discrete icon rendered ahead of `label`, inside the SAME
   * trigger element — icon and text are one interactive unit, never two
   * separate elements sharing a click target. Always `aria-hidden`: this
   * tab's accessible name stays exactly `label`, unchanged, because
   * `getByRole('tab', { name: … })` across the E2E suite depends on it
   * (017-risk-overview-polish). Purely decorative scan-aid — never the only
   * carrier of which section is which (CLAUDE.md §18.8).
   *
   * Ignored when this `EntityTabs` is `subordinate` (below): the caller
   * asked for icons on level-1 groups only, never on a level-2 leaf strip,
   * and gating it here — rather than trusting every future caller to leave
   * `icon` off subordinate tabs by convention — makes that hierarchy
   * impossible to violate by accident.
   */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * Whether this section is visible to the current user. Defaults to `true`.
   * Set to `false` — never render the tab with a `disabled` control — for a
   * section the caller is not authorized to see: `EntityTabs` omits it
   * entirely from both the tab list and the rendered content, exactly as
   * data-model.md §3 requires ("Risk detail section visibility") so an
   * unauthorized section's very existence is never disclosed (FR-030,
   * FR-094). A *disabled-but-visible* tab would leak that the section
   * exists; omission is the only correct treatment.
   */
  visible?: boolean;
}

export interface EntityTabsScrollLabels {
  /** Accessible name for the button that scrolls the tab strip left/back. */
  scrollBack: string;
  /** Accessible name for the button that scrolls the tab strip right/forward. */
  scrollForward: string;
}

/**
 * Controlled/uncontrolled selection, as a pair or not at all — the same
 * "pair, or neither" discipline `DetailPanelCloseProps` already established
 * for `onClose`/`closeLabel`. `exactOptionalPropertyTypes` (this
 * workspace's own `tsconfig.base.json`) rejects handing Radix's
 * `onValueChange` an `undefined` value even when the PROP itself is
 * optional, so this cannot be two independently-optional fields — a value
 * without a handler would either not compile or silently do nothing on
 * click, and a union makes the second outcome impossible to write by
 * accident.
 */
type EntityTabsControlProps =
  | {
      /**
       * Selected tab id, for a caller that needs to drive selection itself
       * — 016-risk-detail-experience's deep-linked, two-level navigation
       * being the first (a risk's outer group strip and each group's own
       * leaf strip are both `EntityTabs`, both kept in step with the page's
       * `?section=` URL state).
       *
       * A `value` naming a tab that is absent or not currently `visible` —
       * a stale deep link, or a permission that came off — resolves the
       * same way `defaultTabId` always has: silently to the first visible
       * tab, never to nothing selected. The caller finds out its requested
       * id lost by reading back the id `onValueChange`/its own resolution
       * logic settled on, never by this component throwing or rendering
       * blank.
       */
      value: string;
      /** Called with the id of the tab the user selected. */
      onValueChange: (value: string) => void;
    }
  | { value?: undefined; onValueChange?: undefined };

export type EntityTabsProps = EntityTabsControlProps & {
  /** All candidate sections, in display order. Pass every section unconditionally and control visibility with each tab's own `visible` flag — filtering the array yourself works too, but `visible` keeps every call site symmetric with the section-visibility table it mirrors. */
  tabs: readonly EntityTab[];
  /** Tab id to select initially. Falls back to the first visible tab when omitted or when it names a tab that is absent/not visible. Ignored when `value` is supplied (controlled mode) — omit both for the original uncontrolled behaviour every caller before 016 still uses unchanged. */
  defaultTabId?: string;
  /**
   * Accessible name for the tab list, e.g. "Seções do registro". Required,
   * never defaulted inside the component — like `DataTableLabels`/
   * `RiskLevelBadgeLabels`, `packages/design-system` must not depend on
   * `apps/web`'s pt-BR message catalog, so every caller supplies this from
   * its own source (D-10).
   */
  ariaLabel: string;
  /**
   * Accessible names for the scroll-affordance chevrons (below). Required
   * for the same D-10 reason as `ariaLabel` — this package carries no
   * user-facing strings of its own, so the caller's own message catalog is
   * the only legitimate source, even though the buttons themselves are
   * rendered only when the tab strip actually overflows.
   */
  scrollLabels: EntityTabsScrollLabels;
  /**
   * `'compact'` is IDENTICAL to `'default'` (the original inline,
   * single-line-per-tab pill row) at Tailwind's `sm` breakpoint (640px) and
   * wider — it only changes anything BELOW `sm`, where the row becomes
   * `flex-wrap`: each tab keeps its own natural, content-sized width and
   * wraps onto a second line, as a whole tab, when the first line is full.
   *
   * Two earlier shapes of this were measured wrong and corrected
   * (2026-09-16, V1, in the same rodada):
   *
   *   1. First cut: the grid was applied unconditionally, at every width
   *      (V2). Every tab became an equal fraction of the FULL container
   *      even at 1440px, so "Visão geral" sat pinned to the far left edge
   *      and "Registro" to the far right, spread across the whole row
   *      instead of grouped together the way the pill row always read.
   *      Fixed by scoping the override to `max-sm:` only.
   *   2. Second cut, still `max-sm:` only: an EQUAL-WIDTH grid (one column
   *      per tab). A grid's width is bounded by its parent rather than the
   *      sum of its labels, so it cannot overflow — but the five pt-BR
   *      labels are not equal length, and an equal share left
   *      "Relacionamentos" (roughly 2.5x "Análise") wider than its own
   *      cell, overflowing text into the neighbour. Measured directly:
   *      gaps between the BOXES were real and present, but the LABEL
   *      TEXT still crossed the boundary, reading as one glued word
   *      despite the gap. Reducing type size further does not fix an
   *      overflow of this size (still true at 10px against a 52.8px cell).
   *
   * `flex-wrap` fixes both at once: no tab is ever narrower than the text
   * it holds (nothing to overflow), and the row's own width is still
   * bounded by its container (nothing to scroll) because tabs that do not
   * fit the current line wrap as whole units onto the next one — this is
   * what a risk's five frozen labels (§4.4 — shortening them was explicitly
   * ruled out) need: "Visão geral · Análise · Resposta" on one line,
   * "Relacionamentos · Registro" on the next, at 390px.
   *
   * Defaults to `'default'` — the original inline row every caller before
   * this one still gets unchanged at every width.
   */
  size?: 'default' | 'compact';
  /**
   * A visually lighter treatment — no filled pill container, a bottom-
   * border active indicator instead of a background chip, smaller text —
   * for an `EntityTabs` that is subordinate to ANOTHER `EntityTabs` above
   * it (016-risk-detail-experience P4: risk detail's two navigation levels
   * read as "two rows of the same thing" when both used the identical pill
   * styling). Defaults to `false`; every caller with only one level of
   * tabs leaves this unset.
   */
  subordinate?: boolean;
  className?: string;
};

/** How far a chevron click scrolls the strip, in CSS pixels. Roughly two to three tab widths — enough to feel like real progress without jumping past the next hidden tab entirely. */
const SCROLL_STEP_PX = 160;

/**
 * Tracks whether `node` has more content hidden past its left and/or right
 * edge, re-measuring on scroll and on resize of either the scroll container
 * itself or its (possibly wider) content — a narrow viewport's container
 * shrinking is exactly as relevant as the tab strip's own content growing
 * when a section is added, and only a live measurement (not a one-time
 * mount check) stays correct across both (CLAUDE.md §18.2's Fix 2 — no
 * always-visible scrollbar, just an honest, restrained cue that content is
 * actually clipped).
 */
function useHorizontalOverflow(): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  canScrollBack: boolean;
  canScrollForward: boolean;
  scrollBy: (deltaPx: number) => void;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // A 1px tolerance absorbs sub-pixel rounding from browser zoom/DPI —
    // without it, a fully-scrolled container can still read as
    // `scrollLeft + clientWidth` a fraction short of `scrollWidth` and
    // leave a chevron rendered with nowhere left to go.
    function measure(): void {
      if (!container) return;
      setCanScrollBack(container.scrollLeft > 1);
      setCanScrollForward(container.scrollLeft + container.clientWidth < container.scrollWidth - 1);
    }

    measure();
    container.addEventListener('scroll', measure, { passive: true });

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (contentRef.current) observer.observe(contentRef.current);

    return () => {
      container.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, []);

  function scrollBy(deltaPx: number): void {
    containerRef.current?.scrollBy({ left: deltaPx, behavior: 'smooth' });
  }

  return { containerRef, contentRef, canScrollBack, canScrollForward, scrollBy };
}

/**
 * Platform-wide section navigation for a GRC record's detail screen (T094,
 * FR-093, FR-094). Every business module's detail page — risk today, a
 * future problem, incident or control — presents its sections through this
 * one component, so a new module never needs a new tab pattern (SC-011).
 *
 * Section visibility is enforced by omission, not by disabling: a tab whose
 * `visible` is `false` never appears in the tab list and its content is
 * never mounted. This is a UI courtesy only (ADR-003) — the same section's
 * own data is independently withheld by the server regardless of what this
 * component renders — but it must still never render a visibly-disabled
 * "Audit" tab to a user without `audit:view`, since a disabled control still
 * discloses that the section exists (FR-030).
 *
 * ## Scroll affordance (assurance-audit Fix 2)
 *
 * A record with enough sections — the risk detail screen had a flat strip of
 * fourteen before 016-risk-detail-experience regrouped it into a two-level
 * navigation, itself two stacked instances of this same component — can
 * outgrow even a wide viewport, let alone a narrow one. The tab strip
 * already scrolled horizontally on its own (the `overflow-x-auto` wrapper
 * below), but nothing signalled that more tabs existed past the edge: at
 * 1440px a later tab sat beyond the fold with no fade, no chevron, no
 * scrollbar hint, and at 768px most of the strip was simply invisible. An
 * edge fade plus a chevron are rendered on each side ONLY when this
 * component's own measurement says that side is actually clipped — never
 * decoratively, and never an always-visible scrollbar (CLAUDE.md §18.5's
 * information-density preference).
 *
 * ## Controlled or uncontrolled (016-risk-detail-experience R-11)
 *
 * Both, deliberately, mirroring `DisclosureGroup`'s own controlled/
 * uncontrolled split. A caller that needs another part of the screen —
 * a contextual aside, a `?section=` URL — to drive or observe which tab is
 * active passes `value`/`onValueChange`; everyone else keeps passing nothing
 * (or `defaultTabId`) and this component owns the selection itself, exactly
 * as it always has.
 */
export function EntityTabs(props: EntityTabsProps): React.JSX.Element | null {
  const {
    tabs,
    defaultTabId,
    ariaLabel,
    scrollLabels,
    size = 'default',
    subordinate = false,
    className,
  } = props;
  const visibleTabs = tabs.filter((tab) => tab.visible !== false);
  const { containerRef, contentRef, canScrollBack, canScrollForward, scrollBy } =
    useHorizontalOverflow();

  if (visibleTabs.length === 0) {
    return null;
  }

  // `props.value`/`props.onValueChange` are read from `props` directly
  // (never destructured into standalone locals above) so TypeScript keeps
  // narrowing them together as the `EntityTabsControlProps` union they are —
  // destructuring them apart would widen each back to independently
  // optional and reintroduce the exact `exactOptionalPropertyTypes` error
  // the union exists to prevent.
  const requestedValue = props.value ?? defaultTabId;
  const resolvedValue = visibleTabs.some((tab) => tab.id === requestedValue)
    ? requestedValue!
    : visibleTabs[0]!.id;

  const rootProps =
    props.value !== undefined
      ? { value: resolvedValue, onValueChange: props.onValueChange }
      : { defaultValue: resolvedValue };

  return (
    <TabsPrimitive.Root {...rootProps} className={cn('flex flex-col gap-4', className)}>
      {/*
       * A record with many sections (risk detail's own two-level navigation
       * is the reason `size`/`subordinate` exist above) can genuinely
       * outgrow a narrow viewport's width. The app shell clips
       * horizontal overflow at the page level (`overflow-hidden`, T203) so
       * a tab past the edge would otherwise be not just visually cut off
       * but entirely unreachable — no scrollbar, no way to click it. This
       * wrapper scrolls horizontally ON ITS OWN instead, so every tab stays
       * reachable at any supported viewport width without the page itself
       * ever scrolling sideways (CLAUDE.md §18.11's viewport question). The
       * relative wrapper around it hosts the edge fade/chevron overlays
       * below, positioned against the scroll container rather than the page.
       */}
      <div className="relative">
        <div ref={containerRef} className="overflow-x-auto scroll-smooth">
          <TabsPrimitive.List
            ref={contentRef}
            className={cn(
              'text-muted-foreground',
              subordinate
                ? 'inline-flex w-fit items-center gap-4 border-b border-border'
                : cn(
                    'inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]',
                    // `max-sm:` ONLY — see `size`'s own doc comment on why
                    // this must never apply at `sm` and wider (V2).
                    //
                    // `flex-wrap`, not an equal-width grid (corrected
                    // 2026-09-16, V1 measured a second time): a grid gives
                    // every tab the SAME column width, but the five labels
                    // are not the same length — "Relacionamentos" measured
                    // roughly 2.5x "Análise". Forcing it into an equal
                    // share left its own text wider than its own cell,
                    // overflowing into the neighbour and reading as one
                    // glued word despite a real gap existing between the
                    // boxes themselves. Letting each tab size to its own
                    // content and WRAP as a whole unit onto a second line
                    // fits the frozen five-label contract without cutting
                    // any label short of the width it actually needs.
                    size === 'compact' && 'max-sm:w-full max-sm:flex-wrap max-sm:gap-1.5',
                  ),
            )}
            aria-label={ariaLabel}
          >
            {visibleTabs.map((tab) => {
              // Gated on `subordinate`, not just left to callers not to pass
              // it — see `EntityTab.icon`'s own doc comment.
              const Icon = !subordinate ? tab.icon : undefined;
              return (
                <TabsPrimitive.Trigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    'font-medium transition-all',
                    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    subordinate
                      ? cn(
                          'rounded-none border-b-2 border-transparent px-1 py-2 text-xs whitespace-nowrap text-muted-foreground',
                          'hover:text-foreground',
                          'data-[state=active]:border-foreground data-[state=active]:text-foreground',
                        )
                      : cn(
                          'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap text-foreground/80',
                          // text-foreground/60 measured at 4.49:1 against the
                          // tablist's bg-muted background — just under the
                          // 4.5:1 WCAG 1.4.3 threshold for 14px text (T203 axe
                          // finding). /80 clears it with margin in both themes.
                          'hover:text-foreground',
                          'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                          // `max-sm:` ONLY, same reasoning as the `List`
                          // above — at `sm` and wider this is byte-for-byte
                          // the same trigger `'default'` renders. Still one
                          // line (`whitespace-nowrap`, inherited from the base
                          // classes above — never overridden here): a tab
                          // wraps as a WHOLE unit onto the next row when the
                          // current one is full, never mid-label.
                          size === 'compact' && 'max-sm:h-7 max-sm:px-2 max-sm:text-xs',
                        ),
                  )}
                >
                  {/* `aria-hidden` — the trigger's accessible name stays
                   * exactly `tab.label`, never "icon description + label"
                   * (see `EntityTab.icon`'s own doc comment). Icon and text
                   * are one child sequence of the SAME trigger, never a
                   * separate element. */}
                  {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
                  {tab.label}
                </TabsPrimitive.Trigger>
              );
            })}
          </TabsPrimitive.List>
        </div>

        {canScrollBack ? (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent"
            />
            <button
              type="button"
              aria-label={scrollLabels.scrollBack}
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
              aria-label={scrollLabels.scrollForward}
              onClick={() => scrollBy(SCROLL_STEP_PX)}
              className="absolute inset-y-0 right-0 flex w-6 items-center justify-center text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </>
        ) : null}
      </div>

      {visibleTabs.map((tab) => (
        <TabsPrimitive.Content key={tab.id} value={tab.id} className="outline-none">
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
