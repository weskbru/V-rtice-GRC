'use client';

import { cn } from '../../lib/utils';

export interface PageSizeSelectProps {
  pageSize: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange: (pageSize: number) => void;
  /** Already-localized label text, e.g. "Itens por página" (D-10 — the caller owns wording). */
  label: string;
  className?: string;
}

/**
 * The "rows per page" `<label>`/`<select>` pair, extracted out of
 * `PaginationFooter` so a caller that wants this control ABOVE its results
 * (rather than in the footer, where `PaginationFooter`'s own `showPageSize`
 * hides it) renders the exact same markup and behaviour instead of a second,
 * independently-styled copy.
 *
 * This is the fix for a real, measured divergence: the risk register's
 * `ResultsToolbar` had its own inline `<label><select>`, byte-similar but not
 * byte-identical to this one — `h-9` where this is `h-8`, the same defect
 * class (one fix applied to one copy, never propagated to its sibling)
 * `PaginationFooter`'s own header comment already names. One markup, one
 * component, two call sites.
 */
export function PageSizeSelect({
  pageSize,
  pageSizeOptions = [25, 50, 100],
  onPageSizeChange,
  label,
  className,
}: PageSizeSelectProps): React.JSX.Element {
  return (
    <label className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      {label}
      <select
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {pageSizeOptions.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
