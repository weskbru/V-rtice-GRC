import { MinusCircle } from 'lucide-react';

import { cn } from '../../lib/utils';

import { RiskLevelBadge } from './risk-level-badge';

import type { RiskLevelBadgeLabels } from './risk-level-badge';
import type { RiskLevel } from './risk-level-visuals';

export interface RiskScoreLabels {
  basisName: (basis: 'inherent' | 'residual') => string;
  levelName: (level: RiskLevel) => string;
  scoreCaption: (params: { basisLabel: string; score: number; levelLabel: string }) => string;
  notAssessedCaption: (basisLabel: string) => string;
  riskLevelBadge: RiskLevelBadgeLabels;
}

export interface RiskScoreProps {
  score: number | null;
  level: RiskLevel | null;
  basis: 'inherent' | 'residual';
  labels: RiskScoreLabels;
  emphasis?: 'subtle' | 'solid';
  className?: string;
}

export function RiskScore({
  score,
  level,
  basis,
  labels,
  emphasis = 'subtle',
  className,
}: RiskScoreProps): React.JSX.Element {
  const basisLabel = labels.basisName(basis);

  if (score === null || level === null) {
    return (
      <div
        className={cn('inline-flex items-center gap-1.5 text-sm text-muted-foreground', className)}
      >
        <MinusCircle aria-hidden="true" className="size-4 shrink-0" />
        <span>{labels.notAssessedCaption(basisLabel)}</span>
      </div>
    );
  }

  const levelLabel = labels.levelName(level);

  return (
    <div className={cn('inline-flex flex-col gap-1', className)}>
      <div className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="text-lg leading-none font-bold tabular-nums text-foreground"
        >
          {score}
        </span>
        <RiskLevelBadge
          level={level}
          basis={basis}
          labels={labels.riskLevelBadge}
          emphasis={emphasis}
        />
      </div>
      <span className="sr-only">{labels.scoreCaption({ basisLabel, score, levelLabel })}</span>
    </div>
  );
}
