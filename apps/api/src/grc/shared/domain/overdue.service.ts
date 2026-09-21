/**
 * T011/002-shared-grc-foundation — the ONE "is this action overdue"
 * computation for the entire platform (R-006, FR-014, SC-007). Pure domain
 * logic: no I/O, no Prisma import, no framework import — matching every
 * other file directly under `grc/shared/domain/**`, and enforced by
 * `eslint-plugin-boundaries` (ADR-016).
 *
 * ## Why this exists, and why it is stricter than its own precedent
 *
 * `modules/risk/domain/risk-overdue.ts` is the SAME rule shape
 * (`status`-gated, strict `<` against a UTC-midnight reference), but
 * research.md R-006/F-24 records that the identical predicate is ALREADY
 * duplicated four times across the risk module despite that file's good
 * intentions — a TypeScript mapper, a hand-written SQL fragment in the
 * register query, and more. That file's `isOverdueReview`/
 * `isOverdueTreatmentAction` both DEFAULT `referenceDate` to their own
 * `todayDateOnlyUtc()` when the caller omits it — a convenience that is
 * also exactly how a clock read hides inside a "pure" function and a call
 * site quietly stops passing one explicitly. `isActionOverdue` below takes
 * `referenceDate` as a REQUIRED parameter with no default: every call site
 * must decide, visibly, what "today" means for that call — normally by
 * calling `todayDateOnlyUtc()` (exported alongside, for convenience, but
 * never invoked implicitly by `isActionOverdue` itself) — which is what
 * makes this function trivially unit-testable (T015) without faking the
 * system clock.
 *
 * The convergence phase (R-006's declared, dated debt) is the point where
 * the risk module's four duplicates are retired in favor of calling this
 * function — not done here, and not required for `Action` itself to have
 * exactly one rule starting now.
 *
 * ## `dueOn` is never optional here, unlike `RiskTreatmentAction.dueOn`'s
 * shared-shape cousin
 *
 * data-model.md §4 makes `Action.dueOn` a required field (FR-013) — there
 * is no "no deadline" case to special-case, unlike `Risk.nextReviewOn`
 * (optional). A caller that has not yet loaded an `Action` has no business
 * asking whether it is overdue; this signature reflects that.
 *
 * ## `OVERDUE_ELIGIBLE_ACTION_STATUSES` is now EXPORTED — coordinator
 * correction, 007-implementation-remediation, Frente A
 *
 * Before this correction, the set above was private, and FOUR call sites
 * (`grc/action/infrastructure/prisma-action.repository.ts`'s Prisma filter,
 * `modules/risk/infrastructure/risk-treatment-action-query.service.ts`'s
 * OWN duplicate constant — introduced BY this same front, the exact defect
 * it exists to remove — and two hand-written `IN ('OPEN', 'IN_PROGRESS')`
 * SQL literals in `modules/risk/infrastructure/{risk-query,
 * dashboard-query}.service.ts`) each RESTATED the same two values rather
 * than reading them from one place. All four agreed only because four
 * people wrote the same two words four times — nothing forced them to,
 * which is the condition this front exists to end, not merely to confirm.
 * `test/integration/overdue-eligible-status-consolidation.spec.ts` proves the
 * fix: it mutates THIS array at runtime and shows the TypeScript predicate,
 * a real executed SQL query and the Prisma repository filter all move
 * together, then restores it.
 *
 * `overdueEligibleActionStatusSqlList()` below is the other half: an
 * ORM-agnostic SQL literal built from this SAME array, for the three raw
 * `$queryRaw` call sites to splice into their own `IN (...)` clause via
 * `Prisma.raw(...)` — deliberately NOT a function returning a `Prisma.Sql`
 * value itself, because that would import `@prisma/client`'s RUNTIME
 * (not just its types) into `grc/shared/domain/**`, which this file's own
 * header has never done and still does not: pure domain logic, no I/O, no
 * framework import. The three call sites still write their own trivial
 * `AND alias.due_on < ${todayParam}::date` — that part is not the rule
 * this file owns (it is Prisma's own parameter-binding syntax for a value
 * every caller already computes via `todayDateOnlyUtc()` below), only the
 * status VALUES were drifting, and now have exactly one author.
 */
import type { ActionStatus } from '@prisma/client';

/** Midnight UTC of the current day — the boundary an `Action`'s `dueOn`
 * (stored `@db.Date`, no time component) is compared against. UTC, not
 * server-local time (data-model.md: timestamps are stored in UTC), so the
 * answer does not depend on the deployment's time zone. Exported so a
 * calling use case can obtain "today" explicitly and pass it to
 * `isActionOverdue` — never called by that function itself. */
export function todayDateOnlyUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** `ActionStatus` values an action can still BE overdue in (data-model.md
 * §6: "status ∈ {OPEN, IN_PROGRESS}"). `COMPLETED` and `CANCELLED` are
 * `Action`'s two terminal statuses (data-model.md §4's transition table) —
 * once reached, an action is never overdue again, regardless of `dueOn`.
 * The ONE authority (see this file's header): every consumer — the
 * predicate below, the Prisma repository filter, and the three raw SQL
 * fragments — reads THIS array, never restates it. Deliberately a plain
 * array, not a `Set`/frozen structure: `isActionOverdue` below re-checks
 * membership against it on every call rather than against a snapshot taken
 * once at module load, so a change here (or, in the consolidation test, a
 * deliberate runtime mutation proving the wiring) is visible to every
 * caller immediately. */
export const OVERDUE_ELIGIBLE_ACTION_STATUSES: readonly ActionStatus[] = ['OPEN', 'IN_PROGRESS'];

/**
 * R-006/FR-014/data-model.md §6 — "`status ∈ {OPEN, IN_PROGRESS}` e
 * `dueOn < hoje`". The single place this predicate is evaluated for
 * `Action` anywhere in the codebase; no repository, mapper or query
 * fragment reimplements this comparison (SC-007: verifiable by search —
 * grep for `dueOn` compared against a date literal outside this file).
 *
 * `dueOn` is stored `@db.Date` (no time component), so a plain `<`
 * comparison against a UTC-midnight `referenceDate` is exact: an action due
 * TODAY is not yet overdue, only one whose due date is strictly in the
 * past — matching `isOverdueReview`'s identical reasoning in
 * `modules/risk/domain/risk-overdue.ts`.
 */
export function isActionOverdue(dueOn: Date, status: ActionStatus, referenceDate: Date): boolean {
  if (!OVERDUE_ELIGIBLE_ACTION_STATUSES.includes(status)) {
    return false;
  }
  return dueOn.getTime() < referenceDate.getTime();
}

/**
 * ORM-agnostic SQL literal for the `IN (...)` list of overdue-eligible
 * statuses — e.g. `'OPEN', 'IN_PROGRESS'` — built from the SAME array
 * `isActionOverdue` checks above, every time this is called (never cached),
 * so a mutation of that array changes this output on the very next call.
 * Pure string generation over a closed, compile-time `ActionStatus` union
 * with no external input (never user data), so embedding it via
 * `Prisma.raw(...)` at a call site carries no injection risk. See this
 * file's header for why the caller — not this file — owns wrapping this in
 * its own query engine's fragment type.
 */
export function overdueEligibleActionStatusSqlList(): string {
  return OVERDUE_ELIGIBLE_ACTION_STATUSES.map((status) => `'${status}'`).join(', ');
}
