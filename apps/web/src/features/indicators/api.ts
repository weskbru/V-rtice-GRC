/**
 * PharosGRC frontend — Indicator API wrapper (009-indicators-reports,
 * T062/T060). Every request/response shape below is typed straight from
 * the generated `@pharos/api-types` `Indicators` namespace (`./types`),
 * never a hand-written mirror, mirroring `features/incidents/api.ts`'s own
 * conventions (same `apiClient`, same error handling — `apiClient` itself
 * normalizes failures into `ApiProblem`/`ApiError`, nothing re-wrapped
 * here).
 *
 * T060 (2026-09-12) adds `createMeasurement`/`listMeasurements` — the two
 * `.../measurements` operations that were deliberately absent from this
 * file's original scope (`indicator.controller.ts` now serves both). Both
 * require the caller's resolved scope to be `GLOBAL` (research.md D-6);
 * this client does not pre-check that (ADR-003 — authorization is a server
 * decision only) and simply lets a `403` surface through `ApiError` like
 * any other refusal, for the caller (`IndicatorHistorySection`) to render
 * as an explained, expected state rather than a generic error.
 *
 * Unlike `risksApi`/`controlsApi`, nothing here carries `If-Match`/`ETag` —
 * `indicators.openapi.yaml` declares no optimistic-locking `version` field
 * on `IndicatorDefinition`, and `IndicatorMeasurement` has no update path
 * of any kind (SC-002 — immutable once created).
 */
import { apiClient } from '@/lib/api-client';

import type {
  CreateIndicatorDefinitionRequest,
  IndicatorCurrentValue,
  IndicatorDefinition,
  IndicatorDefinitionListQuery,
  IndicatorDefinitionListResponse,
  IndicatorMeasurement,
  IndicatorMeasurementListQuery,
  IndicatorMeasurementListResponse,
  IndicatorMetricKey,
} from './types';

/** Builds `GET /indicators`'s query string exactly per its contract: `page`/`pageSize` always set, `isActive` only when the caller actually chose a value (an unset filter must not become `isActive=undefined` in the URL). */
function buildDefinitionListQueryString(query: IndicatorDefinitionListQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.isActive !== undefined) {
    params.set('isActive', String(query.isActive));
  }
  return params.toString();
}

export const indicatorsApi = {
  /** `GET /indicators` — configured indicator definitions only; a catalog key with no definition never appears here (contract `info.description`). */
  listDefinitions(query: IndicatorDefinitionListQuery): Promise<IndicatorDefinitionListResponse> {
    return apiClient.get<IndicatorDefinitionListResponse>(
      `/indicators?${buildDefinitionListQueryString(query)}`,
    );
  },

  /** `POST /indicators` — configures a catalog key; `code` is server-assigned (`IND-YYYY-NNNN`), never client-supplied. A second attempt against an already-configured `metricKey` is rejected with `422`. */
  createDefinition(body: CreateIndicatorDefinitionRequest): Promise<IndicatorDefinition> {
    return apiClient.post<IndicatorDefinition>('/indicators', body);
  },

  /** `GET /indicators/{metricKey}/current` — recomputed live on every call (never stored), under the caller's own resolved scope. Works even when no `IndicatorDefinition` exists for this key. */
  getCurrentValue(metricKey: IndicatorMetricKey): Promise<IndicatorCurrentValue> {
    return apiClient.get<IndicatorCurrentValue>(`/indicators/${metricKey}/current`);
  },

  /** `POST /indicators/{metricKey}/measurements` — computes and permanently records one historical point (no request body: the value is computed server-side, not supplied). `403` when the caller's resolved scope is not `GLOBAL` (research.md D-6), before any source table is read. */
  createMeasurement(metricKey: IndicatorMetricKey): Promise<IndicatorMeasurement> {
    return apiClient.post<IndicatorMeasurement>(`/indicators/${metricKey}/measurements`);
  },

  /** `GET /indicators/{metricKey}/measurements` — the organization-wide historical series, oldest first. Same `403` gate as `createMeasurement`. */
  listMeasurements(
    metricKey: IndicatorMetricKey,
    query: IndicatorMeasurementListQuery,
  ): Promise<IndicatorMeasurementListResponse> {
    const params = new URLSearchParams();
    params.set('page', String(query.page));
    params.set('pageSize', String(query.pageSize));
    return apiClient.get<IndicatorMeasurementListResponse>(
      `/indicators/${metricKey}/measurements?${params.toString()}`,
    );
  },
};
