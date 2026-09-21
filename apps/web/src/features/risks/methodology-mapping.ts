/**
 * PharosGRC — `RiskMethodologyVersion` → `@pharos/design-system` `RiskMatrix`
 * prop shape mapping (US4, ADR-006).
 *
 * Shared by `assessment-form.tsx` (T129) and `risk-assessment-section.tsx`
 * (T130) — both render the same methodology through the same component and
 * must never drift into two different field-renaming projections of the
 * same data.
 *
 * Every function here is a pure, structural projection — renaming a field
 * or normalizing `null` to `undefined` — never a computation. The
 * score/level values themselves pass straight through from the
 * server-derived `RiskMethodologyVersion.matrix` (ADR-006: scoring is never
 * performed in the browser).
 */
import type { RiskMethodologyVersion, ScalePoint } from './types';
import type { RiskMatrixCell, RiskMatrixScaleLevel } from '@pharos/design-system/components';

/** `ScalePoint.description` is `string | null | undefined` per the contract; `RiskMatrixScaleLevel.description` is `string | undefined` — `null` is normalized to `undefined` here, nothing else changes. */
export function toScaleLevels(scale: readonly ScalePoint[]): readonly RiskMatrixScaleLevel[] {
  return scale.map((point) => ({
    value: point.value,
    label: point.label,
    ...(point.description != null ? { description: point.description } : {}),
  }));
}

/** Renames `MethodologyMatrixCell`'s API field names (`probability`/`impact`) onto `RiskMatrix`'s own (`probabilityValue`/`impactValue`) — a field-renaming projection only. */
export function toMatrixCells(methodology: RiskMethodologyVersion): readonly RiskMatrixCell[] {
  return methodology.matrix.map((cell) => ({
    probabilityValue: cell.probability,
    impactValue: cell.impact,
    score: cell.score,
    level: cell.level,
  }));
}
