/**
 * 009-indicators-reports, Fase 2 (T014, data-model.md §1). Pure domain
 * data shape for one `ReportDefinition` row — same convention as
 * `modules/indicators/domain/indicator-definition.entity.ts` (itself
 * mirroring `FrameworkRecord`): a plain, Prisma-independent record, never
 * a re-export of the Prisma model (ADR-009).
 */
import type { IndicatorMetricKey } from '@prisma/client';

export interface ReportDefinitionRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  /** Non-empty, application-validated (data-model.md §1 — the column type
   * itself only guarantees every element is a valid `IndicatorMetricKey`,
   * never that the array is non-empty). */
  readonly metricKeys: readonly IndicatorMetricKey[];
  readonly isActive: boolean;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
