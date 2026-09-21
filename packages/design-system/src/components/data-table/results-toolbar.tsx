'use client';

import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

export interface ResultsToolbarProps {
  /** Already-composed, already-localized count for the current result set, e.g. "861 riscos". The caller owns the wording, including plural and locale formatting (D-10). */
  count: string;
  /** While true, `loadingLabel` is announced instead of a count this screen does not have yet. */
  isLoading?: boolean;
  loadingLabel?: string;
  /** The screen's own view controls — ordering, a display option, Cards/Tabela, a column menu — in the order the module wants them. */
  children?: ReactNode;
  className?: string;
}

/**
 * The strip between a register's filters and its results: how many records
 * matched, on the left, and the controls that decide how those records are
 * presented, on the right.
 *
 * This exists because every GRC register had written its own — seven nearly
 * identical `*-register-results-bar.tsx` files, differing mostly in which
 * `w-[13rem]`/`w-[15rem]` someone happened to type. One of those copies also
 * carried a real defect that none of the others' tests could have caught:
 * the control group was a non-wrapping `flex`, so at 390px the Cards/Tabela
 * toggle was pushed past the right edge of a shell that clips its own
 * overflow — "Tabela" was simply not on screen, and no page-level scroll
 * appeared to say so. Here the control group wraps, and the count line is
 * allowed to shrink, so a narrow viewport stacks the controls instead of
 * hiding them.
 *
 * `role="status"` on the count: a filter or a page change replaces the
 * result set without moving focus, and a screen-reader user is told the new
 * size the same way a sighted one reads it off the screen.
 *
 * Presentation only — it holds no opinion about what the controls are. The
 * count string, every control and their order come from the caller.
 */
export function ResultsToolbar({
  count,
  isLoading = false,
  loadingLabel,
  children,
  className,
}: ResultsToolbarProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-3', className)}>
      <p className="min-w-0 text-sm font-medium text-foreground" role="status">
        {isLoading ? loadingLabel : count}
      </p>

      {children ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
