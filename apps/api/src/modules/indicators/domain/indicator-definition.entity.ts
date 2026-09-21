/**
 * 009-indicators-reports, Fase 2 (T014, data-model.md §1). Pure domain
 * data shape for one `IndicatorDefinition` row — mirrors `FrameworkRecord`'s
 * own convention (`modules/compliance/domain/framework.entity.ts`) of a
 * plain, Prisma-independent record the presentation layer's mapper (a
 * future Fase 3 task) reshapes into its DTO, never a re-export of the
 * Prisma model itself (ADR-009).
 */
import type { IndicatorMetricKey, IndicatorThresholdComparator } from '@prisma/client';

export interface IndicatorDefinitionRecord {
  readonly id: string;
  readonly code: string;
  readonly metricKey: IndicatorMetricKey;
  readonly name: string;
  readonly description: string;
  readonly ownerUserId: string;
  /** Invariant T1 (data-model.md §1) — populated together with
   * `thresholdValue`, or neither. */
  readonly thresholdComparator: IndicatorThresholdComparator | null;
  /** Invariant T1 — populated together with `thresholdComparator`, or
   * neither. */
  readonly thresholdValue: number | null;
  readonly isActive: boolean;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
