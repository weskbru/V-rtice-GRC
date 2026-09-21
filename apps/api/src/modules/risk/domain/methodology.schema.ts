/**
 * T121 — methodology configuration schema validation (FR-061, FR-067,
 * FR-068). `probabilityScale`, `impactScale`, `matrix` and `levelBands` are
 * the only JSONB columns in the risk domain (data-model.md §7: "its
 * structure is validated by a schema at the application boundary") — this
 * module IS that boundary. A configuration that fails any check here is
 * rejected before it is ever stored: `PublishMethodologyVersionUseCase`
 * calls `validateMethodologyConfiguration` before the repository's `create`
 * ever runs, so an invalid configuration never reaches `risk_methodology_
 * versions` (append-only — there would be no way to fix a bad row after the
 * fact other than publishing yet another version).
 *
 * Pure domain logic: no I/O, no NestJS/framework import, no Prisma value
 * import — `RiskLevelValue` below is this module's OWN literal union, not
 * `@prisma/client`'s `RiskLevel`, exactly for the same "no Prisma" boundary
 * `risk-scoring.service.ts` (T122) is held to, since that file imports its
 * `RiskLevelValue` type from here (module-domain -> module-domain, ADR-011).
 * The two unions are kept string-identical to Prisma's `RiskLevel` enum by
 * hand (verified in `test/unit/methodology-schema-risk-level-parity.spec.ts`,
 * not "this file's own test" as an earlier version of this comment claimed
 * with nothing behind it — F-27) — conversion to/from the real Prisma enum
 * happens only at the infrastructure/application boundary.
 *
 * `ValidationDomainError` is thrown directly from here (not left to a
 * caller to translate), the same pattern `risk.entity.ts` already
 * establishes: `shared/**` may be imported by every layer (ADR-011), so a
 * domain module throwing the final, presentation-ready error type is not a
 * boundary violation.
 */
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

/** The full shape stored across `probabilityScale`/`impactScale`/`matrix`/
 * `levelBands` — one methodology version's configuration, exactly as
 * `RiskScoringService.score()` (T122) consumes it. */
export interface MethodologyConfiguration {
  readonly probabilityScale: readonly ScalePointConfig[];
  readonly impactScale: readonly ScalePointConfig[];
  readonly matrix: readonly MatrixCellConfig[];
  readonly levelBands: readonly LevelBandConfig[];
}

/**
 * Validates a whole methodology configuration as one unit — exactly what
 * `contracts/platform.openapi.yaml`'s `createRiskMethodologyVersion`
 * describes: "every combination of probability and impact must have a
 * matrix cell, every cell score must fall inside exactly one band, and the
 * bands must be contiguous and non-overlapping". Throws
 * `ValidationDomainError` (422) carrying every violation found, rather than
 * stopping at the first one — a config author fixing one field at a time
 * against a single-error response would need to resubmit repeatedly for no
 * reason.
 */
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

/** Non-empty, strictly ascending by `value` (this single check subsumes
 * both "ordered" and "unique values": a duplicate adjacent value fails the
 * strict `>` comparison exactly like an out-of-order one does). Returns the
 * sorted-as-submitted value list for the matrix check below, or `undefined`
 * when the scale itself is too broken to build on. */
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

/** Every (probability, impact) pair from the two scales must have exactly
 * one matrix cell; no cell may reference a value outside either scale.
 * Returns the [min, max] score range actually covered by valid cells, for
 * the band-coverage check below. */
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

/** Ordered (ascending by `minScore`, matching submission order), each level
 * a real `RiskLevel`, `minScore <= maxScore` per band, contiguous and
 * non-overlapping between consecutive bands, and — when the matrix's score
 * range is known — covering it fully at both ends. */
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
      // Covers BOTH failure modes with one comparison: a gap
      // (current.minScore > previous.maxScore + 1) and an overlap
      // (current.minScore <= previous.maxScore).
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

/** Every matrix cell's declared `level` must agree with the level the band
 * covering its `score` actually assigns. `RiskScoringService.score()` never
 * trusts a cell's stored `level` at runtime (bands are the single source of
 * truth, FR-063) — this check exists so a config author's typo is caught at
 * publish time rather than silently producing a matrix whose displayed
 * level (e.g. in `RiskMatrix`, a future frontend component) disagrees with
 * what an assessment scored against it will actually compute. Only run once
 * the matrix and bands have each independently validated clean, so a band
 * lookup here is guaranteed to find exactly one match. */
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
