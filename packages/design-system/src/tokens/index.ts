/**
 * PharosGRC Design System — design tokens barrel.
 *
 * Re-exports every token module and assembles a single typed `tokens` object
 * so components, tests and future chart code (Recharts series colors) can
 * import one stable value instead of wiring up each module individually.
 * The canonical, styling-facing form of these same values is the Tailwind 4
 * `@theme` layer in `../styles/globals.css` — this module exists so
 * non-Tailwind consumers see identical values (Constitution X: one design
 * system, consumed identically everywhere).
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './radius';
export * from './elevation';
export * from './motion';

import {
  brand,
  neutral,
  riskSeverityDark,
  riskSeverityLight,
  statusDark,
  statusLight,
  surfaceDark,
  surfaceLight,
} from './colors';
import { elevation } from './elevation';
import { interactionState, motion } from './motion';
import { radius, radiusBase } from './radius';
import { space } from './spacing';
import { fontFamily, fontWeight, typeScale } from './typography';

export const tokens = {
  color: {
    neutral,
    brand,
    status: { light: statusLight, dark: statusDark },
    riskSeverity: { light: riskSeverityLight, dark: riskSeverityDark },
    surface: { light: surfaceLight, dark: surfaceDark },
  },
  typography: { fontFamily, fontWeight, typeScale },
  space,
  radius: { base: radiusBase, ...radius },
  elevation,
  motion,
  interactionState,
} as const;

export type DesignTokens = typeof tokens;
