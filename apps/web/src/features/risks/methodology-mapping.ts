import type { RiskMethodologyVersion, ScalePoint } from './types';
import type { RiskMatrixCell, RiskMatrixScaleLevel } from '@pharos/design-system/components';

export function toScaleLevels(scale: readonly ScalePoint[]): readonly RiskMatrixScaleLevel[] {
  return scale.map((point) => ({
    value: point.value,
    label: point.label,
    ...(point.description != null ? { description: point.description } : {}),
  }));
}

export function toMatrixCells(methodology: RiskMethodologyVersion): readonly RiskMatrixCell[] {
  return methodology.matrix.map((cell) => ({
    probabilityValue: cell.probability,
    impactValue: cell.impact,
    score: cell.score,
    level: cell.level,
  }));
}
