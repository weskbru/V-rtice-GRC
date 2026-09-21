import { CircleAlert, CircleCheck, CircleX, Info, MinusCircle } from 'lucide-react';

import { cn } from '../lib/utils';

import type { ComponentType, SVGProps } from 'react';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type StatusEmphasis = 'subtle' | 'solid';

const VARIANT_CLASSES: Record<StatusVariant, { subtle: string; solid: string }> = {
  success: {
    subtle: 'bg-status-success-bg text-status-success-fg border-status-success-border',
    solid: 'bg-status-success-solid-bg text-status-success-solid-fg border-transparent',
  },
  warning: {
    subtle: 'bg-status-warning-bg text-status-warning-fg border-status-warning-border',
    solid: 'bg-status-warning-solid-bg text-status-warning-solid-fg border-transparent',
  },
  danger: {
    subtle: 'bg-status-danger-bg text-status-danger-fg border-status-danger-border',
    solid: 'bg-status-danger-solid-bg text-status-danger-solid-fg border-transparent',
  },
  info: {
    subtle: 'bg-status-info-bg text-status-info-fg border-status-info-border',
    solid: 'bg-status-info-solid-bg text-status-info-solid-fg border-transparent',
  },
  neutral: {
    subtle: 'bg-status-neutral-bg text-status-neutral-fg border-status-neutral-border',
    solid: 'bg-status-neutral-solid-bg text-status-neutral-solid-fg border-transparent',
  },
};

const DEFAULT_ICON: Record<StatusVariant, ComponentType<SVGProps<SVGSVGElement>>> = {
  success: CircleCheck,
  warning: CircleAlert,
  danger: CircleX,
  info: Info,
  neutral: MinusCircle,
};

export interface StatusBadgeProps {
  /** Semantic outcome this badge represents. Never rely on this alone — an icon and the text label always render alongside it (FR-091, SC-012). */
  variant: StatusVariant;
  /** Human-readable label, e.g. "Active", "Overdue", "Pending approval". Required — the label is the primary, color-independent signal. */
  label: string;
  /** 'subtle' (tinted, default — inline in tables/lists) or 'solid' (strong emphasis, e.g. a single prominent header status). */
  emphasis?: StatusEmphasis;
  /** Override the variant's default icon. Pass `false` to omit the icon (the text label alone still satisfies FR-091, but the icon is recommended). */
  icon?: ComponentType<SVGProps<SVGSVGElement>> | false;
  className?: string;
}

/**
 * Generic status indicator (session state, approval outcome, lifecycle
 * status, ...). Distinguishes meaning via color + icon + text label together
 * — never color alone (FR-091, SC-012). For risk severity specifically, use
 * `RiskLevelBadge`, which is a distinct semantic axis (data-model.md
 * `RiskLevel`) even where a hue is shared.
 *
 * ## No `role="status"` (T203, F-2)
 *
 * This is plain content, not an ARIA live region: a badge whose value is
 * usually present at first render (a table cell, a header chip) and, even
 * where a caller re-renders it in place with a new value, `role="status"`
 * cannot promise a reliable announcement either way — some call sites
 * remount the badge (a fresh row keyed by id) rather than mutate it in
 * place, so the same "does this get spoken?" question would have a
 * different, unpredictable answer at every call site. The label is already
 * reachable in normal reading order (visible text, plus `aria-label` where
 * a fuller sentence is warranted) — that is the access guarantee this
 * component makes, consistently, everywhere it is used. `LoadingState` is
 * the platform's one dedicated live-region component (ARIA APG's "busy
 * indicator" pattern) — see its own doc comment.
 */
export function StatusBadge({
  variant,
  label,
  emphasis = 'subtle',
  icon,
  className,
}: StatusBadgeProps): React.JSX.Element {
  const Icon = icon === false ? null : (icon ?? DEFAULT_ICON[variant]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-4',
        VARIANT_CLASSES[variant][emphasis],
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      <span>{label}</span>
    </span>
  );
}
