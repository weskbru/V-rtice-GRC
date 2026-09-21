import { cn } from '../lib/utils';

import { StatusBadge } from './status-badge';

import type { StatusEmphasis } from './status-badge';

export interface ThresholdBreachBadgeProps {
  /** Whether the measurement crossed the indicator's configured threshold (data-model.md §2, `IndicatorMeasurement.breached`). */
  breached: boolean;
  /** Already-localized text, e.g. "Limiar rompido" / "Dentro do limiar". Required — the label is the primary, color-independent signal (CLAUDE.md §18.8). */
  label: string;
  /** 'subtle' (default) or 'solid' — same convention as `StatusBadge`. */
  emphasis?: StatusEmphasis;
  className?: string;
}

/**
 * Communicates whether an indicator measurement breached its configured
 * threshold. A thin, purpose-built wrapper over `StatusBadge` rather than a
 * new visual vocabulary (CLAUDE.md §18.3/§18.12): `breached` maps to the
 * platform's existing `danger`/`success` status colors, and `StatusBadge`'s
 * own guarantee — icon and text always render alongside color, never color
 * alone (FR-091, SC-012) — carries over unchanged. Fixing the
 * breached-to-`danger` mapping in one place, rather than at every call site,
 * is the same reasoning `riskStatusChartColor` already applies to
 * `RiskStatus` (`apps/web/src/features/dashboard/components/chart-tokens.ts`):
 * one authority for what a domain condition looks like.
 */
export function ThresholdBreachBadge({
  breached,
  label,
  emphasis = 'subtle',
  className,
}: ThresholdBreachBadgeProps): React.JSX.Element {
  return (
    <StatusBadge
      variant={breached ? 'danger' : 'success'}
      label={label}
      emphasis={emphasis}
      className={cn(className)}
    />
  );
}
