/**
 * 009-indicators-reports, Fase 2 (T012, data-model.md §3, research.md D-4).
 *
 * `INDICATOR_METRIC_CATALOG` is the static map `IndicatorMetricKey ->
 * { sourcePermission, scopeApplicability, shape }` data-model.md §3
 * describes. Pure domain data — no I/O, no framework import (a type-only
 * import of `@prisma/client`'s generated enum is the same accepted
 * exception `grc/shared/domain/overdue.service.ts` documents for
 * `ActionStatus`) — because this is a compile-time-reviewed decision of
 * which domain each metric key reads from, never data a caller or an
 * administrator can edit at runtime (research.md D-4's own reasoning:
 * "closed platform enums grow by reviewed migration", the same discipline
 * `EvidenceSubjectType`/`ActionOriginType` already follow).
 *
 * - `sourcePermission` — the source domain's OWN read permission FR-006
 *   requires in conjunction with `indicator:view` (checked by the use case
 *   that consumes both — Fase 3's own scope, not this file's).
 * - `scopeApplicability` — `'ORGANIZATIONAL_UNIT'` for the ten keys whose
 *   source has its own `orgUnitId`; `'ORGANIZATION_WIDE'` only for
 *   `COMPLIANCE_PERCENTAGE` (research.md D-8 — `Requirement`/
 *   `FrameworkVersion` have no organizational-unit column at all).
 * - `shape` — `'SINGLE_VALUE'` when the metric produces one number,
 *   `'BY_BUCKET'` when it produces a distribution keyed by another domain
 *   enum's values (data-model.md §2's Invariant M1: which of
 *   `IndicatorMeasurement.value`/`valueByBucket` a point of this key
 *   populates).
 *
 * ## Exhaustiveness (T012's own second half)
 *
 * `test/unit/indicator-metric-catalog.spec.ts` derives its expected key
 * list from `Object.values(IndicatorMetricKey)` — the GENERATED enum, not
 * a second, hand-written list living in the test file — so a twelfth
 * value added to the enum without a matching entry here fails that test
 * for real, not only in appearance. See that test's own header for the
 * mutation experiment that proves it.
 */
import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { IndicatorMetricKey } from '@prisma/client';

export type IndicatorMetricScopeApplicability = 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';

export type IndicatorMetricShape = 'SINGLE_VALUE' | 'BY_BUCKET';

export interface IndicatorMetricCatalogEntry {
  /** The source domain's own read permission, required alongside
   * `indicator:view` (FR-006). */
  readonly sourcePermission: PermissionIdentifier;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly shape: IndicatorMetricShape;
}

export const INDICATOR_METRIC_CATALOG: Readonly<
  Record<IndicatorMetricKey, IndicatorMetricCatalogEntry>
> = {
  RISK_TOTAL_BY_LEVEL: {
    sourcePermission: 'risk:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'BY_BUCKET',
  },
  RISK_TREATMENT_OVERDUE_COUNT: {
    sourcePermission: 'risk:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  CONTROL_INACTIVE_COUNT: {
    sourcePermission: 'control:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  // The only ORGANIZATION_WIDE key (research.md D-8): `Requirement`/
  // `FrameworkVersion` have no `orgUnitId` column at all — a framework
  // applies to the whole organization, never to one unit.
  COMPLIANCE_PERCENTAGE: {
    sourcePermission: 'compliance:view',
    scopeApplicability: 'ORGANIZATION_WIDE',
    shape: 'SINGLE_VALUE',
  },
  AUDIT_ENGAGEMENT_OPEN_COUNT: {
    sourcePermission: 'audit-engagement:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  FINDING_OPEN_COUNT_BY_SEVERITY: {
    sourcePermission: 'finding:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'BY_BUCKET',
  },
  ASSET_INACTIVE_COUNT: {
    sourcePermission: 'asset:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  PROCESS_INACTIVE_COUNT: {
    sourcePermission: 'process:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  ACTION_OVERDUE_COUNT: {
    sourcePermission: 'action:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  INCIDENT_OPEN_COUNT_BY_SEVERITY: {
    sourcePermission: 'incident:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'BY_BUCKET',
  },
  PROBLEM_OPEN_COUNT_BY_SEVERITY: {
    sourcePermission: 'problem:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'BY_BUCKET',
  },
};

/** Looks up one key's catalog entry. `Record<IndicatorMetricKey, ...>`
 * above already guarantees, at compile time, that every enum member has an
 * entry — this accessor exists only so call sites do not index the
 * constant directly. */
export function getIndicatorMetricCatalogEntry(
  metricKey: IndicatorMetricKey,
): IndicatorMetricCatalogEntry {
  return INDICATOR_METRIC_CATALOG[metricKey];
}

/**
 * 009-indicators-reports, Fase 8 (T068 prep) — `GET /indicators/metric-keys`
 * (`listIndicatorMetricKeys`)'s own source of "every key in the closed
 * catalog", in declaration order. The ONE place `Object.keys(
 * INDICATOR_METRIC_CATALOG)` is cast back to `IndicatorMetricKey[]` — a
 * safe cast here specifically because `INDICATOR_METRIC_CATALOG` above is
 * typed `Record<IndicatorMetricKey, ...>`, so its own keys are exactly
 * that enum's members, never a wider `string`.
 */
export function listAllIndicatorMetricKeys(): readonly IndicatorMetricKey[] {
  return Object.keys(INDICATOR_METRIC_CATALOG) as IndicatorMetricKey[];
}

/**
 * Fase 3 (T030, FR-010) — runtime membership check for a caller-supplied
 * string (an HTTP path segment or request body field, neither of which the
 * type system can narrow for us). Checked against `INDICATOR_METRIC_CATALOG`'s
 * own keys via `hasOwnProperty` rather than by importing `IndicatorMetricKey`
 * as a VALUE and calling `Object.values` on it — the catalog object above is
 * already the single source of truth for "every known key", and this keeps
 * the file's `@prisma/client` import type-only (this file's own header),
 * matching `indicator-threshold.ts`'s identical choice for
 * `IndicatorThresholdComparator`.
 */
export function isIndicatorMetricKey(value: string): value is IndicatorMetricKey {
  return Object.prototype.hasOwnProperty.call(INDICATOR_METRIC_CATALOG, value);
}

/**
 * Combines the membership check above with the lookup, for the common
 * caller shape "validate then read" (`GetIndicatorCurrentValueUseCase`,
 * `CreateIndicatorDefinitionUseCase`) — `undefined` for a key outside the
 * closed catalog (FR-010), never a thrown error: an unknown key is an
 * ordinary, expected input a caller must be able to check without a
 * try/catch.
 */
export function findIndicatorMetricCatalogEntry(
  value: string,
): (IndicatorMetricCatalogEntry & { readonly metricKey: IndicatorMetricKey }) | undefined {
  if (!isIndicatorMetricKey(value)) {
    return undefined;
  }
  return { metricKey: value, ...INDICATOR_METRIC_CATALOG[value] };
}
