/**
 * T087 — the risk code shape (FR-054, data-model.md §8: `code` is
 * "human-readable, immutable, e.g. `RSK-2026-0001`").
 *
 * Pure domain logic only: no I/O, no Prisma, no framework import — exactly
 * like `core/organizations/domain/org-unit-path.ts`. The actual atomic
 * ALLOCATION of the next sequence number for a year requires a database
 * round-trip (a concurrency-safe counter), which is deliberately NOT here —
 * that is `RiskCodeGeneratorPort` (`domain/ports/risk-code-generator.port.ts`)
 * and its Prisma-backed implementation
 * (`infrastructure/prisma-risk-code-generator.ts`). This module owns only
 * the pure, deterministic transformation between a `(year, sequence)` pair
 * and the code string — exhaustively unit-testable with no database.
 *
 * ## Collision avoidance under concurrency (see also
 * `PrismaRiskCodeGenerator`'s own header)
 *
 * Two risks created at the same instant, in the same year, must never
 * receive the same code. This module fixes the FORMAT half of that
 * guarantee: `formatRiskCode` is a pure function of `(year, sequence)`, so
 * two DIFFERENT sequence numbers can never format to the same string, and
 * `RISK_CODE_PATTERN` lets any layer verify a code has the expected shape
 * without re-deriving the format logic. The UNIQUENESS half — guaranteeing
 * two concurrent callers never observe the same `sequence` for the same
 * `year` — is the allocator's responsibility, not this module's; see
 * `PrismaRiskCodeGenerator`.
 */

export const RISK_CODE_PREFIX = 'RSK';

/** Minimum digit width of the zero-padded sequence segment. A year with
 * more than 9999 risks (extremely unlikely) simply grows the code past this
 * width rather than truncating or colliding — `padStart` never drops
 * digits. */
const SEQUENCE_MIN_DIGITS = 4;

/** Matches every code this module ever formats: `RSK-YYYY-NNNN` (or more
 * digits, per the note above). Anchored at both ends. */
export const RISK_CODE_PATTERN = /^RSK-\d{4}-\d{4,}$/;

/**
 * Formats a `(year, sequence)` pair into the immutable, human-readable code
 * (FR-054). `sequence` must be a positive integer — the allocator
 * (`RiskCodeGeneratorPort`) is the only legitimate source of one.
 */
export function formatRiskCode(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`formatRiskCode: year must be a 4-digit integer, got ${String(year)}.`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(
      `formatRiskCode: sequence must be a positive integer, got ${String(sequence)}.`,
    );
  }

  const paddedSequence = String(sequence).padStart(SEQUENCE_MIN_DIGITS, '0');
  return `${RISK_CODE_PREFIX}-${String(year)}-${paddedSequence}`;
}

/** True when `code` matches the shape every `formatRiskCode` output has. */
export function isValidRiskCode(code: string): boolean {
  return RISK_CODE_PATTERN.test(code);
}
