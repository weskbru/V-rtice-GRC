'use client';

import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useId, useState } from 'react';

import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

/**
 * One active filter, rendered as a removable chip in the "active filters"
 * row (CLAUDE.md §18.11 — "Filtros ativos são visíveis?"). The caller (a
 * feature's own filter toolbar, which alone knows what each filter value
 * means) decides which of its own filters currently qualify as "active" and
 * supplies one chip per filter *field* — not one per selected value inside a
 * multi-select, which would make a five-status filter unreadable as five
 * chips — with a caller-composed `removeLabel` so the chip's accessible name
 * is a full sentence ("Remover filtro: Status (2)"), not a bare "×".
 */
export interface ActiveFilterChip {
  /** Stable key, e.g. the filter field name ("status", "q"). */
  id: string;
  /** Visible chip text, e.g. "Status (2)" or 'Busca: "fornecedor"'. */
  label: string;
  /** Accessible name for this chip's remove button. */
  removeLabel: string;
  onRemove: () => void;
}

export interface FilterBarProps {
  /** Accessible name for the `role="search"` landmark wrapping the whole bar, e.g. "Filtros do registro de riscos". */
  label: string;
  /** Accessible label for the built-in search input. Renders no search box when omitted. */
  searchLabel?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Small caption in front of the filter controls row, e.g. "Filtros" — purely a visual grouping cue, omitted when not supplied. */
  filtersLabel?: string;
  /** Additional filter controls — `MultiSelectFilter`, a native `<select>`, a toggle — each responsible for its own accessible label. */
  children?: ReactNode;
  /** Only rendered when true — a "clear filters" control that does nothing has no reason to be on screen. */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  /**
   * One chip per currently-active filter field, shown in a dedicated row
   * beneath the filter controls alongside the "clear all" action — so a user
   * can see *which* filters narrowed the results, and remove exactly one,
   * without opening every dropdown to check. Omit (or pass an empty array)
   * when the caller has no per-filter breakdown to offer; `hasActiveFilters`/
   * `onClearFilters` alone still render the "clear all" action in that case.
   */
  activeFilters?: readonly ActiveFilterChip[];
  /** Accessible/visible heading for the active-filters row, e.g. "Filtros ativos". Required whenever `activeFilters` is non-empty. */
  activeFiltersLabel?: string;
  /** Right-aligned slot, e.g. `ColumnVisibilityMenu` — rendered inline at the end of the filter-controls row, never on a row of its own. */
  trailing?: ReactNode;
  /** Optional presentation controls beside search in the collapsible disposition. */
  searchTrailing?: ReactNode;
  /**
   * Puts the filter controls behind a "Filtros" disclosure button instead of
   * leaving every one of them permanently on screen, so a register opens
   * with search + active filters + results rather than with a wall of
   * controls the reader has to scroll past to reach the first record.
   *
   * Opt-in, and deliberately so: a screen with two filters loses more to the
   * extra click than it gains in height, and the registers that already fit
   * keep their controls inline by simply not passing this.
   *
   * The open/closed state is local to the component — it is presentation,
   * not a filter, so it never reaches the URL and a shared link never
   * carries someone else's panel position.
   */
  collapsible?: boolean;
  /** Visible text of the disclosure button (e.g. "Filtros"). Required in practice whenever `collapsible` is set — this package carries no user-facing text of its own (D-10). */
  filtersToggleLabel?: string;
  /**
   * How many filter FIELDS are currently applied, shown as a badge on the
   * disclosure button and therefore part of its accessible name ("Filtros
   * 2"). The caller already computes this for its chip row; passing it here
   * means the collapsed button can state what is hidden behind it instead of
   * looking identical whether or not anything is filtering the list.
   */
  activeFilterCount?: number;
  /** Accessible name for the disclosure panel itself, e.g. "Filtros do registro de riscos". */
  filtersPanelLabel?: string;
  /**
   * Visual treatment for the toolbar surface. `register` keeps the controls
   * flush with the list layout and uses only a bottom divider, matching the
   * exploration bar shared by the GRC registers. The default `card` variant
   * preserves the original self-contained bordered surface for other uses.
   */
  variant?: 'card' | 'register';
  className?: string;
}

/**
 * Platform-wide filter toolbar for a `DataTable`-backed register/list screen
 * (T109). Composed as three visually distinct rows inside one bordered
 * surface — search, filter controls (+ trailing slot), active filters — so
 * the whole thing reads as one deliberate operational toolbar rather than a
 * flat wrap of same-looking inputs (CLAUDE.md §18, wave 3 rework).
 *
 * ## Three dispositions of the same three rows
 *
 * `collapsible` changes where the filter controls rest, never what they are
 * or how their state is kept:
 *
 *   - **inline** (default) — every control is on screen, under a "Filtros"
 *     caption. Correct for a register with two or three filters.
 *   - **collapsible, with a search box** — search takes the row, with a
 *     "Filtros N" disclosure button beside it; the controls live in a panel
 *     underneath that the button opens. The active-filter chips are NOT part
 *     of that panel: they stay visible while it is closed, which is what
 *     makes hiding the controls honest — a user always sees which filters
 *     are narrowing the list, and can drop any one of them, without opening
 *     anything.
 *   - **collapsible, with no search box** (Relatórios, Auditoria, Planos de
 *     Ação — contracts with no `q`/text-search parameter) — the bordered
 *     card above exists to give the search box and button somewhere to sit
 *     together; with no search box, that card wrapped nothing but a lone
 *     button in a ~74px empty box (measured on the rendered app). This
 *     disposition drops the outer card instead: collapsed, it is one slim,
 *     unboxed row — the toggle and active-filter chips on the left, optional
 *     presentation controls on the right. Open, the filter controls get
 *     their OWN bordered surface, since they no longer inherit one from an
 *     outer card that does not exist in this shape. Rendered as a fully
 *     separate branch below (`collapsible && !searchBox`) rather than extra
 *     conditionals threaded through the with-search JSX, so that
 *     disposition's markup and classes stay untouched by this one's
 *     existence.
 *
 * The panel is a plain in-flow disclosure, not a popover or a dialog: the
 * filter controls it holds already open popovers of their own, and nesting
 * those inside another layer buys a focus trap for no gain.
 *
 * ## Why the panel is hidden rather than unmounted (F-71)
 *
 * The collapsed panel stays in the document with the `hidden` attribute
 * instead of being removed from the tree. This is not a styling preference —
 * it is the fix for a measured, `impact: critical` accessibility defect that
 * reached production builds on Firefox.
 *
 * `useId` in React 19 is positional: it derives from the path to the node in
 * the render tree. On this App Router shell the register view sits behind a
 * `<Suspense>`, so its HTML arrives out of order as a streamed chunk, and the
 * race between that chunk landing and hydration starting can shift every
 * `useId` in the tree. React does not patch an attribute mismatch ("this
 * won't be patched up"), so the button keeps the **server's**
 * `aria-controls`. When the panel was mounted on click it was born in the
 * **client's** numbering — `aria-controls` then named an element that does
 * not exist, with `aria-expanded="true"`, which is exactly WCAG 4.1.2 /
 * axe `aria-valid-attr-value`. Measured in a production build: Chromium 0
 * failures, Firefox 3 occurrences in 4 measurements.
 *
 * Rendering the panel in the same pass as the button removes the divergence
 * at its source: the panel's `id` is server-rendered too, so button and panel
 * keep the *same* server value and the reference always resolves. It also
 * removes the second, quieter half of the same defect — with the panel
 * unmounted, `aria-controls` pointed at nothing on *every* load in *every*
 * engine, which axe tolerates only by its documented `aria-expanded="false"`
 * exception and which therefore no gate ever reported.
 *
 * What is kept mounted is the panel ELEMENT, not its contents: the controls
 * themselves still mount on open, exactly as before. The whole defect lives
 * in two attributes — the trigger's `aria-controls` and the panel's `id` —
 * so making the panel element itself survive both render passes is the whole
 * of the fix, and mounting ten screens' worth of filter controls that nobody
 * asked for would be a cost paid for nothing. It also keeps this change
 * invisible to everything else: no extra DOM, no hidden text a `getByText`
 * could suddenly match twice, no behaviour a consumer could notice.
 *
 * `hidden` and nothing else is what does the hiding: this package's Tailwind
 * preflight carries `[hidden]:where(:not([hidden='until-found'])) { display:
 * none !important }`, so the attribute wins over any layout utility, and the
 * display class is withheld while closed so the plain UA rule suffices even
 * without preflight. `display: none` is what keeps the closed panel out of
 * the tab order and out of the accessibility tree — an `aria-hidden` or an
 * off-screen clip would leave its controls tabbable, which would be a worse
 * defect than the one being fixed.
 *
 * Purely a
 * layout + search-box primitive otherwise: every actual filter control
 * (status, category, risk level, ...) is composed by the feature as a child,
 * most commonly `MultiSelectFilter`. `FilterBar` does not debounce
 * `onSearchChange` itself — each keystroke is forwarded immediately; a
 * caller that wants debounced URL/network updates (e.g. the risk register's
 * `use-register-state`) owns that decision, since how eagerly to react to
 * typing is a screen-level concern, not this generic component's.
 */
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

  // No-search collapsible disposition (see this file's own header comment,
  // "Three dispositions"). A fully separate branch — not extra conditionals
  // threaded through the with-search return below — so that disposition's
  // markup and classes are provably untouched by this one's existence: every
  // component call that reaches the return after this block took the exact
  // same code path it always did, unmodified.
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
        {/* Slim, unboxed row: the toggle, then the active-filter chips (in
            their own labelled group, exactly as in the with-search
            disposition) and "Limpar filtros" — no full-width bordered card
            around a lone button. */}
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
            // Present in every render pass, hidden while collapsed — F-71,
            // same mechanism as the with-search disposition below, same doc
            // comment above. Only the surrounding chrome differs: this
            // disposition has no outer card to inherit a border from, so the
            // panel gets its own ("a clear, bordered surface... they need
            // grouping") when open.
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
        // One row: the search box takes the width, and the filters live
        // behind the button beside it. The search box's own name stays in
        // the accessible tree (`sr-only` label) — a placeholder is not an
        // accessible name, and dropping the visible caption must not cost a
        // screen-reader user the field's purpose.
        //
        // A register whose contract has no text search at all (the audit
        // engagements catalog) still gets this row: the disclosure button is
        // the reason it exists, and gating the whole row on a search box
        // would have left that register with filters it could never open.
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
          // Present in every render pass, hidden while collapsed — see this
          // component's doc comment (F-71). The display utility is withheld
          // together with the attribute so nothing has to override anything.
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
          {/* The caption is redundant once the chips themselves name their
              field ("Status: Em tratamento") and the row is directly under
              the search box: the group's `aria-label` keeps the region named
              for assistive technology either way. An inline bar, where the
              chips sit among other controls, still shows it. */}
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
