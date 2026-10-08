import { EyeOff } from 'lucide-react';

import { cn } from '../lib/utils';

import { RiskLevelBadge } from './risk/risk-level-badge';

import type { RiskLevel, RiskLevelBadgeLabels } from './risk/risk-level-badge';
import type { ComponentType, SVGProps } from 'react';

export type MetricCardTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success';

export interface MetricCardBucketEntry {
  level: RiskLevel;
  count: number;
}

export type MetricCardValue =
  | { status: 'available'; shape: 'single'; value: string; unit?: string }
  | {
      status: 'available';
      shape: 'byBucket';
      buckets: readonly MetricCardBucketEntry[];
      badgeLabels: RiskLevelBadgeLabels;
    }
  | { status: 'unavailable'; unavailableLabel: string; unavailableHint?: string };

export interface MetricCardProps {
  label: string;
  orgUnitLabel?: string;
  updatedAtLabel?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: MetricCardTone;
  isLoading?: boolean;
  value: MetricCardValue;
  className?: string;
}

const ICON_CHIP_CLASSES: Record<MetricCardTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-status-info-bg text-status-info-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  danger: 'bg-status-danger-bg text-status-danger-fg',
  success: 'bg-status-success-bg text-status-success-fg',
};

const ACCENT_BORDER_CLASSES: Record<MetricCardTone, string> = {
  neutral: 'border-l-border',
  info: 'border-l-status-info-solid-bg',
  warning: 'border-l-status-warning-solid-bg',
  danger: 'border-l-status-danger-solid-bg',
  success: 'border-l-status-success-solid-bg',
};

export function MetricCard({
  label,
  orgUnitLabel,
  updatedAtLabel,
  icon: Icon,
  tone = 'neutral',
  isLoading = false,
  value,
  className,
}: MetricCardProps): React.JSX.Element {
  const hasMetaFooter = Boolean(orgUnitLabel ?? updatedAtLabel);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border-y border-r border-l-2 border-border bg-card p-4 shadow-xs',
        value.status === 'unavailable'
          ? 'border-l-border border-dashed bg-muted/30'
          : ACCENT_BORDER_CLASSES[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {Icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex size-8 shrink-0 items-center justify-center rounded-md',
              value.status === 'unavailable'
                ? 'bg-muted text-muted-foreground'
                : ICON_CHIP_CLASSES[tone],
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <span aria-hidden="true" className="h-9 w-24 animate-pulse rounded bg-muted" />
      ) : value.status === 'unavailable' ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <EyeOff aria-hidden="true" className="size-5 shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{value.unavailableLabel}</span>
            {value.unavailableHint ? (
              <span className="text-xs">{value.unavailableHint}</span>
            ) : null}
          </div>
        </div>
      ) : value.shape === 'single' ? (
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl leading-tight font-semibold tabular-nums text-foreground">
            {value.value}
          </span>
          {value.unit ? (
            <span className="text-sm font-medium text-muted-foreground">{value.unit}</span>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-4">
          {value.buckets.map((bucket) => (
            <div key={bucket.level} className="flex flex-col items-start gap-1">
              <span className="text-2xl leading-tight font-semibold tabular-nums text-foreground">
                {bucket.count}
              </span>
              <RiskLevelBadge level={bucket.level} labels={value.badgeLabels} />
            </div>
          ))}
        </div>
      )}

      {hasMetaFooter ? (
        <div className="flex flex-col gap-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
          {orgUnitLabel ? <span className="truncate">{orgUnitLabel}</span> : null}
          {updatedAtLabel ? <span className="truncate">{updatedAtLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
