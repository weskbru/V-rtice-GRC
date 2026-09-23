import {
  ValidationDomainError,
  type ValidationFieldError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

export type RiskLevelValue = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const RISK_LEVEL_VALUES: readonly RiskLevelValue[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export interface ScalePointConfig {
  readonly value: number;
  readonly label: string;
  readonly description?: string | null;
}

export interface MatrixCellConfig {
  readonly probability: number;
  readonly impact: number;
  readonly score: number;
  readonly level: RiskLevelValue;
}

export interface LevelBandConfig {
  readonly level: RiskLevelValue;
  readonly minScore: number;
  readonly maxScore: number;
  readonly colorToken?: string | null;
}

export interface MethodologyConfiguration {
  readonly probabilityScale: readonly ScalePointConfig[];
  readonly impactScale: readonly ScalePointConfig[];
  readonly matrix: readonly MatrixCellConfig[];
  readonly levelBands: readonly LevelBandConfig[];
}

export function validateMethodologyConfiguration(config: MethodologyConfiguration): void {
  const errors: ValidationFieldError[] = [];

  const probabilityValues = validateScale(config.probabilityScale, 'probabilityScale', errors);
  const impactValues = validateScale(config.impactScale, 'impactScale', errors);

  let matrixScoreRange: { min: number; max: number } | undefined;
  if (probabilityValues && impactValues) {
    matrixScoreRange = validateMatrix(config.matrix, probabilityValues, impactValues, errors);
  }

  validateLevelBands(config.levelBands, matrixScoreRange, errors);

  if (matrixScoreRange && errors.length === 0) {
    validateMatrixBandConsistency(config.matrix, config.levelBands, errors);
  }

  if (errors.length > 0) {
    throw new ValidationDomainError(USER_MESSAGES.risk.methodology.invalidConfiguration, errors);
  }
}

function validateScale(
  scale: readonly ScalePointConfig[],
  field: string,
  errors: ValidationFieldError[],
): readonly number[] | undefined {
  if (scale.length === 0) {
    errors.push({ field, message: USER_MESSAGES.risk.methodology.scaleEmpty });
    return undefined;
  }

  for (let i = 1; i < scale.length; i += 1) {
    if (scale[i]!.value <= scale[i - 1]!.value) {
      errors.push({ field, message: USER_MESSAGES.risk.methodology.scaleNotOrdered });
      return undefined;
    }
  }

  return scale.map((point) => point.value);
}

function validateMatrix(
  matrix: readonly MatrixCellConfig[],
  probabilityValues: readonly number[],
  impactValues: readonly number[],
  errors: ValidationFieldError[],
): { min: number; max: number } | undefined {
  const probabilitySet = new Set(probabilityValues);
  const impactSet = new Set(impactValues);
  const seenCells = new Set<string>();
  let min: number | undefined;
  let max: number | undefined;

  for (const cell of matrix) {
    if (!probabilitySet.has(cell.probability) || !impactSet.has(cell.impact)) {
      errors.push({ field: 'matrix', message: USER_MESSAGES.risk.methodology.matrixUnknownCell });
      continue;
    }

    const key = `${String(cell.probability)}:${String(cell.impact)}`;
    if (seenCells.has(key)) {
      errors.push({ field: 'matrix', message: USER_MESSAGES.risk.methodology.matrixDuplicateCell });
      continue;
    }
    seenCells.add(key);

    min = min === undefined ? cell.score : Math.min(min, cell.score);
    max = max === undefined ? cell.score : Math.max(max, cell.score);
  }

  const expectedCellCount = probabilityValues.length * impactValues.length;
  if (seenCells.size !== expectedCellCount) {
    errors.push({ field: 'matrix', message: USER_MESSAGES.risk.methodology.matrixMissingCell });
  }

  return min !== undefined && max !== undefined ? { min, max } : undefined;
}

function validateLevelBands(
  bands: readonly LevelBandConfig[],
  matrixScoreRange: { min: number; max: number } | undefined,
  errors: ValidationFieldError[],
): void {
  if (bands.length === 0) {
    errors.push({ field: 'levelBands', message: USER_MESSAGES.risk.methodology.bandsEmpty });
    return;
  }

  let structurallyValid = true;

  for (const band of bands) {
    if (!RISK_LEVEL_VALUES.includes(band.level)) {
      errors.push({
        field: 'levelBands',
        message: USER_MESSAGES.risk.methodology.bandsInvalidLevel,
      });
      structurallyValid = false;
    }
    if (band.minScore > band.maxScore) {
      errors.push({
        field: 'levelBands',
        message: USER_MESSAGES.risk.methodology.bandsInvalidRange,
      });
      structurallyValid = false;
    }
  }

  for (let i = 1; i < bands.length; i += 1) {
    const previous = bands[i - 1]!;
    const current = bands[i]!;
    if (current.minScore <= previous.minScore) {
      errors.push({
        field: 'levelBands',
        message: USER_MESSAGES.risk.methodology.bandsNotOrdered,
      });
      structurallyValid = false;
    } else if (current.minScore !== previous.maxScore + 1) {
      errors.push({
        field: 'levelBands',
        message: USER_MESSAGES.risk.methodology.bandsOverlapOrGap,
      });
      structurallyValid = false;
    }
  }

  if (structurallyValid && matrixScoreRange) {
    const first = bands[0]!;
    const last = bands[bands.length - 1]!;
    if (first.minScore !== matrixScoreRange.min || last.maxScore !== matrixScoreRange.max) {
      errors.push({
        field: 'levelBands',
        message: USER_MESSAGES.risk.methodology.bandsCoverageMismatch,
      });
    }
  }
}

function validateMatrixBandConsistency(
  matrix: readonly MatrixCellConfig[],
  bands: readonly LevelBandConfig[],
  errors: ValidationFieldError[],
): void {
  for (const cell of matrix) {
    const band = bands.find((b) => cell.score >= b.minScore && cell.score <= b.maxScore);
    if (band && band.level !== cell.level) {
      errors.push({
        field: 'matrix',
        message: USER_MESSAGES.risk.methodology.matrixBandMismatch,
      });
    }
  }
}
