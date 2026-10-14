import { cn } from '../../lib/utils';

import { RISK_LEVEL_ICON, RISK_LEVEL_VISUALS } from './risk-level-visuals';

import type { RiskLevel } from './risk-level-visuals';

export type { RiskLevel };

export interface RiskLevelBadgeLabels {
  levelName: (level: RiskLevel) => string;
  basisPrefixedLevel: (basis: 'inherent' | 'residual', levelLabel: string) => string;
  accessibleLabel: (label: string) => string;
}

export interface RiskLevelBadgeProps {
  level: RiskLevel;
  emphasis?: 'subtle' | 'solid';
  basis?: 'inherent' | 'residual';
  labels: RiskLevelBadgeLabels;
  className?: string;
}

export function RiskLevelBadge({
  level,
  emphasis = 'subtle',
  basis,
  labels,
  className,
}: RiskLevelBadgeProps): React.JSX.Element {
  const Icon = RISK_LEVEL_ICON[level];
  const levelLabel = labels.levelName(level);
  const label = basis ? labels.basisPrefixedLevel(basis, levelLabel) : levelLabel;

  return (
    <span
      aria-label={labels.accessibleLabel(label)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold leading-4',
        RISK_LEVEL_VISUALS[level][emphasis],
        RISK_LEVEL_VISUALS[level].shape,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
