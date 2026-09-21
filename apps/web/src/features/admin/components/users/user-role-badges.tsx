'use client';

/**
 * PharosGRC — Administration, a user's role badges (table cell AND card) —
 * ONE component, not two independent copies of the same overflow control
 * (the coordinator's explicit instruction for this task, the same
 * discipline `action-row-menu.tsx`'s own header documents for the row
 * actions menu).
 *
 * Every role name stays reachable by a screen reader, never only by hover
 * or a `title` tooltip: the "+N" trigger's own accessible name already
 * states how many more roles there are and what they are
 * (`rolesOverflow.moreAriaLabel`), and activating it opens a Radix
 * `Popover` — a real, keyboard-operable disclosure, not a hover card — that
 * lists the hidden roles again for anyone who would rather read them than
 * have the whole name announced inline.
 *
 * ## Always one line — a rendered measurement found two real defects
 *
 * Both callers fit their roles to ONE line, always — never wrapping a
 * badge's own text mid-name, and never stacking badges onto a second line.
 * Two separate measurements at 1440×900 are why:
 *
 *   1. The table cell wrapped a second badge onto its own line when a
 *      fixed `previewCount={2}` happened to pick two names too long for
 *      the column — the row-height drift this screen exists to stop.
 *   2. The card's original three-equal-column metadata row gave Papéis
 *      roughly a third of the card (~100px), narrow enough that a single
 *      badge's OWN label broke mid-word ("Responsável por / Controle") —
 *      a pill that wraps its own text reads as broken, not as a mature
 *      product (CLAUDE.md §18.11). Papéis now gets a full-width row of its
 *      own in the card (`UserAdminCard`), and this component fits badges
 *      to whatever that row's real rendered width turns out to be.
 *
 * ## Two ways to learn the width budget, because the two callers know it differently
 *
 * `widthBudget` is REQUIRED, not defaulted, precisely so neither caller can
 * forget to say which one it means:
 *
 *   - a **number** (the table, `user-admin-columns.tsx`): the column's own
 *     fixed `size` minus the cell's padding — known at compile time, so no
 *     measurement is needed or possible before first paint.
 *   - **`'measure'`** (the card, `user-admin-card.tsx`): the card has no
 *     fixed pixel column — its width changes with the viewport and the
 *     grid's own column count (1/2/3, `CardGrid`) — so there is no honest
 *     constant to hard-code. This component measures its own row's
 *     rendered width instead, via `ResizeObserver` + `useLayoutEffect` (the
 *     effect that runs, synchronously, before the browser paints — so the
 *     very first frame the user sees already reflects the measured width,
 *     not a placeholder). Before that first measurement resolves (and in
 *     this component's own jsdom-based unit tests, where `ResizeObserver`
 *     is a no-op polyfill and `clientWidth` is always 0 — `vitest.setup
 *     .ts`), the width budget is treated as 0, which — by the "never show
 *     zero roles" rule below — still renders exactly one badge plus "+N",
 *     never nothing and never an overflow.
 *
 * Either way, the SAME deterministic fit (`computeFitCount`) decides how
 * many badges show — the table and the card can never disagree about what
 * "fits" means, only about how wide the space to fit into actually is.
 *
 * The character-width estimate (`CHAR_WIDTH_PX`/`BADGE_CHROME_PX` below)
 * deliberately OVER-estimates a label's width, so the failure direction is
 * always "one fewer badge shown", never "overflows" or "wraps".
 */
import { EmptyValue } from '@pharos/design-system/components';
import { useLayoutEffect, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { admin } from '@/lib/messages/admin';
import { roleDisplayName } from '@/lib/role-display-name';

import type { AdminRoleRef } from '../../types';

/** `whitespace-nowrap` is the explicit FLOOR the coordinator asked for — a badge's own text must never break mid-word regardless of how the fit computation below performs. No `truncate`/`max-width`: a badge is never given a bounded width to ellipsis against, so the fit computation (not CSS clipping) is what actually keeps it from spilling out of its row. */
const ROLE_BADGE_CLASS =
  'inline-flex shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-foreground';
const OVERFLOW_BADGE_CLASS =
  'inline-flex shrink-0 items-center rounded-md border border-transparent bg-muted px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Deliberately generous (over-, not under-, estimating a label's rendered width) — see this file's own header for why the error direction matters. Calibrated for `text-xs` (12px) system-font Portuguese role names. */
const CHAR_WIDTH_PX = 7;
/** Horizontal padding (`px-1.5` × 2) + border (1px × 2) of `ROLE_BADGE_CLASS`/`OVERFLOW_BADGE_CLASS`. */
const BADGE_CHROME_PX = 14;
/** `gap-1`. */
const GAP_PX = 4;

function estimateBadgeWidth(label: string): number {
  return Math.ceil(label.length * CHAR_WIDTH_PX) + BADGE_CHROME_PX;
}

/**
 * How many of `labels`, in order, fit on one line within `maxWidthPx` —
 * always reserving room for the "+N" chip unless the badge under
 * consideration is the very last one (no overflow chip needed then).
 * Returns at least 1 when `labels` is non-empty: a cell showing ONLY "+N"
 * with no role visible at all would be a worse failure than a single badge
 * spilling slightly past its budget in the rare case where even the first
 * name alone does not fit.
 */
function computeFitCount(labels: readonly string[], maxWidthPx: number): number {
  if (labels.length === 0) return 0;

  let used = 0;
  let count = 0;
  for (let i = 0; i < labels.length; i++) {
    const isLast = i === labels.length - 1;
    const remainingAfterThis = labels.length - (i + 1);
    const overflowReserve =
      !isLast && remainingAfterThis > 0 ? estimateBadgeWidth(`+${remainingAfterThis}`) + GAP_PX : 0;
    const thisBadge = estimateBadgeWidth(labels[i]!) + (i > 0 ? GAP_PX : 0);

    if (count === 0 || used + thisBadge + overflowReserve <= maxWidthPx) {
      used += thisBadge;
      count++;
    } else {
      break;
    }
  }
  return count;
}

export interface UserRoleBadgesProps {
  roles: readonly AdminRoleRef[];
  /**
   * The one-line width budget in pixels (table — a known constant, derived
   * from the column's own fixed `size`), or `'measure'` (card — measured
   * from this component's own rendered row width). See this file's own
   * header for the full reasoning behind the two modes.
   */
  widthBudget: number | 'measure';
}

export function UserRoleBadges({ roles, widthBudget }: UserRoleBadgesProps): React.JSX.Element {
  // A callback ref, not `useRef` + a plain `useLayoutEffect` dependency on
  // `isMeasureMode` alone: the row `<div>` below only mounts when
  // `roles.length > 0` (the `EmptyValue` early return short-circuits before
  // it). A `useRef` object is stable across renders, so if this same
  // component instance first rendered with zero roles and later received
  // roles (e.g. a card re-rendering after the "assign roles" dialog
  // succeeds and the query refetches), `isMeasureMode` never changes and the
  // effect never re-runs — `containerRef.current` stays the `null` it was on
  // the only run, `measuredWidth` stays stuck at 0, and the row keeps
  // showing one badge plus "+N" forever, even with room for more. The
  // callback ref fires on every mount/unmount of the row `<div>` itself
  // (including this "zero roles, then some roles" transition), so it is
  // what the effect below actually needs to depend on.
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const isMeasureMode = widthBudget === 'measure';

  // Runs before the browser paints (unlike `useEffect`), so the first frame
  // the user actually sees already reflects the real row width — never a
  // "measured at 0, then jumps" flash. `ResizeObserver` also re-measures on
  // viewport/grid changes (390 ↔ 1440, `CardGrid`'s 1/2/3-column
  // breakpoints), which is the whole reason `'measure'` mode exists instead
  // of a second hard-coded constant.
  useLayoutEffect(() => {
    if (!isMeasureMode || !containerNode) return undefined;
    const measure = (): void => setMeasuredWidth(containerNode.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(containerNode);
    return () => observer.disconnect();
  }, [isMeasureMode, containerNode]);

  if (roles.length === 0) {
    return <EmptyValue>{admin.users.table.noRoles}</EmptyValue>;
  }

  const labels = roles.map((role) => roleDisplayName(role.name));
  const effectiveWidth = isMeasureMode ? measuredWidth : widthBudget;
  const visibleCount = computeFitCount(labels, effectiveWidth);
  const preview = roles.slice(0, visibleCount);
  const hidden = roles.slice(visibleCount);
  const messages = admin.users.rolesOverflow;

  return (
    <div ref={setContainerNode} className="flex w-full flex-nowrap items-center gap-1">
      {preview.map((role) => (
        <span key={role.id} className={ROLE_BADGE_CLASS}>
          {roleDisplayName(role.name)}
        </span>
      ))}
      {hidden.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={messages.moreAriaLabel(
                hidden.length,
                hidden.map((role) => roleDisplayName(role.name)).join(', '),
              )}
              className={OVERFLOW_BADGE_CLASS}
            >
              {messages.moreLabel(hidden.length)}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            role="group"
            aria-label={messages.popoverRegionLabel}
            className="w-auto max-w-64 p-2"
          >
            <ul className="flex flex-col gap-1">
              {hidden.map((role) => (
                <li key={role.id}>
                  <span className={ROLE_BADGE_CLASS}>{roleDisplayName(role.name)}</span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
