/**
 * T012/002-shared-grc-foundation — the human-readable code shape shared by
 * `Evidence`, `Action` and `Finding` (R-008, FR-004/FR-013/FR-021,
 * data-model.md §2/§4/§5: `EVD-2026-0001`, `ACT-2026-0001`,
 * `FND-2026-0001`). Follows `modules/risk/domain/risk-code.ts` exactly —
 * see that file's header for the full reasoning this one does not repeat.
 *
 * Pure domain logic only: no I/O, no Prisma, no framework import. The
 * atomic ALLOCATION of the next sequence number for a `(prefix, year)` pair
 * requires a database round-trip (a concurrency-safe counter), which is
 * deliberately NOT here — that is `EntityCodeGeneratorPort`
 * (`domain/ports/entity-code-generator.port.ts`) and its Prisma-backed
 * implementation (`infrastructure/prisma-entity-code-generator.ts`). This
 * module owns only the pure, deterministic transformation between a
 * `(prefix, year, sequence)` triple and the code string — exhaustively
 * unit-testable with no database, exactly like `formatRiskCode`.
 *
 * ## One shared service, one prefix per entity — not three near-identical
 * files
 *
 * `EVD-`/`ACT-`/`FND-` differ only in their prefix; the format, the
 * zero-padding width and the collision-avoidance strategy are identical
 * across all three (CLAUDE.md §2: "não criar abstrações prematuras" cuts
 * both ways — three copies of the SAME four-line function would themselves
 * be the unjustified duplication CLAUDE.md §13 warns against). `EntityCode`
 * is a closed union of the three known prefixes, verified at compile time,
 * exactly like `EvidenceSubjectType`/`ActionOriginType`'s closed-type
 * registration elsewhere in this feature.
 *
 * **Update, 003-controls-management/T019a**: a fourth prefix, `CTL`, was
 * added for `Control` — a business-module entity (ADR-016), not a GRC
 * kernel one. See `EntityCodePrefix`'s own doc comment below for why
 * extending this union is the right call anyway, and data-model.md §1 for
 * the full reasoning this header does not repeat.
 *
 * ## Collision avoidance under concurrency
 *
 * Two entities of the SAME prefix created at the same instant, in the same
 * year, must never receive the same code. This module fixes the FORMAT
 * half of that guarantee: `formatEntityCode` is a pure function of
 * `(prefix, year, sequence)`, so two DIFFERENT sequence numbers can never
 * format to the same string, and `ENTITY_CODE_PATTERN` lets any layer
 * verify a code has the expected shape without re-deriving the format
 * logic. The UNIQUENESS half — guaranteeing two concurrent callers never
 * observe the same `sequence` for the same `(prefix, year)` — is the
 * allocator's responsibility, not this module's; see
 * `PrismaEntityCodeGenerator`.
 */

/** The closed set of code prefixes using this shared allocator (R-008).
 * Extending this union — never a bare `string`, so a typo'd prefix fails
 * `tsc` — is not limited to a fourth GRC KERNEL entity: `CTL` (added by
 * 003-controls-management, T019a) is a business-module prefix, `Control`
 * (ADR-016: Control failed the kernel's two-test admission criteria and
 * lives in `modules/controls`, not `grc/**`). `EvidenceSubjectType`,
 * `ApprovableEntityType` and `AttachableEntityType` already name
 * module-level concepts (`RISK`, `RISK_TREATMENT_DECISION`) inside this
 * same shared layer — this registry follows that established precedent
 * (data-model.md §1 for the full reasoning), rather than being reserved
 * for the kernel alone. The real, narrower rule this union protects is
 * ADR-008's closed-registry discipline: a code PREFIX is added by
 * reviewed, additive migration (extending `ENTITY_CODE_PATTERN` below in
 * the same change), never accepted as free-form input.
 *
 * **Update, 004-compliance-management/T019**: a fifth prefix, `FMK`, was
 * added for `Framework` — the same reasoning as `CTL` above: `Framework`
 * is a business-module entity (ADR-017), not a GRC kernel one, but this
 * registry already established the precedent of naming module-level
 * concepts (research.md D-14). `FrameworkVersion` and `Requirement`
 * deliberately do NOT get a prefix of their own — see research.md D-14 for
 * why each already has a natural, stable domain identifier (`label`,
 * `externalRef`) that a generated code would only duplicate.
 *
 * **Update, 005-audit-findings/T006**: a sixth prefix, `AUD`, was added for
 * `AuditEngagement` — the same reasoning as `CTL`/`FMK`: a business-module
 * entity (`modules/audit-engagements`), reusing this shared allocator
 * (`GrcCodeSequence`) rather than a fourth, duplicated counter mechanism
 * (data-model.md §1/§8, research.md D-8).
 *
 * **Update, 006-assets-processes/T002**: a seventh and eighth prefix, `AST`
 * and `PRC`, were added for `Asset` and `Process` — the same reasoning as
 * every prior addition above: two business-module entities (`modules/assets`,
 * `modules/processes`), reusing this shared allocator rather than a fifth
 * and sixth duplicated counter mechanism (data-model.md §2, research.md D-4).
 * The pre-existing free-form codes on the two dev-fixture rows
 * (`FIXTURE-ASSET-1`, `FIXTURE-PROCESS-1`) are untouched — this pattern
 * governs codes this module GENERATES from here on, not a retroactive
 * constraint on the column (research.md D-4).
 *
 * **Update, 009-indicators-reports/T005**: a ninth and tenth prefix, `IND`
 * and `RPT`, were added for `IndicatorDefinition` and `ReportDefinition` —
 * the same reasoning as every prior addition above: two business-module
 * entities (`modules/indicators`, `modules/reports`), reusing this shared
 * allocator rather than a seventh and eighth duplicated counter mechanism
 * (data-model.md §1, research.md D-9). This task delivers only the
 * allocator's prefix registration — `IndicatorDefinition`/`ReportDefinition`
 * themselves (the Prisma models that will actually call `nextCode('IND', …)`
 * / `nextCode('RPT', …)`) do not exist yet; that is separate, parallel
 * schema work. `IndicatorMeasurement` deliberately does NOT get a prefix of
 * its own — same reasoning research.md D-9 gives for why
 * `FrameworkVersion`/`Requirement` don't: `(metricKey, computedAt)` is
 * already a stable, natural identifier for display. */
export type EntityCodePrefix =
  'EVD' | 'ACT' | 'FND' | 'CTL' | 'FMK' | 'AUD' | 'AST' | 'PRC' | 'INC' | 'PRB' | 'IND' | 'RPT';

export const ENTITY_CODE_PREFIXES = {
  EVIDENCE: 'EVD',
  ACTION: 'ACT',
  FINDING: 'FND',
  // 003-controls-management, T019a — `Control` reuses this allocator
  // (`GrcCodeSequence`) for its own `CTL-YYYY-NNNN` code, rather than a
  // second, duplicated `UPSERT ... ON CONFLICT` counter mechanism in
  // `modules/controls` (data-model.md §1: "duplicaria o UPSERT ... ON
  // CONFLICT do contador — a classe de defeito F-42").
  CONTROL: 'CTL',
  // 004-compliance-management, T019 — `Framework` reuses this SAME
  // allocator for its own `FMK-YYYY-NNNN` code (research.md D-14).
  FRAMEWORK: 'FMK',
  // 005-audit-findings, T006 — `AuditEngagement` reuses this SAME allocator
  // for its own `AUD-YYYY-NNNN` code (data-model.md §1/§8, research.md D-8).
  AUDIT_ENGAGEMENT: 'AUD',
  // 006-assets-processes, T002 — `Asset` and `Process` reuse this SAME
  // allocator for their own `AST-YYYY-NNNN`/`PRC-YYYY-NNNN` codes
  // (data-model.md §2, research.md D-4).
  ASSET: 'AST',
  PROCESS: 'PRC',
  // 008-incidents-problems, foundation — `Incident` and `Problem` reuse
  // this SAME allocator for their own `INC-YYYY-NNNN`/`PRB-YYYY-NNNN`
  // codes (data-model.md §3, research.md D-2), the same reasoning every
  // prior business module addition above already gives.
  INCIDENT: 'INC',
  PROBLEM: 'PRB',
  // 009-indicators-reports, T005 — `IndicatorDefinition` and
  // `ReportDefinition` reuse this SAME allocator for their own
  // `IND-YYYY-NNNN`/`RPT-YYYY-NNNN` codes (data-model.md §1, research.md
  // D-9). The models that will consume these do not exist yet — this task
  // delivers the allocator's prefix registration, not the consumer.
  INDICATOR: 'IND',
  REPORT: 'RPT',
} as const satisfies Record<string, EntityCodePrefix>;

/** Minimum digit width of the zero-padded sequence segment — same
 * reasoning as `RISK_CODE_PATTERN`'s `SEQUENCE_MIN_DIGITS`: a year with
 * more than 9999 entities of one prefix (extremely unlikely) simply grows
 * the code past this width rather than truncating or colliding.
 */
const SEQUENCE_MIN_DIGITS = 4;

/** Matches every code this module ever formats: `<PREFIX>-YYYY-NNNN` (or
 * more digits, per the note above). Anchored at both ends. */
export const ENTITY_CODE_PATTERN =
  /^(EVD|ACT|FND|CTL|FMK|AUD|AST|PRC|INC|PRB|IND|RPT)-\d{4}-\d{4,}$/;

/**
 * Formats a `(prefix, year, sequence)` triple into the immutable,
 * human-readable code (R-008). `sequence` must be a positive integer — the
 * allocator (`EntityCodeGeneratorPort`) is the only legitimate source of
 * one.
 */
export function formatEntityCode(prefix: EntityCodePrefix, year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`formatEntityCode: year must be a 4-digit integer, got ${String(year)}.`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(
      `formatEntityCode: sequence must be a positive integer, got ${String(sequence)}.`,
    );
  }

  const paddedSequence = String(sequence).padStart(SEQUENCE_MIN_DIGITS, '0');
  return `${prefix}-${String(year)}-${paddedSequence}`;
}

/** True when `code` matches the shape every `formatEntityCode` output has,
 * for any of the known prefixes (`ENTITY_CODE_PATTERN`). */
export function isValidEntityCode(code: string): boolean {
  return ENTITY_CODE_PATTERN.test(code);
}
