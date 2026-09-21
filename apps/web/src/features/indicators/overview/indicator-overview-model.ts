/**
 * PharosGRC — pure data model for the Indicadores overview screen
 * (indicators-round, S2 ownership — see coordinator PLAN.md §3/§4).
 *
 * This module performs NO I/O and holds NO React state: it turns a
 * `GET /dashboard/summary` response plus a `GET /indicators` definitions
 * page into the `IndicatorOverviewItem[]`/`IndicatorOverviewData` shapes the
 * view layer (S1) renders. Every number here is read straight from one of
 * those two responses — the only arithmetic is `total = sum of buckets`,
 * which mirrors `features/dashboard/summary.ts#bucketTotal`'s own documented
 * exception (adding parts of the SAME response, never deriving across
 * requests) — CLAUDE.md §19.7, one calculator, never re-derived here.
 *
 * `breached`/normal-attention-critical classification is deliberately NEVER
 * computed anywhere in this file — S1's backend investigation (research
 * folder `s1-backend-domain.md`, Q5/Q6) confirmed the platform has no
 * three-tier severity concept, and the one binary `breached` flag that does
 * exist is computed exactly once, server-side, per CLAUDE.md §19.7. This
 * model only ever exposes a `threshold` VALUE (comparator + number) for the
 * view to print as a plain fact ("Limite: ≥ N") — never a computed
 * pass/fail state.
 */
import { BUCKET_LEVEL_ORDER } from '../metric-visuals';

import type {
  IndicatorDefinition,
  IndicatorMetricKey,
  IndicatorMetricShape,
  IndicatorScopeApplicability,
  IndicatorThresholdComparator,
} from '../types';
import type { DashboardBreakdowns, DashboardSummaryMetric } from '@/features/dashboard/types';
import type { PermissionId } from '@/lib/permissions';

/** One business domain a catalog key belongs to — the coordinator's approved closed set (PLAN.md §4). */
export type IndicatorDomain =
  | 'RISK'
  | 'ACTION'
  | 'PROBLEM'
  | 'INCIDENT'
  | 'CONTROL'
  | 'ASSET'
  | 'PROCESS'
  | 'COMPLIANCE'
  | 'AUDIT'
  | 'FINDING';

export interface IndicatorThreshold {
  readonly comparator: IndicatorThresholdComparator;
  readonly value: number;
}

export interface IndicatorBucket {
  /** One of `BUCKET_LEVEL_ORDER`'s four values (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`) — the same closed vocabulary `RiskLevelBadge` renders, shared by every `BY_BUCKET` key (metric-visuals.ts's own header). */
  readonly key: string;
  /** Zero-filled — every bucket in `BUCKET_LEVEL_ORDER` is always present, even at 0 (never omitted). */
  readonly count: number;
  /** Only set when S1's approved navigation table has an exact, permitted target for this bucket. */
  readonly href?: string;
}

export type IndicatorReading =
  | { readonly kind: 'single'; readonly value: number; readonly unit: 'count' | 'percent' }
  | {
      readonly kind: 'buckets';
      readonly buckets: readonly IndicatorBucket[];
      readonly total: number;
    }
  | { readonly kind: 'no-data' }
  | { readonly kind: 'no-permission' };

export interface IndicatorOverviewItem {
  readonly metricKey: IndicatorMetricKey;
  readonly domain: IndicatorDomain;
  readonly shape: IndicatorMetricShape;
  readonly scopeApplicability: IndicatorScopeApplicability;
  readonly reading: IndicatorReading;
  readonly detailHref: string;
  readonly recordsHref?: string;
  readonly threshold?: IndicatorThreshold;
  readonly definition?: { readonly name: string; readonly description?: string };
}

export interface IndicatorOverviewData {
  /** Always all 11 catalog keys, in catalog order — never filtered, never reordered. */
  readonly items: readonly IndicatorOverviewItem[];
  /** Absent exactly when `summary.breakdowns.indicators` is absent (caller lacks the permission that block requires, or the server omitted it). */
  readonly monitoring?: { readonly monitored: number; readonly breached: number };
  /** When the successful `/dashboard/summary` response arrived. */
  readonly fetchedAt: Date;
}

/**
 * One catalog fact per key: which business domain it belongs to, and its
 * static `shape`/`scopeApplicability` (used as a fallback when the live
 * summary response omitted the key entirely — `no-permission` items still
 * need a real `shape`/`scopeApplicability` to satisfy the contract, which
 * declares both as required, non-optional fields).
 *
 * Source: S1's backend investigation, `s1-backend-domain.md` Q9 (verified
 * against `apps/api/.../indicator-metric-catalog.ts:52-113`). Object key
 * order below IS the catalog's display order — every consumer of
 * `INDICATOR_METRIC_KEY_ORDER` gets the same order this codebase already
 * uses (`indicator-catalog-view.tsx`'s own `Object.keys(INDICATOR_METRIC_ICON)`).
 *
 * `Record<IndicatorMetricKey, ...>` is deliberately total: `IndicatorMetricKey`
 * is a closed union re-exported from the generated OpenAPI contract
 * (`../types.ts`), so a twelfth key added there fails `tsc` here immediately
 * — the same compile-time guarantee `lib/messages/indicators.ts`'s own
 * `INDICATOR_METRIC_KEY_LABELS` already relies on. `indicator-overview-model
 * .test.ts` additionally cross-checks this record's key set against
 * `INDICATOR_METRIC_ICON`'s (the OTHER existing exhaustive-by-construction
 * enumeration of the same union) as a second, independent, runtime guard.
 */
const INDICATOR_CATALOG: Readonly<
  Record<
    IndicatorMetricKey,
    {
      domain: IndicatorDomain;
      shape: IndicatorMetricShape;
      scopeApplicability: IndicatorScopeApplicability;
    }
  >
> = {
  RISK_TOTAL_BY_LEVEL: {
    domain: 'RISK',
    shape: 'BY_BUCKET',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  RISK_TREATMENT_OVERDUE_COUNT: {
    domain: 'RISK',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  CONTROL_INACTIVE_COUNT: {
    domain: 'CONTROL',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  // The one org-wide key (s1-backend-domain.md Q9/Q15): Requirement/FrameworkVersion carry no
  // org-unit column, so this is the same number for every caller regardless of their own scope.
  COMPLIANCE_PERCENTAGE: {
    domain: 'COMPLIANCE',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATION_WIDE',
  },
  AUDIT_ENGAGEMENT_OPEN_COUNT: {
    domain: 'AUDIT',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  FINDING_OPEN_COUNT_BY_SEVERITY: {
    domain: 'FINDING',
    shape: 'BY_BUCKET',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  ASSET_INACTIVE_COUNT: {
    domain: 'ASSET',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  PROCESS_INACTIVE_COUNT: {
    domain: 'PROCESS',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  ACTION_OVERDUE_COUNT: {
    domain: 'ACTION',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  INCIDENT_OPEN_COUNT_BY_SEVERITY: {
    domain: 'INCIDENT',
    shape: 'BY_BUCKET',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  PROBLEM_OPEN_COUNT_BY_SEVERITY: {
    domain: 'PROBLEM',
    shape: 'BY_BUCKET',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
};

/** Catalog display order — the same order every existing indicator screen already uses. */
export const INDICATOR_METRIC_KEY_ORDER: readonly IndicatorMetricKey[] = Object.keys(
  INDICATOR_CATALOG,
) as readonly IndicatorMetricKey[];

/** Small standalone lookup for a caller that only needs the domain, without building a full item (e.g. a future domain-chip filter list). Not otherwise used inside this module — `buildIndicatorOverviewItems` reads `INDICATOR_CATALOG` directly. */
export function indicatorDomain(metricKey: IndicatorMetricKey): IndicatorDomain {
  return INDICATOR_CATALOG[metricKey].domain;
}

// ---------------------------------------------------------------------------
// Navigation — exact-match-only, permission-gated
// ---------------------------------------------------------------------------

export interface IndicatorNavigationEntry {
  /** The source register's own view permission (`navigation-registry.ts`'s `requiredPermission` for that module) — checked with the caller's `hasPermission` before any href is produced. */
  readonly permission: PermissionId;
  /** `GET`-reproducible URL for "all records this metric counts" — omitted entirely when no register filter reproduces the metric exactly (coordinator PLAN.md §1 row "Navigation to source records"). */
  readonly recordsHref?: string;
  /** Per-bucket URL builder, for `BY_BUCKET` keys whose register accepts a bucket-level filter (e.g. `riskLevel=CRITICAL`). Absent when no such filter exists. */
  readonly bucketHref?: (bucketKey: string) => string | undefined;
}

/**
 * The approved metricKey → register-URL table. Every entry below was
 * measured, not guessed: S3's rendered-exactness probe
 * (`indicators-round/s3-nav-exactness.md`) fetched each metric's live
 * `/current` value and compared it against the CANDIDATE register URL's own
 * rendered result count, seconds apart, in a real browser — 19 of 22 probed
 * candidates matched exactly; the 3 that did not (see the two "NO" notes
 * below, plus `AUDIT_ENGAGEMENT_OPEN_COUNT`'s two-request-only sum) are
 * exactly why 3 of the 11 keys below have no link at all rather than an
 * approximate one. `permission` is always the DESTINATION register's own
 * `navigationRegistry.requiredPermission` (`components/shell/navigation-
 * registry.ts`) — not necessarily the metric's own `sourcePermission`
 * (`RISK_TREATMENT_OVERDUE_COUNT` is the one case where they differ: the
 * metric reads risk data server-side, but the ONLY exact link is into the
 * Action register).
 *
 * Do not add or change an entry without a fresh S3 exactness measurement —
 * an unapproved/unmeasured key must never produce a link (covered by
 * `indicator-overview-model.test.ts`).
 */
export const INDICATOR_NAVIGATION_TABLE: Readonly<
  Partial<Record<IndicatorMetricKey, IndicatorNavigationEntry>>
> = {
  // Register total (1452) ≠ this metric's own bucket sum (176): most risks have never been
  // assessed (`residualLevel: null`), so there is no exact "ver todos" link for the whole metric —
  // only the 4 PER-BUCKET links are exact (s3-nav-exactness.md row 1 vs. rows 2-5).
  // `riskLevelBasis=RESIDUAL` is written explicitly even though it is the register's own default
  // (`use-register-state.ts` DEFAULT_BASIS) — S3 measured equality against the default, but an
  // explicit basis means this link's meaning never silently changes if that default ever does.
  RISK_TOTAL_BY_LEVEL: {
    permission: 'risk:view',
    bucketHref: (bucketKey) => `/risks?riskLevel=${bucketKey}&riskLevelBasis=RESIDUAL`,
  },
  // NOT `/risks?overdueTreatment=true` (measured 87, this metric is 91) — that page counts
  // DISTINCT RISKS with ≥1 overdue action, while this metric counts the ACTIONS themselves; some
  // risks have 2+ overdue treatment actions. The Action register, filtered to this metric's own
  // origin, is the exact match — `onlyMine=false` is required (the register defaults to the
  // caller's own assigned actions only).
  RISK_TREATMENT_OVERDUE_COUNT: {
    permission: 'action:view',
    recordsHref: '/actions?overdue=true&originType=RISK_TREATMENT&onlyMine=false',
  },
  CONTROL_INACTIVE_COUNT: {
    permission: 'control:view',
    recordsHref: '/controls?status=DRAFT,SUSPENDED,RETIRED',
  },
  ASSET_INACTIVE_COUNT: {
    permission: 'asset:view',
    recordsHref: '/assets?isActive=false',
  },
  PROCESS_INACTIVE_COUNT: {
    permission: 'process:view',
    recordsHref: '/processes?isActive=false',
  },
  // `onlyMine=false` is mandatory, not optional: the register defaults to the caller's own
  // assigned actions only (measured 33), while this metric is organization-wide (measured 92).
  ACTION_OVERDUE_COUNT: {
    permission: 'action:view',
    recordsHref: '/actions?overdue=true&onlyMine=false',
  },
  // Status list mirrors `OPEN_INCIDENT_STATUSES`
  // (apps/api/src/modules/incidents/domain/incident.entity.ts) — no equivalent constant exists on
  // the web side to import from (grepped: none found), hard-coded here with this pointer so a
  // future lifecycle change to that API constant has somewhere obvious to also update this table.
  INCIDENT_OPEN_COUNT_BY_SEVERITY: {
    permission: 'incident:view',
    recordsHref: '/incidents?status=OPEN,IN_PROGRESS,RESOLVED',
    bucketHref: (bucketKey) => `/incidents?status=OPEN,IN_PROGRESS,RESOLVED&severity=${bucketKey}`,
  },
  // Status list mirrors `OPEN_PROBLEM_STATUSES`
  // (apps/api/src/modules/problems/domain/problem-lifecycle.ts) — same "no web-side constant to
  // import" note as INCIDENT_OPEN_COUNT_BY_SEVERITY above.
  PROBLEM_OPEN_COUNT_BY_SEVERITY: {
    permission: 'problem:view',
    recordsHref: '/problems?status=OPEN,IN_ANALYSIS,RESOLVED',
    bucketHref: (bucketKey) => `/problems?status=OPEN,IN_ANALYSIS,RESOLVED&severity=${bucketKey}`,
  },
  // AUDIT_ENGAGEMENT_OPEN_COUNT: the register's own status filter is single-value only
  // (`use-engagement-catalog-state.ts`) — PLANNING+IN_PROGRESS (this metric's own definition)
  // cannot be expressed as one URL, even though the two counts sum exactly (s3-nav-exactness.md).
  // No entry — no misleading half-link.
  //
  // FINDING_OPEN_COUNT_BY_SEVERITY: no `/findings` register route exists at all (Finding is a
  // sub-resource of Audit Engagements only).
  //
  // COMPLIANCE_PERCENTAGE: no register endpoint reproduces a percentage.
};

export interface IndicatorNavigationResolution {
  readonly recordsHref?: string;
  readonly bucketHref: (bucketKey: string) => string | undefined;
}

/**
 * Resolves the navigation links for one metric key. A link is produced only
 * when BOTH an approved table entry exists for the key AND the caller holds
 * that entry's own `permission` (advisory UI-only, `lib/permissions.ts`'s
 * own documented warning — the server remains the real gate). `table`
 * defaults to the shared, coordinator-approved constant; a caller (tests, or
 * a future approved-table swap) may pass a different one explicitly.
 */
export function resolveIndicatorNavigation(
  metricKey: IndicatorMetricKey,
  hasPermission: (permission: PermissionId) => boolean,
  table: Readonly<
    Partial<Record<IndicatorMetricKey, IndicatorNavigationEntry>>
  > = INDICATOR_NAVIGATION_TABLE,
): IndicatorNavigationResolution {
  const entry = table[metricKey];
  if (!entry || !hasPermission(entry.permission)) {
    return { recordsHref: undefined, bucketHref: () => undefined };
  }
  return {
    recordsHref: entry.recordsHref,
    bucketHref: (bucketKey) => entry.bucketHref?.(bucketKey),
  };
}

// ---------------------------------------------------------------------------
// Reading / item construction
// ---------------------------------------------------------------------------

function buildReading(
  metric: DashboardSummaryMetric | undefined,
  metricKey: IndicatorMetricKey,
  bucketHref: (bucketKey: string) => string | undefined,
): IndicatorReading {
  if (!metric) {
    return { kind: 'no-permission' };
  }

  if (metric.shape === 'BY_BUCKET') {
    if (!metric.valueByBucket) {
      return { kind: 'no-data' };
    }
    const source = metric.valueByBucket;
    // Fixed LOW→MEDIUM→HIGH→CRITICAL order (reused from metric-visuals.ts,
    // the same order `MetricCard`/`TrendChart` already render buckets in),
    // zero-filled defensively even though the server already zero-fills
    // (indicator-metric-catalog.ts) — every bucket always renders, never
    // silently dropped for a missing key.
    const buckets: IndicatorBucket[] = BUCKET_LEVEL_ORDER.map((level) => ({
      key: level,
      count: source[level] ?? 0,
      href: bucketHref(level),
    }));
    // The one documented arithmetic exception (CLAUDE.md §19.7 doc comment
    // above): summing parts of the SAME response, never a second request.
    const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    return { kind: 'buckets', buckets, total };
  }

  if (typeof metric.value !== 'number') {
    return { kind: 'no-data' };
  }

  return {
    kind: 'single',
    value: metric.value,
    unit: metricKey === 'COMPLIANCE_PERCENTAGE' ? 'percent' : 'count',
  };
}

function buildThreshold(
  definition: IndicatorDefinition | undefined,
): IndicatorThreshold | undefined {
  if (!definition?.isActive) return undefined;
  if (!definition.thresholdComparator || typeof definition.thresholdValue !== 'number') {
    return undefined;
  }
  return { comparator: definition.thresholdComparator, value: definition.thresholdValue };
}

function buildDefinitionSummary(
  definition: IndicatorDefinition | undefined,
): { name: string; description?: string } | undefined {
  if (!definition?.isActive) return undefined;
  return { name: definition.name, description: definition.description || undefined };
}

export interface BuildIndicatorOverviewItemsParams {
  readonly metrics: readonly DashboardSummaryMetric[];
  /** At most one definition per `metricKey` (server invariant — `schema.prisma`'s own `@unique`). An inactive definition (`isActive: false`) is treated exactly like no definition at all (never surfaced as a threshold or description). */
  readonly definitions: readonly IndicatorDefinition[];
  /** Advisory UI gate for navigation links only — see `resolveIndicatorNavigation`. */
  readonly hasPermission: (permission: PermissionId) => boolean;
  readonly navigationTable?: Readonly<
    Partial<Record<IndicatorMetricKey, IndicatorNavigationEntry>>
  >;
}

/** Builds all 11 `IndicatorOverviewItem`s, always in catalog order, regardless of which keys are present in `metrics`/`definitions`. */
export function buildIndicatorOverviewItems(
  params: BuildIndicatorOverviewItemsParams,
): IndicatorOverviewItem[] {
  const { metrics, definitions, hasPermission, navigationTable } = params;

  const metricsByKey = new Map(metrics.map((metric) => [metric.metricKey, metric]));
  const definitionsByKey = new Map(
    definitions.map((definition) => [definition.metricKey, definition]),
  );

  return INDICATOR_METRIC_KEY_ORDER.map((metricKey) => {
    const catalogEntry = INDICATOR_CATALOG[metricKey];
    const metric = metricsByKey.get(metricKey);
    const definition = definitionsByKey.get(metricKey);
    const navigation = resolveIndicatorNavigation(metricKey, hasPermission, navigationTable);

    const item: IndicatorOverviewItem = {
      metricKey,
      domain: catalogEntry.domain,
      shape: metric?.shape ?? catalogEntry.shape,
      scopeApplicability: metric?.scopeApplicability ?? catalogEntry.scopeApplicability,
      reading: buildReading(metric, metricKey, navigation.bucketHref),
      detailHref: `/indicators/${metricKey}`,
      recordsHref: navigation.recordsHref,
      threshold: buildThreshold(definition),
      definition: buildDefinitionSummary(definition),
    };
    return item;
  });
}

/** `summary.breakdowns.indicators` → the aggregate monitoring line, or `undefined` exactly when that block is absent (never a fabricated `{0, 0}`). */
export function buildIndicatorMonitoring(
  breakdowns: DashboardBreakdowns | undefined,
): { monitored: number; breached: number } | undefined {
  const block = breakdowns?.indicators;
  return block ? { monitored: block.monitored, breached: block.breached } : undefined;
}

export interface BuildIndicatorOverviewDataParams {
  readonly metrics: readonly DashboardSummaryMetric[];
  readonly breakdowns: DashboardBreakdowns | undefined;
  readonly definitions: readonly IndicatorDefinition[];
  readonly hasPermission: (permission: PermissionId) => boolean;
  readonly fetchedAt: Date;
  readonly navigationTable?: Readonly<
    Partial<Record<IndicatorMetricKey, IndicatorNavigationEntry>>
  >;
}

/** Composes `buildIndicatorOverviewItems` + `buildIndicatorMonitoring` into the full `IndicatorOverviewData` the hook returns. */
export function buildIndicatorOverviewData(
  params: BuildIndicatorOverviewDataParams,
): IndicatorOverviewData {
  return {
    items: buildIndicatorOverviewItems({
      metrics: params.metrics,
      definitions: params.definitions,
      hasPermission: params.hasPermission,
      navigationTable: params.navigationTable,
    }),
    monitoring: buildIndicatorMonitoring(params.breakdowns),
    fetchedAt: params.fetchedAt,
  };
}
