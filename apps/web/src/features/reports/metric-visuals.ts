/**
 * PharosGRC — per-`IndicatorMetricKey` visual tokens for the Reports feature (009-indicators-
 * reports, T061).
 *
 * A small, self-contained copy of `features/indicators/metric-visuals.ts`'s own icon map —
 * deliberately NOT imported from that module (CLAUDE.md §2, §4: business modules must not depend
 * directly on each other; that file's own header names this exact trade-off for its own
 * duplication of `features/dashboard`'s chart-token map, and the same reasoning applies here:
 * duplicating eleven icon-name-to-component associations is a far smaller cost than a
 * cross-feature import for a purely cosmetic mapping). Kept identical to `features/indicators/
 * metric-visuals.ts`'s own map on purpose — the same domain always gets the same icon, wherever
 * its metric appears (CLAUDE.md §18.11, "identidade visual reconhecível").
 *
 * `BUCKET_LEVEL_ORDER`/`toRiskLevel` are the same fixed LOW/MEDIUM/HIGH/CRITICAL vocabulary
 * `MetricCard`'s `byBucket` shape and `RiskLevelBadge` already use — every `BY_BUCKET` metric in
 * the catalog buckets by an enum sharing this exact four-value set (verified against
 * `apps/api/prisma/schema.prisma`, same verification `features/indicators/metric-visuals.ts`'s
 * own header cites).
 */
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
import type { RiskLevel } from '@pharos/design-system/components';
import type { ComponentType, SVGProps } from 'react';

/** One icon per source domain (not per key) — same map `features/indicators/metric-visuals.ts` declares, duplicated per this file's own header. */
export const REPORT_METRIC_ICON: Readonly<
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

/** Fixed, ascending display order for any four-value LOW/MEDIUM/HIGH/CRITICAL bucket — never the object-key insertion order the API happens to return. */
export const BUCKET_LEVEL_ORDER: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** Runtime-safe cast for a bucket key returned by the API (`Record<string, number>`) into the closed `RiskLevel` union `MetricCard`/`RiskLevelBadge` require — `undefined` for anything outside the four known values. */
export function toRiskLevel(bucketKey: string): RiskLevel | undefined {
  return (BUCKET_LEVEL_ORDER as readonly string[]).includes(bucketKey)
    ? (bucketKey as RiskLevel)
    : undefined;
}
