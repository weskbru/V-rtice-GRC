/**
 * PharosGRC — dashboard chart color tokens (T198).
 *
 * Recharts renders raw SVG, so its `fill` values must be real CSS color
 * values, not Tailwind utility classes. Every value below is a CSS custom
 * property defined in `packages/design-system/src/styles/globals.css`
 * (`:root` for light, redefined under `.dark` for dark) — never a hardcoded
 * hex literal — so a chart's colors follow the active theme the exact same
 * way `RiskLevelBadge`'s `bg-risk-{level}-solid-bg` classes do, with no
 * theme-detection code needed here (both resolve the same custom property
 * at paint time).
 *
 * `RISK_LEVEL_CHART_COLOR` reuses the *solid* emphasis pairing —
 * `RiskLevelBadge`'s own `RISK_LEVEL_VISUALS[level].solid` background — so
 * the dashboard chart and the risk register/detail badges never disagree
 * about what a given `RiskLevel` looks like (this task's explicit
 * requirement). `riskStatusChartColor` does the same for `RiskStatus`,
 * built on `riskStatusBadgeVariant` (`@/features/risks/status`) rather than
 * declaring a second, independent status→color mapping.
 */
import { riskStatusBadgeVariant } from '@/features/risks/status';

import type { ActionStatus } from '@/features/actions/types';
import type { RiskLevel, RiskStatus } from '@/features/risks/types';
import type { StatusVariant } from '@pharos/design-system/components';

export const RISK_LEVEL_CHART_COLOR: Readonly<Record<RiskLevel, string>> = {
  LOW: 'var(--risk-low-solid-bg)',
  MEDIUM: 'var(--risk-medium-solid-bg)',
  HIGH: 'var(--risk-high-solid-bg)',
  CRITICAL: 'var(--risk-critical-solid-bg)',
};

const STATUS_VARIANT_CHART_COLOR: Readonly<Record<StatusVariant, string>> = {
  success: 'var(--status-success-solid-bg)',
  warning: 'var(--status-warning-solid-bg)',
  danger: 'var(--status-danger-solid-bg)',
  info: 'var(--status-info-solid-bg)',
  neutral: 'var(--status-neutral-solid-bg)',
};

export function riskStatusChartColor(status: RiskStatus): string {
  return STATUS_VARIANT_CHART_COLOR[riskStatusBadgeVariant(status)];
}

/** Shared chart chrome colors — never a hardcoded hex, same reasoning as above. */
/**
 * Action plans by status — a part-to-whole of CATEGORIES, not of good/bad
 * states, so it wears the categorical data-viz slots rather than the reserved
 * status tokens (`OPEN` and `CANCELLED` share the neutral status variant, which
 * would make two adjacent donut segments the same colour). The three hues are
 * the reference palette's first three slots, validated on ALL pairs in both
 * modes because a donut drops zero segments and any two can become
 * neighbours; `CANCELLED` takes the de-emphasis gray. Identity never rests on
 * colour alone: the legend beside the ring names every status with its count.
 */
export const ACTION_STATUS_CHART_COLOR: Readonly<Record<ActionStatus, string>> = {
  OPEN: 'var(--viz-categorical-1)',
  IN_PROGRESS: 'var(--viz-categorical-2)',
  COMPLETED: 'var(--viz-categorical-3)',
  CANCELLED: 'var(--viz-muted)',
};

export const CHART_AXIS_COLOR = 'var(--muted-foreground)';
export const CHART_GRID_COLOR = 'var(--border)';
export const CHART_LABEL_COLOR = 'var(--foreground)';
