/**
 * PharosGRC — per-`IndicatorMetricKey` visual tokens (T060,
 * 009-indicators-reports).
 *
 * Icons and colors, never user-facing text — no message-catalog entry is
 * needed here (CLAUDE.md §11.1 only governs strings). Kept local to this
 * feature rather than imported from `features/dashboard/components/
 * chart-tokens.ts` (which already declares an identical
 * `RiskLevel -> chart color` map for the dashboard's own charts):
 * business modules must not depend directly on each other (CLAUDE.md §2,
 * §4), and duplicating four CSS-variable-name strings is a far smaller
 * cost than a cross-feature import for a purely cosmetic mapping.
 *
 * `BUCKET_LEVEL_ORDER`/`RISK_LEVEL_CHART_COLOR` key on `RiskLevel`
 * (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`) because every `BY_BUCKET` metric in
 * the catalog (`RISK_TOTAL_BY_LEVEL`, `FINDING_OPEN_COUNT_BY_SEVERITY`,
 * `INCIDENT_OPEN_COUNT_BY_SEVERITY`, `PROBLEM_OPEN_COUNT_BY_SEVERITY`)
 * buckets by an enum (`RiskLevel`/`FindingSeverity`/`IncidentSeverity`/
 * `ProblemSeverity`) that shares this exact four-value set — verified
 * against `apps/api/prisma/schema.prisma` — so the same `RiskLevel` type
 * and the same `RiskLevelBadge` vocabulary apply to all four without a
 * translation table, exactly as `MetricCard`'s own doc comment describes.
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

/** One icon per source domain (not per key) — the platform's other domain icons already established by `navigation-registry.ts`, reused here for the same visual identity (CLAUDE.md §18.11 "identidade visual reconhecível"). Finding/Action have no nav icon of their own (they are sub-resources, not top-level modules) — chosen fresh, in the same spirit. */
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

/** Fixed, ascending display order for any four-value LOW/MEDIUM/HIGH/CRITICAL bucket — never the object-key insertion order the API happens to return (`Record` has none it guarantees). */
export const BUCKET_LEVEL_ORDER: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** Same `solid`-emphasis pairing `RiskLevelBadge`'s own visuals use, so a `TrendChart` series line and the badge for the same level never disagree (mirrors `features/dashboard/components/chart-tokens.ts`'s own `RISK_LEVEL_CHART_COLOR`, duplicated rather than imported — see this file's header). */
export const RISK_LEVEL_CHART_COLOR: Readonly<Record<RiskLevel, string>> = {
  LOW: 'var(--risk-low-solid-bg)',
  MEDIUM: 'var(--risk-medium-solid-bg)',
  HIGH: 'var(--risk-high-solid-bg)',
  CRITICAL: 'var(--risk-critical-solid-bg)',
};

/** Runtime-safe cast for a bucket key returned by the API (`Record<string, number>`) into the closed `RiskLevel` union `MetricCard`/`RiskLevelBadge` require — `undefined` for anything outside the four known values, so a caller can skip it instead of rendering a bogus badge. */
export function toRiskLevel(bucketKey: string): RiskLevel | undefined {
  return (BUCKET_LEVEL_ORDER as readonly string[]).includes(bucketKey)
    ? (bucketKey as RiskLevel)
    : undefined;
}
