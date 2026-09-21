/**
 * 009-indicators-reports, Fase 4 (T035/T036, data-model.md §2/§8) — port
 * for `IndicatorMeasurement`'s two operations: append one point
 * (`createIndicatorMeasurement`), and read the organization-wide series
 * back, oldest first (`listIndicatorMeasurements`).
 *
 * **No `ScopeFilter` parameter anywhere in this file, deliberately** — the
 * same reasoning `IndicatorDefinitionRepositoryPort`'s own header gives for
 * itself, but for a different underlying fact here: `indicator_measurements`
 * has no `org_unit_id` column at all (data-model.md §2/§8), because every
 * row is, by construction, organization-wide (research.md D-6). The scope
 * restriction for this resource is therefore not a query predicate — it is
 * the caller-level gate `CreateIndicatorMeasurementUseCase`/
 * `ListIndicatorMeasurementsUseCase` each apply BEFORE ever calling a
 * method on this port: `ScopeFilter.kind !== 'GLOBAL'` is refused with
 * `403` before this port is touched at all, so by the time either method
 * below runs, "the caller may see the whole series" has already been
 * established the only way it can be (an explicit, audited `OrgScopeGrant`
 * of kind `GLOBAL`) — not by this port re-deriving or re-checking it.
 *
 * **No update, no delete** — mirrors the table itself (data-model.md §2:
 * "não existe operação que atualize uma linha desta tabela", SC-002). This
 * port declares exactly the two operations the append-only resource has.
 */
import type { IndicatorMeasurementRecord } from '../indicator-measurement.entity';
import type { IndicatorMetricKey } from '@prisma/client';

export interface CreateIndicatorMeasurementInput {
  readonly metricKey: IndicatorMetricKey;
  /** Invariant M1 is enforced by the CALLER
   * (`CreateIndicatorMeasurementUseCase`, via `IndicatorCalculationService`'s
   * own result shape) before this method is ever invoked — this port
   * simply persists whatever it is given, exactly one of the two
   * populated. */
  readonly value: number | null;
  readonly valueByBucket: Readonly<Record<string, number>> | null;
  readonly breached: boolean;
  readonly computedByUserId: string;
}

export interface IndicatorMeasurementListQuery {
  readonly metricKey: IndicatorMetricKey;
  readonly page: number;
  readonly pageSize: number;
}

export interface IndicatorMeasurementListPage {
  readonly items: readonly IndicatorMeasurementRecord[];
  readonly total: number;
}

export abstract class IndicatorMeasurementRepositoryPort {
  /** `POST /indicators/{metricKey}/measurements` (FR-011). Appends one
   * row — this table has no natural key to collide on beyond its own
   * generated `id` (data-model.md §2: "o par `(metric_key, computed_at)`
   * já é um identificador natural", never enforced as a uniqueness
   * constraint — two points for the same key in the same instant are not
   * prevented, and no requirement asks for that). */
  abstract create(input: CreateIndicatorMeasurementInput): Promise<IndicatorMeasurementRecord>;

  /** `GET /indicators/{metricKey}/measurements` (FR-015). Chronological,
   * oldest first (`contracts/indicators.openapi.yaml`'s own
   * `listIndicatorMeasurements` description) — ordered by `computedAt`,
   * the same column data-model.md §2's `@@index([metricKey, computedAt])`
   * exists for. */
  abstract list(query: IndicatorMeasurementListQuery): Promise<IndicatorMeasurementListPage>;
}
