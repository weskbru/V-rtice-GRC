import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

export interface ReadOnlyFieldProps {
  /** Visible field label, rendered as a `<dt>` — the same label vocabulary a `FormField` would use for the same data when it is editable. */
  label: string;
  /** The value to display. A plain string for the common case; `ReactNode` so a caller can compose a badge or a link into the value without this component knowing about it. */
  value: ReactNode;
  /** Span both columns of a two-column layout — for a long value (e.g. a description) that should not be squeezed beside another field. */
  full?: boolean;
  /** De-emphasizes the field — smaller text, for a group of secondary/classification facts placed deliberately below primary content (CLAUDE.md §18, "establish hierarchy"). Default `false` (normal body-text weight). */
  muted?: boolean;
  className?: string;
}

/**
 * Platform-wide read-only field display (CLAUDE.md §18: "Read-only values
 * must not look editable"). Deliberately renders as plain `<dt>`/`<dd>` text
 * with no border, no background box and no focus ring — the opposite
 * silhouette of an `<input>`/`<Select>`, so a reader never mistakes a
 * read-only fact for something they can edit, and a genuinely `disabled`
 * control (still shaped like a control, only inert — shadcn's own
 * `disabled:opacity-50`) is never visually confusable with this.
 *
 * This is the same label/value structure `RiskOverview`, the treatment
 * section's "current decision" summary and the lifecycle card's pending
 * approval each re-implemented locally before this component existed —
 * consolidated here once so every module's detail screen renders a
 * read-only fact identically (SC-011, CLAUDE.md §13.8).
 */
export function ReadOnlyField({
  label,
  value,
  full = false,
  muted = false,
  className,
}: ReadOnlyFieldProps): React.JSX.Element {
  return (
    <div className={cn(full ? 'sm:col-span-2' : undefined, className)}>
      <dt
        className={cn(
          'font-medium tracking-wide text-muted-foreground uppercase',
          muted ? 'text-[0.6875rem]' : 'text-xs',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'whitespace-pre-wrap text-foreground',
          muted ? 'text-sm text-foreground/80' : 'text-sm',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
