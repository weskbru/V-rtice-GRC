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

export const ACTION_STATUS_CHART_COLOR: Readonly<Record<ActionStatus, string>> = {
  OPEN: 'var(--viz-categorical-1)',
  IN_PROGRESS: 'var(--viz-categorical-2)',
  COMPLETED: 'var(--viz-categorical-3)',
  CANCELLED: 'var(--viz-muted)',
};

export const CHART_AXIS_COLOR = 'var(--muted-foreground)';
export const CHART_GRID_COLOR = 'var(--border)';
export const CHART_LABEL_COLOR = 'var(--foreground)';
