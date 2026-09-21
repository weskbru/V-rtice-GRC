/**
 * 009-indicators-reports, Fase 4 (T035/T036, data-model.md §2). Pure domain
 * data shape for one `IndicatorMeasurement` row — mirrors
 * `IndicatorDefinitionRecord`'s own convention (`indicator-definition.
 * entity.ts`'s own header): a plain, Prisma-independent record the
 * presentation layer's mapper reshapes into its DTO (ADR-009).
 *
 * **Invariant M1** (data-model.md §2): exactly one of `value`/
 * `valueByBucket` is non-null, never both nor neither — which one depends
 * on the `metricKey`'s own `shape` (`indicator-metric-catalog.ts`). This
 * type does not enforce that itself (it is a plain record, not a smart
 * constructor); `CreateIndicatorMeasurementUseCase` is the one write path
 * that ever produces a value of this shape, and it derives both fields
 * from the SAME `IndicatorCalculationService.calculate` result that
 * already respects the invariant (`IndicatorCalculationResult`'s own
 * header).
 *
 * No `updatedAt` — this table has none (data-model.md §2: "não existe
 * operação que atualize uma linha desta tabela").
 */
import type { IndicatorMetricKey } from '@prisma/client';

export interface IndicatorMeasurementRecord {
  readonly id: string;
  readonly metricKey: IndicatorMetricKey;
  /** Populated only when the metric's `shape` is `SINGLE_VALUE`
   * (Invariant M1). */
  readonly value: number | null;
  /** Populated only when the metric's `shape` is `BY_BUCKET`
   * (Invariant M1). */
  readonly valueByBucket: Readonly<Record<string, number>> | null;
  /** Computed once, at creation, against whatever `IndicatorDefinition`
   * threshold existed for `metricKey` at that instant (research.md D-7) —
   * NEVER recalculated afterward. */
  readonly breached: boolean;
  readonly computedAt: Date;
  readonly computedByUserId: string;
}
