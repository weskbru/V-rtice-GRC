import { cn } from '../lib/utils';

import type { ReactNode } from 'react';

export interface DetailLayoutProps {
  /** Top of the page — record identity, breadcrumb, actions (typically `EntityHeader`). Full width, above everything else. */
  header: ReactNode;
  /** Compact indicator row directly under the header, full width (typically a row of `SummaryStatCard`). Omitted entirely — no empty band — when the caller has none. */
  summary?: ReactNode;
  /**
   * The part of the contextual aside that must reach the reader before
   * `navigation` on EVERY viewport — real pendencies, not a summary of them
   * (016-risk-detail-experience P11). At `xl` and wider it sits at the TOP
   * of the same sticky aside column as `aside`, exactly where it already
   * was; below `xl` it is promoted out of that column entirely and rendered
   * here, between `summary` and `navigation` — so a caller on a narrow
   * device sees what needs attention before scrolling past the record's own
   * navigation and content to find it. Omitted entirely when the caller has
   * none.
   */
  asideLead?: ReactNode;
  /** The record's own section navigation, together with the content it drives — the bulk of the main column. Risk's own composition nests two `EntityTabs` (group, then leaf section) here; a module with a single level of sections passes just one. */
  navigation: ReactNode;
  /** Anything the caller stacks in the main column after `navigation`. Optional — most callers have nothing here; kept so a future module is not forced to fold unrelated content into `navigation` just to have a second thing in the column. */
  children?: ReactNode;
  /**
   * The REST of the contextual aside — shortcuts, relationships, metadata;
   * anything that is not `asideLead`. At `xl` and wider it stacks below
   * `asideLead` in the SAME sticky column (together they are the aside a
   * reader on a wide screen simply sees as one column). Below `xl` it
   * reflows AFTER `children` instead of before `navigation` — unlike
   * `asideLead`, this part does not need to block the path to the record's
   * own content on a narrow device (P11). Omitted entirely — no empty
   * column — when the caller has none.
   */
  aside?: ReactNode;
  /**
   * Accessible name for the sticky aside column's `complementary` landmark
   * at `xl` and wider (D-10 — this package carries no user-facing strings
   * of its own, so the caller's own pt-BR catalogue is the only legitimate
   * source). Required for the landmark to exist at all: without it the
   * column stays a plain, unlabelled `<div>`, exactly as it was before this
   * prop existed. Only the WIDE, single sticky column gets this landmark —
   * see this component's own doc comment for why the narrow-viewport
   * `asideLead`/`aside` copies deliberately do not.
   */
  asideLabel?: string;
  className?: string;
}

/**
 * Platform-wide two-column shell for a GRC record's detail screen
 * (016-risk-detail-experience §4.1/§5). Risk is the pilot; every future
 * module's detail screen is meant to compose through this SAME shell so the
 * "main column + contextual aside" contract never diverges module to module
 * (CLAUDE.md §18.12) — the risk-specific pieces that fill each slot (the
 * lifecycle spine, the "Atenção" panel, the group/section model) stay in
 * `apps/web/src/features/risks/components/detail/` until a second module
 * needs them too (CLAUDE.md §19.10 — a promotion earns its place by being
 * exercised twice, not by looking reusable once).
 *
 * Pure slots: no domain knowledge, no user-facing strings of its own (D-10,
 * CLAUDE.md §18.3) and no component name that could only mean "risk"
 * (CLAUDE.md §16's "nothing here gets a domain name").
 *
 * ## Responsive contract (R-12 — no two-column layout existed anywhere in
 * the product before this one, so this is the first, not a refinement of a
 * prior pattern; reordered per P11, 2026-09-15)
 *
 * At `xl` and wider: a CSS grid of `minmax(0,1fr)` (main) + a fixed `320px`
 * (aside), `sticky` so it stays reachable while the main column scrolls past
 * it. That column is `asideLead` then `aside`, stacked — visually one
 * column, split into two props only so the narrow layout below can reorder
 * them independently.
 *
 * Below `xl`, in READING order: `header`, `summary`, `asideLead`,
 * `navigation` + `children`, then `aside`. `asideLead` (real pendencies)
 * still reaches the reader before the record's own navigation — a narrow
 * device is exactly where a reader needs to know what is wrong first — but
 * `aside` (shortcuts, relationships, metadata) no longer sits between the
 * reader and the content they came for. Before P11, the WHOLE aside
 * (`asideLead` + `aside` combined) led on narrow viewports — five summary
 * cards plus four aside blocks stacked above the first navigable tab.
 *
 * `asideLead`/`aside` both render TWICE in the DOM (once for each layout)
 * and are toggled with `hidden`/responsive `display` utilities rather than
 * conditionally mounted — deliberately: a media-query-driven remount would
 * need a client hook this package does not otherwise need (every other
 * responsive behaviour here is pure CSS), and a `display:none` element is
 * already excluded from the accessibility tree and the tab order, so the
 * inactive copy is inert, not merely invisible — confirmed directly
 * (`offsetParent === null`, a `0x0` box) rather than assumed.
 *
 * `top-4` mirrors the sticky offset `RolePanelShell` already established for
 * this app shell's scrolling `<main>` (015-roles-permissions-surface) — the
 * same value, not a second independently chosen one.
 *
 * ## The two-column grid applies ONLY when an aside actually exists
 * (corrected 2026-09-18, 020-action-detail-experience)
 *
 * The `xl:grid xl:grid-cols-[minmax(0,1fr)_320px]` below used to be applied
 * UNCONDITIONALLY — every caller got the two-column track template at `xl`+
 * regardless of whether it passed `asideLead`/`aside` at all. Every consumer
 * before Action (Risk, Incident, Problem) always passes an `aside`, so the
 * bug was invisible in production: the reserved 320px column always had
 * something in it. Action is the first screen with a deliberate NO-aside
 * decision (see `action-detail-view.tsx`'s own header comment), which would
 * have shipped ~320px of dead column space at `xl`+ with nothing to fill
 * it — measured mid-rodada during 018 but never fixed before now because
 * nothing had shipped without an aside yet to make it visible. The grid
 * template now applies only when `hasAsideColumn` is true; otherwise the
 * main column's own wrapper renders at its ordinary flow width. A no-op for
 * every existing consumer (all three still pass `aside`) — reconfirmed by
 * re-running Risk's/Incident's/Problem's own suites and re-capturing their
 * rendered screens after this change.
 *
 * ## The aside landmark exists ONLY at `xl`+ (corrected 2026-09-17)
 *
 * The wide-viewport sticky column is `<aside aria-label={asideLabel}>` — a
 * real `complementary` landmark, persistent across every section, that a
 * screen reader user could not previously jump to or even know existed. The
 * narrow-viewport `asideLead`/`aside` copies deliberately stay plain,
 * unlandmarked `<div>`s: below `xl` the two are rendered in TWO separate,
 * non-adjacent places (`asideLead` before `navigation`, `aside` after
 * `children` — see above), so making each its own landmark would mean TWO
 * `complementary` regions sharing the SAME `aria-label`, which is worse
 * than no landmark at all — a reader cannot tell them apart by name, only
 * by guessing from position. One correctly-hidden, unambiguous landmark at
 * `xl`+ is preferable to two ambiguous ones below it.
 */
export function DetailLayout({
  header,
  summary,
  asideLead,
  navigation,
  children,
  aside,
  asideLabel,
  className,
}: DetailLayoutProps): React.JSX.Element {
  const hasAsideColumn = Boolean(asideLead) || Boolean(aside);
  // Only a LABELLED landmark is worth being one — an `<aside>` with no
  // `aria-label` still gets the implicit `complementary` role, so a caller
  // that omits `asideLabel` would get an unnamed landmark by accident
  // rather than the plain `<div>` it had before this prop existed.
  const AsideWrapper = asideLabel ? 'aside' : 'div';

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {header}
      {summary ? <div className="flex flex-col gap-4">{summary}</div> : null}

      {asideLead ? <div className="flex flex-col gap-4 xl:hidden">{asideLead}</div> : null}

      <div
        className={cn(
          'flex flex-col gap-6',
          hasAsideColumn && 'xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-6',
        )}
      >
        {hasAsideColumn ? (
          <AsideWrapper
            aria-label={asideLabel}
            className="hidden xl:order-2 xl:sticky xl:top-4 xl:flex xl:flex-col xl:gap-4"
          >
            {asideLead}
            {aside}
          </AsideWrapper>
        ) : null}
        <div className="flex min-w-0 flex-col gap-4 xl:order-1">
          {navigation}
          {children}
        </div>
      </div>

      {aside ? <div className="flex flex-col gap-4 xl:hidden">{aside}</div> : null}
    </div>
  );
}
