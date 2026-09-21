import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/utils';

/**
 * Shared "load more" control for `ActivityHistory`/`AuditTimeline` (T169) —
 * both paginate the same way `AssessmentHistory`/`TreatmentHistory`
 * (`apps/web`) already do: a real button the caller's own fetch drives, not
 * an unbounded single fetch (Constitution VI's audit-defensibility promise
 * would be hollow if a long-lived record's history silently truncated).
 * Extracted once so the two components never grow two slightly different
 * copies of the same control (CLAUDE.md §13.8).
 */
export function LoadMoreButton({
  label,
  loadingLabel,
  isLoading,
  onClick,
}: {
  label: string;
  loadingLabel: string;
  isLoading: boolean;
  onClick?: (() => void) | undefined;
}): React.JSX.Element {
  return (
    <div>
      <button
        type="button"
        disabled={isLoading}
        onClick={onClick}
        className={cn(
          'inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors',
          'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        {isLoading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        {isLoading ? loadingLabel : label}
      </button>
    </div>
  );
}
