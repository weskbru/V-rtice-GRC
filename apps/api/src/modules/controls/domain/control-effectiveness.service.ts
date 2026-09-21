/**
 * T013/003-controls-management — `ControlEffectivenessService`, the SINGLE
 * point of calculation for a control's derived effectiveness (data-model.md
 * §3, D-2, CLAUDE.md §19.7). No column stores this value anywhere in the
 * schema — `schema.prisma`'s own `Control` section header says so
 * explicitly. Pure domain logic: no I/O, no Prisma import beyond the two
 * TYPE-ONLY enum imports below (an external package's data shape, the same
 * accepted pattern `domain/risk-overdue.ts` and `grc/shared/domain/
 * overdue.service.ts` already establish) — no framework import at all,
 * enforced by `eslint-plugin-boundaries` at `module-domain`.
 *
 * ## `referenceDate` is a REQUIRED parameter — no clock read inside the rule
 *
 * Same discipline as `isActionOverdue`
 * (`grc/shared/domain/overdue.service.ts`) and `isOverdueReview`
 * (`modules/risk/domain/risk-overdue.ts`): a hidden `new Date()` inside a
 * derived-state rule makes the rule untestable without manipulating the
 * process clock, and makes "the same control, evaluated twice in the same
 * request" silently able to disagree with itself across a millisecond
 * boundary. Every call site supplies `referenceDate` explicitly — there is
 * no default parameter here, unlike `isOverdueReview`'s own optional
 * default, because this service has no single obvious "now" caller (the
 * SQL parity fragment in `control-effectiveness-query.ts`, T015, computes
 * its own `referenceDate` once per request and passes the SAME value to
 * both the SELECT/WHERE expression and any TypeScript cross-check).
 *
 * ## Only ATTESTED assessments ever count
 *
 * `assessments` accepts EVERY assessment the caller has (attested or not)
 * rather than requiring the caller to pre-filter — the service itself
 * discards any assessment whose `attestedAt` is `null` (FR-016: "registrar
 * não é declarar"). This is deliberate: §19.7 requires ONE calculator, and
 * trusting every future caller to filter correctly before calling in would
 * make the "unattested never counts" invariant a convention repeated at
 * every call site instead of a guarantee this one function enforces.
 *
 * ## Frequency -> day-window mapping
 *
 * Neither `spec.md`, `data-model.md` nor `research.md` D-7 gives an exact
 * day count per `ControlFrequency` member (D-7 fixes the closed
 * VOCABULARY, not the vencimento arithmetic) — `quickstart.md` §3's own
 * worked example ("`MONTHLY` + 60 days ago -> `EXPIRED`") only exercises a
 * value far enough past any reasonable window to be unambiguous either
 * way. `FREQUENCY_WINDOW_DAYS` below is this task's own, explicit,
 * documented choice, reported as exactly that: a plain calendar-day
 * multiple of the named cadence, with `CONTINUOUS` sharing `DAILY`'s
 * window because `assessed_on` is stored at DAY precision
 * (`@db.Date`) — no representable assessment date is more frequent than
 * one per day, so a shorter window could never be exercised by any legal
 * `ControlAssessment` row. `control-effectiveness-query.ts` (T015) encodes
 * the IDENTICAL table in SQL; the two must never diverge (T016's parity
 * test is what guarantees that, not convention).
 */
import type { ControlAssessmentResult, ControlFrequency } from '@prisma/client';

/** The control's derived, current effectiveness (data-model.md §3, D-2).
 * `NOT_ASSESSED`/`EXPIRED` are never assessor-writable — see
 * `ControlAssessmentResult` (the enum an assessor DOES write) for the
 * three values this type is a superset of. */
export type ControlEffectiveness =
  'NOT_ASSESSED' | 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'EXPIRED';

/** Runtime enumeration of every `ControlEffectiveness` value — additive
 * export, 004-compliance-management T016. `presentation/dto/list-controls-
 * query.dto.ts` keeps its own private, pre-existing copy unchanged (this
 * export is not a mandate to refactor that call site); this one exists so
 * `control-effectiveness-level-parity.spec.ts` can prove, over real
 * values, that this vocabulary and `shared/grc-ports/control-effectiveness
 * .port.ts`'s own deliberately-duplicated `CONTROL_EFFECTIVENESS_LEVELS`
 * (research.md D-9) never drift apart. */
export const CONTROL_EFFECTIVENESS_VALUES: readonly ControlEffectiveness[] = [
  'NOT_ASSESSED',
  'EFFECTIVE',
  'PARTIALLY_EFFECTIVE',
  'INEFFECTIVE',
  'EXPIRED',
];

/** The minimal projection of a `ControlAssessment` row this calculator
 * needs — never the full entity, so a caller (a future repository, T017+)
 * need not construct one just to ask "what is this control's
 * effectiveness". */
export interface ControlAssessmentForEffectiveness {
  readonly assessedOn: Date;
  /** Tie-breaker for two assessments sharing the same `assessedOn` date —
   * mirrors `control_assessments`'s own index ordering (data-model.md §2:
   * `(control_id, assessed_on DESC, created_at DESC)`). */
  readonly createdAt: Date;
  readonly result: ControlAssessmentResult;
  /** `null` while no attestation has been requested, while one is
   * pending, AND when one was rejected (data-model.md §3: "verificação não
   * atestada não conta" covers all three alike) — filled ONLY on an
   * approved attestation decision. */
  readonly attestedAt: Date | null;
}

/**
 * The calendar-day window each declared `ControlFrequency` allows between
 * the most recent ATTESTED assessment's `assessedOn` and `referenceDate`
 * before the control is `EXPIRED` (FR-014). See this file's header for why
 * these exact numbers, and why `CONTINUOUS` and `DAILY` share one. Exported
 * so `control-effectiveness-query.ts` (T015) can build the identical `CASE`
 * expression from the SAME source of truth rather than a second,
 * hand-copied table.
 */
export const FREQUENCY_WINDOW_DAYS: Readonly<Record<ControlFrequency, number>> = {
  CONTINUOUS: 1,
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
  SEMIANNUAL: 182,
  ANNUAL: 365,
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function isAttested(
  assessment: ControlAssessmentForEffectiveness,
): assessment is ControlAssessmentForEffectiveness & { attestedAt: Date } {
  return assessment.attestedAt !== null;
}

/** The most recent of `assessments` by `(assessedOn DESC, createdAt
 * DESC)` — the exact ordering `control_assessments`'s own index encodes
 * (data-model.md §2). `assessments` must be non-empty; callers below only
 * ever invoke this after confirming that. */
function mostRecent(
  assessments: readonly ControlAssessmentForEffectiveness[],
): ControlAssessmentForEffectiveness {
  return assessments.reduce((latest, candidate) => {
    if (candidate.assessedOn.getTime() !== latest.assessedOn.getTime()) {
      return candidate.assessedOn.getTime() > latest.assessedOn.getTime() ? candidate : latest;
    }
    return candidate.createdAt.getTime() > latest.createdAt.getTime() ? candidate : latest;
  });
}

/** `ControlAssessmentResult`'s three members are, by construction, also
 * members of `ControlEffectiveness` — this is the ONE place that
 * relationship is exercised, so a future divergence between the two enums
 * fails `tsc` right here rather than silently compiling elsewhere. */
function toEffectiveness(result: ControlAssessmentResult): ControlEffectiveness {
  return result;
}

/**
 * The single calculator (data-model.md §3, D-2, CLAUDE.md §19.7):
 *
 * - No attested assessment at all -> `NOT_ASSESSED` (FR-013) — never
 *   `EFFECTIVE` by omission.
 * - `frequency === null` -> the most recent attested result, verbatim;
 *   `EXPIRED` is structurally unreachable (FR-015).
 * - `frequency` declared and the most recent attested assessment's
 *   `assessedOn` is strictly older than that frequency's window (as of
 *   `referenceDate`) -> `EXPIRED` (FR-014). Exactly `windowDays` days old
 *   is NOT yet expired — the same strict `<` boundary
 *   `isOverdueReview`/`isActionOverdue` already use — only STRICTLY past
 *   the window counts.
 * - Otherwise -> the most recent attested result, verbatim.
 */
export function calculateControlEffectiveness(
  assessments: readonly ControlAssessmentForEffectiveness[],
  frequency: ControlFrequency | null,
  referenceDate: Date,
): ControlEffectiveness {
  const attested = assessments.filter(isAttested);
  if (attested.length === 0) {
    return 'NOT_ASSESSED';
  }

  const latest = mostRecent(attested);

  if (frequency === null) {
    return toEffectiveness(latest.result);
  }

  const windowDays = FREQUENCY_WINDOW_DAYS[frequency];
  const cutoff = referenceDate.getTime() - windowDays * MILLISECONDS_PER_DAY;
  if (latest.assessedOn.getTime() < cutoff) {
    return 'EXPIRED';
  }

  return toEffectiveness(latest.result);
}
