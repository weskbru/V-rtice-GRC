/**
 * 009-indicators-reports, Fase 2 (T013, data-model.md §4, spec.md FR-016/
 * FR-019). The ONE place `breached` is ever computed for an
 * `IndicatorMeasurement` — the same "single centralized rule set" shape
 * `RiskScoringService`/`grc/shared/domain/overdue.service.ts` already
 * establish for their own domains (CLAUDE.md §19.7). `Fase 4`'s
 * `IndicatorCalculationService` (T029) calls this; nothing else ever
 * re-derives `breached` a second way.
 *
 * Pure domain function: no I/O, no framework import (a type-only import of
 * `@prisma/client`'s generated `IndicatorThresholdComparator` enum is the
 * same accepted exception `overdue.service.ts` documents for
 * `ActionStatus`).
 *
 * `comparator`/`thresholdValue` are both nullable, together — Invariant T1
 * (data-model.md §1) guarantees an `IndicatorDefinition` never has one
 * without the other, but a `metric_key` may have NO `IndicatorDefinition`
 * at all (data-model.md §1: a definition is optional configuration), which
 * this function models the same way: "no threshold configured" is
 * `comparator === null` (equivalently `thresholdValue === null`), and NEVER
 * breaches (spec.md FR-019) — the caller is not required to branch on
 * "does a definition exist" before calling this.
 */
import type { IndicatorThresholdComparator } from '@prisma/client';

export function evaluateThresholdBreach(
  comparator: IndicatorThresholdComparator | null,
  value: number,
  thresholdValue: number | null,
): boolean {
  // FR-019 — no threshold configured never breaches. Checked on both
  // together (Invariant T1 already guarantees they agree), never on just
  // one, so a caller that violates the invariant fails safe (no breach)
  // rather than throwing here — validating Invariant T1 itself is the
  // WRITE path's job (`CreateIndicatorDefinitionUseCase`, Fase 3), not
  // this read-only evaluator's.
  if (comparator === null || thresholdValue === null) {
    return false;
  }

  switch (comparator) {
    case 'GTE':
      return value >= thresholdValue;
    case 'GT':
      return value > thresholdValue;
    case 'LTE':
      return value <= thresholdValue;
    case 'LT':
      return value < thresholdValue;
    default: {
      // Exhaustiveness guard — `IndicatorThresholdComparator` is a closed,
      // four-value enum (data-model.md §4); a fifth value added without
      // updating this switch fails `tsc` here (`comparator` would no
      // longer be assignable to `never`), not silently returns `false`.
      const exhaustiveCheck: never = comparator;
      throw new Error(
        `evaluateThresholdBreach: unhandled IndicatorThresholdComparator "${String(exhaustiveCheck)}".`,
      );
    }
  }
}
