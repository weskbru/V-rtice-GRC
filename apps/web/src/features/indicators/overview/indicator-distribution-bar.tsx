'use client';

import { cn } from '@/lib/utils';

import { RISK_LEVEL_CHART_COLOR } from '../metric-visuals';

import type { RiskLevel } from '@pharos/design-system/components';

export interface IndicatorDistributionSegment {
  readonly key: string;
  readonly count: number;
  readonly label: string;
  readonly tone: RiskLevel;
}

export interface IndicatorDistributionBarProps {
  readonly segments: readonly IndicatorDistributionSegment[];
  readonly className?: string;
}

const TRACK_CLASSES = 'flex h-2 w-full overflow-hidden rounded-full bg-muted';

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
