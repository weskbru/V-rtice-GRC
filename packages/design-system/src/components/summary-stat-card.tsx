import { cn } from '../lib/utils';

import type { ComponentType, SVGProps } from 'react';

export type SummaryStatCardTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success';

export interface SummaryStatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: SummaryStatCardTone;
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
