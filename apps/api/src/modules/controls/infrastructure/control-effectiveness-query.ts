/**
 * T015/003-controls-management — the SQL-side twin of
 * `calculateControlEffectiveness` (`domain/control-effectiveness.service.ts`,
 * T013). The future catalog query (T020, out of this task's scope) needs to
 * FILTER and SORT by effectiveness, which no stored column can do — §19.7
 * forbids materializing it (data-model.md §3) — so this expression computes
 * the IDENTICAL value in SQL, following the exact
 * `overdueReviewFragment`/`isOverdueReview` documented-parity pattern
 * already established in `modules/risk/infrastructure/risk-query.service.ts`.
 *
 * ## Parity, stated explicitly (cross-references `control-effectiveness.service.ts`)
 *
 * - `FREQUENCY_WINDOW_DAYS` (imported, not re-declared) is the ONE source
 *   of the day-window table; `frequencyWindowDaysCase` below turns it into
 *   a SQL `CASE` over that SAME object at module-load time, so the two can
 *   never drift by a number hand-edited in only one of the two places.
 * - "Most recent ATTESTED assessment" is `attested_at IS NOT NULL` ordered
 *   by `assessed_on DESC, created_at DESC` — the exact filter/order
 *   `control_assessments`'s own index
 *   (`control_assessments_control_id_assessed_on_created_at_idx`) is built
 *   for, and the exact ordering `mostRecent()` in the domain service
 *   implements.
 * - No attested row at all -> `'NOT_ASSESSED'`; when `frequency IS NULL`
 *   the `CASE`'s expiry branch is gated out entirely (unreachable, exactly
 *   like `calculateControlEffectiveness`'s own `frequency === null` early
 *   return); a stale window -> `'EXPIRED'`; otherwise the latest result,
 *   verbatim.
 *
 * `control-effectiveness-parity.spec.ts` (T016) is what actually
 * GUARANTEES the two agree over real data, seeded and read back through
 * both paths — this comment states the intent, that test proves it holds.
 *
 * ## Not yet optimized for the 50,000-row catalog (SC-008)
 *
 * This expression runs its correlated "most recent attested assessment"
 * lookup as three separate scalar subqueries (one per branch that needs
 * it) rather than a single `LATERAL` join — correct, but not the shape a
 * high-row-count catalog query would want. T020 (the actual catalog query
 * service, out of this task's scope) is free to restructure this into a
 * `LATERAL` join against the same underlying rule once it has a real
 * `FROM controls c` to correlate against; this task establishes the RULE
 * and its parity with the domain calculator, not the final query plan.
 */
import { Prisma } from '@prisma/client';

import { FREQUENCY_WINDOW_DAYS } from '../domain/control-effectiveness.service';

import type { ControlFrequency } from '@prisma/client';

/** `FREQUENCY_WINDOW_DAYS` rendered as a SQL `CASE <frequencyColumn>::text
 * WHEN '<value>' THEN <days> ... END`, built from that SAME object — never
 * a second, hand-copied literal table. The `WHEN`/`THEN` literals are
 * `Prisma.raw` because every one of them comes from this codebase's own
 * fixed `FREQUENCY_WINDOW_DAYS` object, never from request input — the
 * identical reasoning `overdueTreatmentExistsFragment`'s own comment gives
 * for embedding `'COMPLETED'`/`'CANCELLED'` directly. */
function frequencyWindowDaysCase(frequencyColumn: Prisma.Sql): Prisma.Sql {
  const clauses = (Object.entries(FREQUENCY_WINDOW_DAYS) as [ControlFrequency, number][])
    .map(([frequency, days]) => `WHEN '${frequency}' THEN ${String(days)}`)
    .join(' ');
  // Cast to `::text` rather than parameterizing the enum literals — a
  // custom Postgres enum type has no implicit cast from a bound text
  // parameter, the same reasoning `inFragment`'s own `::${Prisma.raw(arrayType)}`
  // cast documents for `RiskStatus[]`/`RiskLevel[]` below in the risk
  // module's own query service.
  return Prisma.sql`(CASE (${frequencyColumn})::text ${Prisma.raw(clauses)} END)`;
}

/**
 * The control's derived effectiveness, as a single SQL scalar expression —
 * usable in a `SELECT` list column, an `ORDER BY`, or a `WHERE ... = ANY(...)`
 * filter, exactly like `overdueTreatmentExistsFragment` is reused in both
 * `risk-query.service.ts`'s `SELECT` and its `WHERE`.
 *
 * @param controlIdColumn Raw SQL for the correlated control's `id` column
 *   in the enclosing query (e.g. `Prisma.sql\`c.id\`` for a `controls c`
 *   alias). Caller-supplied rather than hardcoded because no catalog query
 *   exists yet to fix an alias (T020, out of this task's scope).
 * @param frequencyColumn Raw SQL for the correlated control's `frequency`
 *   column (e.g. `Prisma.sql\`c.frequency\``).
 * @param referenceDateParam An ISO `YYYY-MM-DD` date string, bound as a
 *   query parameter and cast to `::date` — the SAME `referenceDate` value
 *   the caller also passes to `calculateControlEffectiveness`, never a
 *   fresh `CURRENT_DATE` read inside this expression (mirrors
 *   `overdueReviewFragment`'s own `todayParam` convention: no clock read
 *   hidden inside the rule).
 */
export function controlEffectivenessExpression(
  controlIdColumn: Prisma.Sql,
  frequencyColumn: Prisma.Sql,
  referenceDateParam: string,
): Prisma.Sql {
  const latestAttestedAssessedOn = Prisma.sql`(
    SELECT ca.assessed_on FROM control_assessments ca
    WHERE ca.control_id = ${controlIdColumn} AND ca.attested_at IS NOT NULL
    ORDER BY ca.assessed_on DESC, ca.created_at DESC
    LIMIT 1
  )`;
  const latestAttestedResult = Prisma.sql`(
    SELECT ca.result::text FROM control_assessments ca
    WHERE ca.control_id = ${controlIdColumn} AND ca.attested_at IS NOT NULL
    ORDER BY ca.assessed_on DESC, ca.created_at DESC
    LIMIT 1
  )`;

  return Prisma.sql`(
    CASE
      WHEN ${latestAttestedAssessedOn} IS NULL THEN 'NOT_ASSESSED'
      WHEN ${frequencyColumn} IS NOT NULL
        AND ${latestAttestedAssessedOn} < (${referenceDateParam}::date - (${frequencyWindowDaysCase(frequencyColumn)}) * INTERVAL '1 day')
      THEN 'EXPIRED'
      ELSE ${latestAttestedResult}
    END
  )`;
}
