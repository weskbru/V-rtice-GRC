import { cn } from '../../lib/utils';

import { RISK_LEVEL_ICON, RISK_LEVEL_VISUALS } from './risk-level-visuals';

import type { RiskLevel } from './risk-level-visuals';

export type { RiskLevel };

/**
 * `RiskLevelBadge`'s own chrome text. Required, never defaulted inside the
 * component — like `DataTableLabels`/`RiskMatrixLabels`/`RiskScoreLabels`,
 * `packages/design-system` must not depend on `apps/web`'s pt-BR message
 * catalog, so every caller supplies this from its own source (D-10:
 * `RiskLevelBadge` is brought onto the same labels-prop convention every
 * other component in this package already follows).
 */
export interface RiskLevelBadgeLabels {
  /** Full level name, e.g. `LOW` -> "Baixo". Shared vocabulary with `RiskMatrix`/`RiskScore`'s own `levelName`. */
  levelName: (level: RiskLevel) => string;
  /**
   * Visible text when `basis` is supplied, composed from the basis and the
   * already-resolved level name, e.g. `('residual', 'Alto')` -> "Residual: Alto".
   */
  basisPrefixedLevel: (basis: 'inherent' | 'residual', levelLabel: string) => string;
  /**
   * Wraps the final visible label (with or without the basis prefix) into
   * the badge's `aria-label`, e.g. `'Alto'` -> "Nível de risco: Alto".
   */
  accessibleLabel: (label: string) => string;
}

export interface RiskLevelBadgeProps {
  /** The domain `RiskLevel` (data-model.md). */
  level: RiskLevel;
  /** 'subtle' (default, register/table use) or 'solid' (strong emphasis, e.g. risk detail header). */
  emphasis?: 'subtle' | 'solid';
  /**
   * Which score this badge represents. Purely a label prefix — data-model.md
   * §Post-Design Re-Check requires `riskLevelBasis` to always be explicit
   * wherever a risk level is shown, since inherent and residual are distinct
   * values. Omit only when the caller already disambiguates in surrounding
   * UI (e.g. a column already headed "Residual level").
   */
  basis?: 'inherent' | 'residual';
  labels: RiskLevelBadgeLabels;
  className?: string;
}

/**
 * Risk severity indicator for the `RiskLevel` domain enum. Severity is
 * conveyed through four independent, non-color signals at once — hue, a
 * distinct icon per level (check / triangle / octagon), an increasingly
 * heavy border treatment, and the text label itself — so it remains legible
 * without relying on color alone (FR-091) and to anyone with color vision
 * deficiency (SC-012).
 *
 * No `role="status"` — see `StatusBadge`'s doc comment (T203, F-2): this is
 * plain, always-reachable content, not a live region this component can
 * reliably keep announcing.
 */
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
