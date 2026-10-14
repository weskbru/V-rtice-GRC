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
