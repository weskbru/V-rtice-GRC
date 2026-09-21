/**
 * 002-shared-grc-foundation, US1 — parses an ISO `YYYY-MM-DD` (or full ISO
 * datetime) string into a UTC-midnight `Date`, matching every `@db.Date`
 * column's semantics across `Evidence`/`Action`/`Finding`
 * (`collectedOn`/`validUntil`, `dueOn`, `identifiedOn`). Mirrors
 * `modules/risk/application/create-risk.usecase.ts#parseIsoDate` exactly —
 * see `grc/shared/domain/org-scope.ts`'s header for why this one, genuinely
 * shape-identical, small helper is factored out here rather than
 * duplicated per `grc/**` capability. DTO-level `@IsDateString()` has
 * already rejected anything not ISO-8601-shaped by the time this runs.
 */
export function parseIsoDate(value: string): Date {
  const datePart = value.length > 10 ? value.slice(0, 10) : value;
  return new Date(`${datePart}T00:00:00.000Z`);
}

/** Midnight UTC of the current day — the same reference instant
 * `grc/shared/domain/overdue.service.ts#todayDateOnlyUtc` already exports
 * for `Action`; re-exported here under a neutral name so `Evidence`'s
 * "is this expired" read-time projection does not need to import a file
 * named for `Action`'s own overdue rule to get the identical "what is
 * today" instant. */
export function todayDateOnlyUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
