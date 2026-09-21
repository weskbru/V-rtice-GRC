import { EyeOff } from 'lucide-react';

import { cn } from '../lib/utils';

import { RiskLevelBadge } from './risk/risk-level-badge';

import type { RiskLevel, RiskLevelBadgeLabels } from './risk/risk-level-badge';
import type { ComponentType, SVGProps } from 'react';

export type MetricCardTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success';

/** One band of a `BY_BUCKET` metric (data-model.md §3), e.g. `RISK_TOTAL_BY_LEVEL`. */
export interface MetricCardBucketEntry {
  level: RiskLevel;
  /** Already-computed count for this band — never derived or re-aggregated here. */
  count: number;
}

/**
 * The metric's current value, in one of the two shapes the indicator catalog
 * defines (data-model.md §3, `shape`), or absent because the caller lacks
 * read permission on the metric's source domain (a report item the viewer
 * cannot see into).
 *
 * `status: 'unavailable'` is a distinct state, not a zero — CLAUDE.md §18.11
 * ("erros são compreensíveis sem depender só de cor") and the phase's own
 * acceptance criterion require this to be visually and semantically
 * impossible to confuse with a real computed zero.
 */
export type MetricCardValue =
  | { status: 'available'; shape: 'single'; value: string; unit?: string }
  | {
      status: 'available';
      shape: 'byBucket';
      buckets: readonly MetricCardBucketEntry[];
      /** Passed straight through to `RiskLevelBadge` — this component never restates that vocabulary. */
      badgeLabels: RiskLevelBadgeLabels;
    }
  | { status: 'unavailable'; unavailableLabel: string; unavailableHint?: string };

export interface MetricCardProps {
  /** Metric name, e.g. "Total de riscos por nível". Subordinate to the value (§18.11). */
  label: string;
  /** Applicable organizational unit, e.g. "Unidade: Financeiro", or "Organização inteira" for an org-wide metric. Omit when the caller has nothing to show. */
  orgUnitLabel?: string;
  /** Already-formatted "updated at" text, e.g. "Atualizado em 12/09/2026 14:32". */
  updatedAtLabel?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Moderate semantic tint on the icon chip and a thin accent border only — same convention as `SummaryStatCard`. */
  tone?: MetricCardTone;
  /** Renders a skeleton in place of `value`. `value` is still required and simply not read while true (same convention as `SummaryStatCard.isLoading`). */
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

/**
 * Generic metric card for the Indicators/Reports module (data-model.md §3):
 * the calculated value dominates the card, and the metric label, applicable
 * organizational unit and "updated at" render as visibly subordinate
 * metadata beneath it (CLAUDE.md §18.11, "a informação importante domina os
 * metadados secundários").
 *
 * ## Two value shapes, one card
 *
 * `shape: 'single'` renders one dominant number (optionally with a smaller
 * adjacent unit, e.g. "%"). `shape: 'byBucket'` renders one dominant number
 * per band, each paired with the existing `RiskLevelBadge` as the band
 * indicator — this component never introduces a second severity-color
 * vocabulary (CLAUDE.md §19.6/§19.4); every `BY_BUCKET` metric in the
 * catalog (Risco, Achado, Incidente, Problema) uses the same
 * `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` shape `RiskLevelBadge` already renders,
 * even where the underlying domain enum has its own name
 * (`FindingSeverity`/`IncidentSeverity`/`ProblemSeverity`) — the caller maps
 * its domain value onto `RiskLevel` before handing it to this card.
 *
 * ## `status: 'unavailable'` is never a zero
 *
 * A report item the caller cannot read (missing source permission) renders
 * with a muted dashed treatment and an "eye-off" glyph plus the caller's own
 * explanatory text — never a bare `0`, which would misreport "computed and
 * empty" as if it were "not computed at all" (phase acceptance criterion,
 * CLAUDE.md §18.11).
 *
 * Deliberately not an extension of `SummaryStatCard`: that component is
 * documented as intentionally compact ("explicitly not a dashboard tile"),
 * takes a single pre-formatted string value, and has established call sites
 * across five register screens. Folding a three-way value shape
 * (single/byBucket/unavailable) into its props would change what that
 * component visually promises at every existing call site to serve a
 * genuinely different layout need — a new, purpose-built card that shares
 * its tone/icon-chip vocabulary is the smaller change (CLAUDE.md §19.4).
 */
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
