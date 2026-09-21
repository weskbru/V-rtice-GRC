/**
 * 007-implementation-remediation, Frente A, D-7 — `isOverdueReview` is the
 * only rule left in this file. `todayDateOnlyUtc` (the duplicate flagged by
 * F-24/research.md D-7) and `isOverdueTreatmentAction` (replaced by
 * `grc/shared/domain/overdue.service.ts#isActionOverdue`, since `Action` is
 * the sole authority for a risk treatment action's status/due date now,
 * D-1) are REMOVED — callers import `todayDateOnlyUtc`/`isActionOverdue`
 * from that ONE shared kernel file instead of a risk-module copy.
 *
 * `isOverdueReview` stays here — it is a genuinely different rule
 * (`Risk.nextReviewOn`, not an `Action`'s due date) — but LOSES its default
 * `referenceDate` parameter (matching `isActionOverdue`'s own signature):
 * every call site must decide, visibly, what "today" means, importing
 * `todayDateOnlyUtc` from the shared kernel to do so.
 */
export function isOverdueReview(nextReviewOn: Date | undefined, referenceDate: Date): boolean {
  if (!nextReviewOn) {
    return false;
  }
  return nextReviewOn.getTime() < referenceDate.getTime();
}
