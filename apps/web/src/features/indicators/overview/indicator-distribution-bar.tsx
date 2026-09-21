'use client';

/**
 * PharosGRC — decorative segmented distribution bar for the Indicadores
 * overview "Composição por nível e severidade" section (indicators-round,
 * S2 ownership, coordinator PLAN.md §2 step 4 / §4).
 *
 * Purely presentational: zero strings of its own. Every visible/accessible
 * word (bucket label, count) is the CONSUMER's responsibility to render in
 * its own legend list — this bar is `aria-hidden`, never `role="img"`, so a
 * screen reader skips it entirely and gets the real information only from
 * that legend (CLAUDE.md §18.8 — colour, and by extension a purely visual
 * proportional bar, is never the only carrier of meaning).
 *
 * Colours reuse the SAME `RISK_LEVEL_CHART_COLOR` CSS-variable tokens
 * `IndicatorHistorySection`'s own `TrendChart` series already use for these
 * exact four levels (`../metric-visuals.ts`) — not a new palette. Those
 * tokens already back `RiskLevelBadge` (subtle/solid emphasis text + icon +
 * border, never colour alone) elsewhere in the product, so non-text
 * contrast in both themes is inherited from an already-established,
 * already-reviewed source rather than invented here.
 */

import { cn } from '@/lib/utils';

import { RISK_LEVEL_CHART_COLOR } from '../metric-visuals';

import type { RiskLevel } from '@pharos/design-system/components';

export interface IndicatorDistributionSegment {
  /** Stable React key and, for `BY_BUCKET` metrics, the same level string the legend uses (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`). */
  readonly key: string;
  /** Already-computed count for this segment — never derived or re-aggregated here (CLAUDE.md §19.7). */
  readonly count: number;
  /** Human-readable label, used ONLY as a native `title` hint for sighted pointer users — never rendered as visible text by this component, and never read by assistive tech (the bar is `aria-hidden`). */
  readonly label: string;
  /** Which of the four established risk-level colour tokens this segment renders with. */
  readonly tone: RiskLevel;
}

export interface IndicatorDistributionBarProps {
  readonly segments: readonly IndicatorDistributionSegment[];
  readonly className?: string;
}

const TRACK_CLASSES = 'flex h-2 w-full overflow-hidden rounded-full bg-muted';

/**
 * A proportional, decorative bar of coloured segments. Segments with
 * `count === 0` render nothing (no zero-width sliver, no colour for a level
 * that has no members) — an empty/neutral track renders when every segment
 * is zero (or `segments` is empty), so the bar never silently disappears
 * next to a legend that still lists all four levels at 0.
 */
export function IndicatorDistributionBar({
  segments,
  className,
}: IndicatorDistributionBarProps): React.JSX.Element {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  if (total <= 0) {
    return <div aria-hidden="true" className={cn(TRACK_CLASSES, className)} />;
  }

  return (
    <div aria-hidden="true" className={cn(TRACK_CLASSES, className)}>
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => (
          <span
            key={segment.key}
            title={`${segment.label}: ${segment.count.toLocaleString('pt-BR')}`}
            style={{
              width: `${(segment.count / total) * 100}%`,
              backgroundColor: RISK_LEVEL_CHART_COLOR[segment.tone],
            }}
          />
        ))}
    </div>
  );
}
