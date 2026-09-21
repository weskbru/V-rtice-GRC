/**
 * PharosGRC frontend — Indicator types (009-indicators-reports, T062/T060).
 *
 * Every type below is a direct alias into the GENERATED `@pharos/api-types`
 * `Indicators` namespace (`packages/api-types/src/generated/indicators.ts`,
 * produced from `specs/009-indicators-reports/contracts/indicators.openapi
 * .yaml`) — never a hand-written mirror, following the pattern
 * `features/incidents/types.ts`'s own header comment documents and that
 * this feature's own `lib/messages/indicators.ts` header names as T012's
 * pending follow-up (now done here: see `IndicatorMetricKey`/
 * `IndicatorThresholdComparator` below, and that message catalog's own
 * updated header).
 *
 * T060 (2026-09-12) extends this file to the two `.../measurements`
 * operations — `apps/api/src/modules/indicators/presentation/
 * indicator.controller.ts` now serves both alongside the original three, so
 * the deliberate gap this header used to document is closed.
 * `IndicatorMetricCatalogEntry` (`GET /indicators/metric-keys`) and
 * `GET/PATCH /indicators/{definitionId}` remain unaliased — those routes
 * still do not exist (`indicator.controller.ts`'s own header names them as
 * a later phase).
 */
import type { Indicators } from '@pharos/api-types';

/** The eleven-value closed catalog (data-model.md §3) — a compile-time union, not a free string. */
export type IndicatorMetricKey = Indicators.components['schemas']['IndicatorMetricKey'];

/** Whether a metric's current value is a single number or one count per bucket of an underlying domain enum. */
export type IndicatorMetricShape = Indicators.components['schemas']['IndicatorMetricShape'];

/** Whether the server applied an organizational-unit predicate, or the source has none (`COMPLIANCE_PERCENTAGE` only, research.md D-8). */
export type IndicatorScopeApplicability =
  Indicators.components['schemas']['IndicatorScopeApplicability'];

/** The four threshold comparators (data-model.md §4) — no equality/difference operator exists in the registry. */
export type IndicatorThresholdComparator =
  Indicators.components['schemas']['IndicatorThresholdComparator'];

/** `{id, fullName, email?}` — this contract's own `UserRef`, declared locally rather than imported cross-module (CLAUDE.md §2/§4), mirroring every other feature's own copy. */
export type UserRef = Indicators.components['schemas']['UserRef'];

export type IndicatorDefinition = Indicators.components['schemas']['IndicatorDefinition'];
export type CreateIndicatorDefinitionRequest =
  Indicators.components['schemas']['CreateIndicatorDefinitionRequest'];
export type IndicatorCurrentValue = Indicators.components['schemas']['IndicatorCurrentValue'];

/** One immutable historical point (data-model.md §2) — `GET/POST /indicators/{metricKey}/measurements`. */
export type IndicatorMeasurement = Indicators.components['schemas']['IndicatorMeasurement'];

/** `GET /indicators/{metricKey}/measurements`'s own envelope — `{data, meta}`, same convention as `IndicatorDefinitionListResponse` above. */
export type IndicatorMeasurementListResponse =
  Indicators.operations['listIndicatorMeasurements']['responses']['200']['content']['application/json'];

/**
 * `GET /indicators/{metricKey}/measurements` query parameters this client
 * builds — not itself a generated shape, named locally the same way
 * `IndicatorDefinitionListQuery` is above. Only `page`/`pageSize`: the
 * contract declares no other filter for this operation (research.md D-6 —
 * the series is organization-wide and chronological, nothing to narrow by).
 */
export interface IndicatorMeasurementListQuery {
  readonly page: number;
  readonly pageSize: number;
}

/** `GET /indicators`'s own envelope — `{data, meta}`, aligned with every other paginated register endpoint in the platform (see this contract's own `info.description` on why `{items}` never appears here). */
export type IndicatorDefinitionListResponse =
  Indicators.operations['listIndicatorDefinitions']['responses']['200']['content']['application/json'];

/**
 * `GET /indicators` query parameters this client builds — not itself a
 * generated shape (query strings are not typed by `openapi-typescript`'s
 * `operations[...]` the way JSON bodies are), named locally the same way
 * `incidents/types.ts`'s own `IncidentRegisterQuery` is. Deliberately only
 * `page`/`pageSize`/`isActive` — the only parameters
 * `listIndicatorDefinitions` actually declares (no `search`, no `sort`);
 * the catalog is small and closed, so this list has no free-text search or
 * sortable columns to expose yet.
 */
export interface IndicatorDefinitionListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly isActive?: boolean;
}
