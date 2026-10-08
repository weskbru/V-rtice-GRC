import { CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react';

import type { RiskSeverityToken } from '../../tokens/colors';
import type { ComponentType, SVGProps } from 'react';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const ICON: Record<RiskSeverityToken['icon'], ComponentType<SVGProps<SVGSVGElement>>> = {
  CircleCheck,
  TriangleAlert,
  OctagonAlert,
};

export const RISK_LEVEL_ICON: Record<RiskLevel, ComponentType<SVGProps<SVGSVGElement>>> = {
  LOW: ICON.CircleCheck,
  MEDIUM: ICON.TriangleAlert,
  HIGH: ICON.TriangleAlert,
  CRITICAL: ICON.OctagonAlert,
};

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
