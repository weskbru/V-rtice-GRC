import { CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react';

import type { RiskSeverityToken } from '../../tokens/colors';
import type { ComponentType, SVGProps } from 'react';

/**
 * Mirrors `enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }` in data-model.md.
 * Defined once here — `RiskLevelBadge`, `RiskMatrix` and `RiskScore` all
 * import this same type rather than each declaring their own copy
 * (CLAUDE.md §13.8, avoid unnecessary duplication).
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const ICON: Record<RiskSeverityToken['icon'], ComponentType<SVGProps<SVGSVGElement>>> = {
  CircleCheck,
  TriangleAlert,
  OctagonAlert,
};

/**
 * Icon per level — one of the non-color severity signals every component
 * rendering a `RiskLevel` must carry alongside color (FR-091, SC-012).
 */
export const RISK_LEVEL_ICON: Record<RiskLevel, ComponentType<SVGProps<SVGSVGElement>>> = {
  LOW: ICON.CircleCheck,
  MEDIUM: ICON.TriangleAlert,
  HIGH: ICON.TriangleAlert,
  CRITICAL: ICON.OctagonAlert,
};

/**
 * Color + border-weight treatment per level: `subtle` (tinted, default —
 * inline badge/table/matrix-cell use), `solid` (strong emphasis, e.g. a risk
 * detail header), and `shape` — a border-weight class that grows strictly
 * with severity (1px → 2px → 3px → 3px + inset ring). `shape` is the second
 * non-color signal: severity is still legible with color vision deficiency
 * or on a grayscale printout, from the border weight and the icon alone.
 */
export const RISK_LEVEL_VISUALS: Record<
  RiskLevel,
  { subtle: string; solid: string; shape: string }
> = {
  LOW: {
    subtle: 'bg-risk-low-bg text-risk-low-fg border-risk-low-border',
    solid: 'bg-risk-low-solid-bg text-risk-low-solid-fg border-transparent',
    shape: 'border',
  },
  MEDIUM: {
    subtle: 'bg-risk-medium-bg text-risk-medium-fg border-risk-medium-border',
    solid: 'bg-risk-medium-solid-bg text-risk-medium-solid-fg border-transparent',
    shape: 'border-2',
  },
  HIGH: {
    subtle: 'bg-risk-high-bg text-risk-high-fg border-risk-high-border',
    solid: 'bg-risk-high-solid-bg text-risk-high-solid-fg border-transparent',
    shape: 'border-[3px]',
  },
  CRITICAL: {
    subtle: 'bg-risk-critical-bg text-risk-critical-fg border-risk-critical-border',
    solid: 'bg-risk-critical-solid-bg text-risk-critical-solid-fg border-transparent',
    shape: 'border-[3px] ring-1 ring-inset ring-current/40',
  },
};
