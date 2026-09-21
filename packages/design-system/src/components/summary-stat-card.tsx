import { cn } from '../lib/utils';

import type { ComponentType, SVGProps } from 'react';

export type SummaryStatCardTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success';

export interface SummaryStatCardProps {
  /** Small caption, e.g. "Total de riscos". */
  label: string;
  /** Already-formatted value, e.g. "24". The caller owns locale formatting. */
  value: string;
  /** Secondary line under the value, e.g. "Nível residual crítico". */
  hint?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Moderate semantic tint applied to the icon and a thin accent only — never a fully coloured card. */
  tone?: SummaryStatCardTone;
  /** Renders a compact skeleton in place of the value. */
  isLoading?: boolean;
  className?: string;
}

const ICON_CHIP_CLASSES: Record<SummaryStatCardTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-status-info-bg text-status-info-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  danger: 'bg-status-danger-bg text-status-danger-fg',
  success: 'bg-status-success-bg text-status-success-fg',
};

const ACCENT_BORDER_CLASSES: Record<SummaryStatCardTone, string> = {
  neutral: 'border-l-border',
  info: 'border-l-status-info-solid-bg',
  warning: 'border-l-status-warning-solid-bg',
  danger: 'border-l-status-danger-solid-bg',
  success: 'border-l-status-success-solid-bg',
};

/**
 * Compact indicator card for the top of a register screen (e.g. "Total de
 * riscos", "Riscos em atraso") — explicitly not a dashboard tile: small
 * enough that four sit comfortably in one desktop row without dominating
 * the screen (CLAUDE.md §18.5).
 *
 * `tone` is a moderate accent only: it tints the icon chip and a thin left
 * border, never the card's whole surface, and it is never the only carrier
 * of meaning — `label` always states what the number is, independent of
 * colour (CLAUDE.md §18.8). It reuses `StatusBadge`'s own status colour
 * tokens (`bg-status-*`, `text-status-*`) rather than inventing new values.
 *
 * Deliberately contains no interactive element: the caller wraps the whole
 * card in a Next.js `<Link>` (this package never imports `next/link`) or a
 * `<button>` when the card itself is the affordance. To let that ancestor
 * drive hover/focus styling, this component's own hover/focus treatment is
 * written as `group-hover:`/`group-focus-visible:` variants rather than
 * `:hover`/`:focus` on itself — the caller adds the `group` class to the
 * wrapping link/button.
 */
export function SummaryStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  isLoading = false,
  className,
}: SummaryStatCardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border-y border-r border-l-2 border-border bg-card p-3 shadow-xs transition-colors group-hover:bg-muted/40 group-focus-visible:bg-accent',
        ACCENT_BORDER_CLASSES[tone],
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-md',
            ICON_CHIP_CLASSES[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      ) : null}

      <div className="flex min-w-0 flex-col gap-0.5">
        {/* Wraps rather than truncates: on a phone these cards sit two to a
            row, where "Total de riscos" clipped to "Total de ri…" — a label
            that no longer says what the number is. Two lines are allowed;
            beyond that it still clips, so one long label cannot push the
            row's height without bound. */}
        <span className="line-clamp-2 text-xs font-medium text-muted-foreground">{label}</span>
        {isLoading ? (
          <span aria-hidden="true" className="h-6 w-14 animate-pulse rounded bg-muted" />
        ) : (
          <span className="text-2xl leading-tight font-semibold tabular-nums text-foreground">
            {value}
          </span>
        )}
        {hint ? <span className="line-clamp-2 text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}
