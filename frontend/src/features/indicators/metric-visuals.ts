import {
  AlertTriangle,
  Gavel,
  ListChecks,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Warehouse,
  Workflow,
} from 'lucide-react';

import type { IndicatorMetricKey } from './types';
import type { RiskLevel } from '@vertice/design-system/components';
import type { ComponentType, SVGProps } from 'react';

export const INDICATOR_METRIC_ICON: Readonly<
  Record<IndicatorMetricKey, ComponentType<SVGProps<SVGSVGElement>>>
> = {
  RISK_TOTAL_BY_LEVEL: ShieldAlert,
  RISK_TREATMENT_OVERDUE_COUNT: ShieldAlert,
  CONTROL_INACTIVE_COUNT: ShieldCheck,
  COMPLIANCE_PERCENTAGE: ScrollText,
  AUDIT_ENGAGEMENT_OPEN_COUNT: Gavel,
  FINDING_OPEN_COUNT_BY_SEVERITY: Search,
  ASSET_INACTIVE_COUNT: Warehouse,
  PROCESS_INACTIVE_COUNT: Workflow,
  ACTION_OVERDUE_COUNT: ListChecks,
  INCIDENT_OPEN_COUNT_BY_SEVERITY: Siren,
  PROBLEM_OPEN_COUNT_BY_SEVERITY: AlertTriangle,
};

export const BUCKET_LEVEL_ORDER: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const RISK_LEVEL_CHART_COLOR: Readonly<Record<RiskLevel, string>> = {
  LOW: 'var(--risk-low-solid-bg)',
  MEDIUM: 'var(--risk-medium-solid-bg)',
  HIGH: 'var(--risk-high-solid-bg)',
  CRITICAL: 'var(--risk-critical-solid-bg)',
};

export function toRiskLevel(bucketKey: string): RiskLevel | undefined {
  return (BUCKET_LEVEL_ORDER as readonly string[]).includes(bucketKey)
    ? (bucketKey as RiskLevel)
    : undefined;
}
