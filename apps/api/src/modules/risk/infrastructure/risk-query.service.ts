/**
 * T105 — `RiskQueryService`: the sole Prisma-backed implementation of
 * `RiskQueryPort` (`domain/ports/risk-query.port.ts`), backing
 * `GET /risks` (US3, `contracts/risks.openapi.yaml`, the register's
 * `listRiskRegister` operation).
 *
 * ## Why raw SQL, and not `prisma.risk.findMany`
 *
 * FR-089's text search must use the GIN trigram index already created on
 * `(code || ' ' || title || ' ' || description)` (the baseline migration,
 * `20260905140100_risk_management_baseline` — see this file's sibling
 * `risk.module.ts`/the implementation report for confirmation no new index
 * was needed). PostgreSQL only recognizes that index when the query's
 * predicate is built from the SAME expression tree — three separate
 * `code ILIKE ...  OR title ILIKE ... OR description ILIKE ...` predicates
 * (what Prisma's typed `where: { OR: [...] }` would compile to) do NOT
 * match a GIN index built over the single concatenated expression, and
 * degrade to a sequential scan at 50,000 rows (exactly SC-004's target
 * data volume). Prisma's query builder has no way to express "predicate
 * over this exact SQL expression" through its typed `where` API, so the
 * one place FR-089 can be satisfied without a full scan is a raw query
 * whose WHERE clause is written, verbatim, as
 * `(r.code || ' ' || r.title || ' ' || r.description) ILIKE $1` — see the
 * report's `EXPLAIN (ANALYZE, BUFFERS)` transcript for proof this uses
 * `risks_search_trgm_idx`, not a sequential scan.
 *
 * Once the search predicate requires raw SQL, building the ENTIRE register
 * query (filters, scope, sort, pagination) as one raw statement is what
 * keeps filter+search+sort+scope combination as ONE code path instead of
 * two (a typed path for "no search term" and a raw path for "search term
 * present") that could silently disagree — exactly the class of bug T102's
 * "combined filter, search and sort correctness" test exists to catch.
 *
 * ## Every predicate is parameterized
 *
 * `Prisma.sql` binds every value (ids, enum labels, the search term, the
 * date boundary) as a query parameter — never string-concatenated into the
 * SQL text. List filters (`status`, `riskLevel`, `categoryId`,
 * `ownerUserId`, the scope/org-unit predicates) bind as `= ANY($1::type[])`
 * with the WHOLE array as one parameter, rather than `IN ($1, $2, ...)` via
 * `Prisma.join` — PostgreSQL does not implicitly cast a raw-query
 * parameter's wire type to a `uuid`/enum column's type in a comparison, so
 * `IN` produced `operator does not exist: uuid = text` (and the enum
 * equivalent) until every list filter was switched to this single-cast
 * form; see `inFragment`'s own comment. The only raw-interpolated pieces
 * are internally computed `Prisma.Sql` fragments (column names, `ASC`/
 * `DESC`, `TRUE`/`FALSE`, the fixed `::type[]` cast literals) built from a
 * fixed, whitelisted set this file defines — never from unsanitized
 * request input (FR-106, injection protection).
 *
 * ## No N+1 (CLAUDE.md's "N+1 ao montar a resposta" pitfall)
 *
 * All four relations a `RiskSummary` row needs — category, organizational
 * unit, owner, responsible — are resolved with `LEFT JOIN`/`JOIN` in this
 * SAME statement. Listing 50 (or 50,000) risks issues exactly ONE SQL
 * statement for the page's data (plus, only when the page is empty, one
 * more `COUNT(*)` fallback — see "Total count" below) — never one query
 * per row. Proven in the implementation report via the Prisma query-count
 * harness in `test/integration/risk-query.spec.ts`.
 *
 * ## Total count without doubling the scan cost (CLAUDE.md's "contagem
 * total cara" pitfall)
 *
 * `COUNT(*) OVER()` computes the total matching row count as a window
 * function over the SAME filtered result set the page's data comes from —
 * one round trip and one query plan instead of a separate `SELECT
 * COUNT(*)` with the identical WHERE clause. The window function still
 * requires evaluating the full filtered set (a window aggregate cannot be
 * short-circuited by the outer `LIMIT`), so it does not reduce the
 * underlying scan cost — it removes the SECOND scan/round-trip a naive
 * "data query + count query" implementation would pay for the same work.
 * The one gap this leaves: a page with zero rows (either genuinely no
 * matches, or an offset past the end) carries no row to read `total` off
 * of, so `listRegister` falls back to one explicit `COUNT(*)` query in
 * that case only — rare in practice (US3 AS7's empty-state scenarios).
 *
 * ## Scope (ADR-004, FR-025, FR-090) — required, never optional
 *
 * `RiskQueryPort.listRegister`'s `scope: ScopeFilter` parameter is
 * required at the type level (`domain/ports/risk-query.port.ts`), and this
 * implementation applies it unconditionally as its own WHERE fragment
 * (`scopeFragment`, independent of whatever `orgUnitId` filter the caller
 * supplied) — the `orgUnitId` filter is additionally, separately
 * intersected with scope in `resolveOrgUnitFilter` below, so a bug in one
 * of the two enforcement points does not, by itself, widen access. An
 * empty `UNIT` scope (`emptyScope()` — a caller with zero grants) compiles
 * to a literal `FALSE` predicate: a page request from such a caller always
 * returns zero rows, never an error and never every risk (CLAUDE.md's
 * "escopo vazio" pitfall).
 *
 * ## `overdueTreatment` — real, as of T141/US5
 *
 * US5 (treatment decisions and treatment actions) now exists, so
 * `RiskSummary.overdueTreatment` reflects genuine data: a risk has
 * `overdueTreatment: true` iff it has at least one `risk_treatment_actions`
 * row whose `due_on` has passed while its `status` is not `COMPLETED`/
 * `CANCELLED` — the IDENTICAL FR-074b predicate `domain/risk-overdue.ts`'s
 * `isOverdueTreatmentAction` (T141) evaluates in TypeScript for a single
 * already-loaded action, expressed here as a correlated `EXISTS` subquery
 * (`overdueTreatmentColumn`/`overdueTreatmentFragment` below) so it can run
 * against all 50,000 register rows in one statement rather than one
 * TypeScript predicate call per row. Both are documented as encoding the
 * SAME rule — a change to which statuses count as terminal, or to the
 * comparison operator, must update both places (the same "documented
 * parity" pattern `overdueReviewFragment`/`isOverdueReview` already
 * establish for `nextReviewOn` in this same file). The QUERY FILTER
 * (`contracts/risks.openapi.yaml`'s `overdueTreatment` parameter) reuses the
 * identical `EXISTS` fragment as a `WHERE` predicate, so the column and the
 * filter can never disagree with each other by construction (one fragment,
 * used twice).
 *
 * `EXPLAIN (ANALYZE, BUFFERS)` measured directly against 50,000 synthetic
 * risks plus 5,000 proportional `risk_treatment_actions` rows (2,500
 * overdue/2,500 future) — see the implementation report for the exact
 * dataset and the full transcripts. Adding this `EXISTS` did not require a
 * new index — the existing `risk_treatment_actions_due_on_status_idx`
 * (`(due_on, status)`, already present from
 * `20260905160100_risk_treatment_and_relationships_baseline`) is what the
 * planner actually used in every measured plan:
 *
 * - **`overdue_treatment` in the `SELECT` list, no filter active** (worst
 *   case: `GLOBAL` scope, no other filter, 50,051 matching rows): the
 *   planner defers the `EXISTS` to run only on the 25 rows that survive the
 *   `ORDER BY`/`LIMIT` (a `SubPlan` below the `Sort`, not evaluated per
 *   candidate row) — 164.3ms -> 168.1ms (+3.7ms, within noise, no plan
 *   shape change).
 * - **Same query, common case** (one org unit + one status filter, ~6,250
 *   matching rows): 22.5ms -> 23.3ms (+0.8ms).
 * - **`overdueTreatment=true` filter active** (2,500 matching rows out of
 *   50,051): the planner rewrites the correlated `EXISTS` into a `Hash Semi
 *   Join` against a `Bitmap Heap Scan` on `risk_treatment_actions` using
 *   `risk_treatment_actions_due_on_status_idx` — 17.8ms end to end, i.e.
 *   the filter is now genuinely selective and fast, replacing the pre-T141
 *   `FALSE` short-circuit with a real, indexed predicate.
 *
 * No measurable regression against the unfiltered/no-treatment-data
 * baseline this file's `SORT_COLUMNS` comment already recorded.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { OrgScopeRepositoryPort } from '../../../core/organizations/domain/ports/org-scope-repository.port';
import {
  overdueEligibleActionStatusSqlList,
  todayDateOnlyUtc,
} from '../../../grc/shared/domain/overdue.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { createPageRequest, toOffsetLimit } from '../../../shared/pagination';
import { RiskQueryPort } from '../domain/ports/risk-query.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  RiskRegisterFilters,
  RiskRegisterPage,
  RiskRegisterQuery,
  RiskRegisterRow,
  RiskRegisterSortField,
} from '../domain/ports/risk-query.port';
import type { RiskLevel, RiskStatus } from '@prisma/client';

/** Whitelisted column fragments for every sort field EXCEPT `riskLevel`,
 * which depends on `riskLevelBasis` and is resolved separately. Never built
 * from request input — `RiskRegisterSortField` is a closed union the
 * presentation-layer DTO already validated against. */
const SORT_COLUMNS: Record<Exclude<RiskRegisterSortField, 'riskLevel'>, Prisma.Sql> = {
  code: Prisma.sql`r.code`,
  title: Prisma.sql`r.title`,
  status: Prisma.sql`r.status`,
  // Sorts by the owner's DISPLAY NAME (`owner.full_name`, from the `JOIN
  // users owner` already present in `listRegister`'s statement), not the
  // opaque `owner_user_id` UUID this used to sort by — the register column
  // labeled "Gestor" shows the name, so ordering by the hidden id produced
  // a sequence that looked random to the user while claiming to be sorted.
  //
  // `COLLATE "pt-BR-x-icu"` makes the ordering locale-correct for
  // Brazilian names (`Álvaro` before `Zoe`, not after — plain byte/`C`
  // ordering sorts every accented letter after `Z`). This database's own
  // default collation (`Portuguese_Brazil.1252` here) already happens to
  // produce the right order locally, but that collation name is
  // Windows-specific and is NOT what `initdb` picks on the Debian/Alpine
  // Postgres image `docker-compose.test.yml` runs (no `LC_COLLATE`/`LANG`
  // is set there, so it falls back to that container's own default, e.g.
  // `C`/`en_US.utf8` — `C` sorts accented letters after `Z`, confirmed by
  // hand: `SELECT * FROM (VALUES ('Álvaro'),('Zoe')) v(n) ORDER BY n
  // COLLATE "C"` puts `Zoe` first). Relying on the database default would
  // therefore be correct on this machine and silently wrong in CI/Docker.
  // `pt-BR-x-icu` is an ICU collation bundled with PostgreSQL's own ICU
  // integration (present by default since PG15, on both this Windows
  // PG18 install and the official `postgres:17-alpine` image), so it does
  // not depend on the OS/container's installed locales the way a libc
  // collation like `pt_BR.UTF-8` would — portable by construction, not by
  // coincidence. This is a fixed literal identifier, never request input.
  //
  // Performance (SC-004, 50,000-row dataset, `EXPLAIN (ANALYZE, BUFFERS)`):
  // this file's `COUNT(*) OVER()` window aggregate already forces the
  // planner to materialize the ENTIRE filtered result set before the
  // outer `LIMIT` can apply (see the file header's "Total count"
  // section), so a `Sort` node over that same materialized set — whether
  // keyed on the UUID or on the joined, collated name — costs the same:
  // measured 152.7ms -> 148.5ms unfiltered/GLOBAL (worst case, disk-spilled
  // WindowAgg) and 8.3ms -> 9.2ms filtered by status + one org unit
  // (common case) with `full_name COLLATE "pt-BR-x-icu"` in place of
  // `owner_user_id` — differences within measurement noise, no new scan,
  // no index needed.
  owner: Prisma.sql`owner.full_name COLLATE "pt-BR-x-icu"`,
  nextReviewOn: Prisma.sql`r.next_review_on`,
  identifiedOn: Prisma.sql`r.identified_on`,
  updatedAt: Prisma.sql`r.updated_at`,
};

interface RawRegisterRow {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description_excerpt: string | null;
  readonly status: RiskStatus;
  readonly category_id: string | null;
  readonly category_code: string | null;
  readonly category_name: string | null;
  readonly org_unit_id: string;
  readonly org_unit_code: string;
  readonly org_unit_name: string;
  readonly owner_id: string;
  readonly owner_full_name: string;
  readonly owner_email: string;
  readonly responsible_id: string | null;
  readonly responsible_full_name: string | null;
  readonly responsible_email: string | null;
  readonly inherent_score: number | null;
  readonly inherent_level: RiskLevel | null;
  readonly residual_score: number | null;
  readonly residual_level: RiskLevel | null;
  readonly last_assessed_on: Date | null;
  readonly next_review_on: Date | null;
  readonly overdue_review: boolean;
  readonly overdue_treatment: boolean;
  readonly pending_approval: boolean;
  readonly version: number;
  readonly updated_at: Date;
  readonly total_count: number;
}

@Injectable()
export class RiskQueryService implements RiskQueryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScopeRepository: OrgScopeRepositoryPort,
  ) {}

  async listRegister(query: RiskRegisterQuery): Promise<RiskRegisterPage> {
    // FR-086: the cap is enforced here regardless of what the
    // presentation-layer DTO already validated — a hard server-side
    // ceiling, not a client-trusted one.
    const { page, pageSize } = createPageRequest({ page: query.page, pageSize: query.pageSize });
    const { offset, limit } = toOffsetLimit({ page, pageSize });

    const todayParam = toDateOnlyParam(todayDateOnlyUtc());
    const riskLevelColumn =
      query.filters.riskLevelBasis === 'INHERENT'
        ? Prisma.sql`r.inherent_level`
        : Prisma.sql`r.residual_level`;

    const whereSql = Prisma.join(
      [
        scopeFragment(query.scope),
        await this.resolveOrgUnitFilter(query.filters, query.scope),
        inFragment(Prisma.sql`r.status`, query.filters.status, '"RiskStatus"[]'),
        inFragment(riskLevelColumn, query.filters.riskLevel, '"RiskLevel"[]'),
        inFragment(Prisma.sql`r.category_id`, query.filters.categoryId, 'uuid[]'),
        inFragment(Prisma.sql`r.owner_user_id`, query.filters.ownerUserId, 'uuid[]'),
        overdueReviewFragment(query.filters.overdueReview, todayParam),
        overdueTreatmentFragment(query.filters.overdueTreatment, todayParam),
        searchFragment(query.filters.q),
      ],
      ' AND ',
    );

    const sortColumn =
      query.sort.field === 'riskLevel' ? riskLevelColumn : SORT_COLUMNS[query.sort.field];
    const directionSql = query.sort.direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    // Stable pagination (US3 AS1): `code` is always the tiebreaker
    // (`contracts/risks.openapi.yaml`'s register description), skipped only
    // when `code` IS the primary sort (it is already unique — `risks_code_key`
    // — so a second `ORDER BY code` term would be redundant, never wrong).
    const orderBySql =
      query.sort.field === 'code'
        ? Prisma.sql`ORDER BY r.code ${directionSql}`
        : Prisma.sql`ORDER BY ${sortColumn} ${directionSql}, r.code ${directionSql}`;

    const rows = await this.prisma.client.$queryRaw<RawRegisterRow[]>(Prisma.sql`
      SELECT
        r.id, r.code, r.title, LEFT(r.description, 200) AS description_excerpt, r.status,
        cat.id AS category_id, cat.code AS category_code, cat.name AS category_name,
        ou.id AS org_unit_id, ou.code AS org_unit_code, ou.name AS org_unit_name,
        owner.id AS owner_id, owner.full_name AS owner_full_name, owner.email AS owner_email,
        resp.id AS responsible_id, resp.full_name AS responsible_full_name, resp.email AS responsible_email,
        r.inherent_score, r.inherent_level, r.residual_score, r.residual_level,
        r.last_assessed_on, r.next_review_on,
        (r.next_review_on IS NOT NULL AND r.next_review_on < ${todayParam}::date) AS overdue_review,
        ${overdueTreatmentExistsFragment(todayParam)} AS overdue_treatment,
        (r.pending_approval_id IS NOT NULL) AS pending_approval,
        r.version, r.updated_at,
        COUNT(*) OVER()::int AS total_count
      FROM risks r
      JOIN organizational_units ou ON ou.id = r.org_unit_id
      JOIN users owner ON owner.id = r.owner_user_id
      LEFT JOIN users resp ON resp.id = r.responsible_user_id
      LEFT JOIN risk_categories cat ON cat.id = r.category_id
      WHERE ${whereSql}
      ${orderBySql}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = rows.length > 0 ? rows[0]!.total_count : await this.countOnly(whereSql);

    return { items: rows.map(toRegisterRow), total };
  }

  /** Only reached when the data page came back empty (genuinely no
   * matches, or an offset past the last page) — see the file header's
   * "Total count" section for why the common case never pays for this
   * second query. */
  private async countOnly(whereSql: Prisma.Sql): Promise<number> {
    const rows = await this.prisma.client.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM risks r
      WHERE ${whereSql}
    `);
    return rows[0]?.total ?? 0;
  }

  /**
   * FR-025b/FR-088 — the `orgUnitId` filter, expanded to descendants when
   * `includeDescendants` is set, intersected with the caller's scope in
   * application code (small sets — data-model.md/ADR-004 size the org tree
   * at roughly 1,000 nodes) BEFORE it ever reaches SQL, so the filter can
   * only narrow `scopeFragment`'s own independent predicate, never widen
   * it (`contracts/risks.openapi.yaml`: "Always intersected with the
   * caller's authorized scope - it narrows, never widens").
   */
  private async resolveOrgUnitFilter(
    filters: RiskRegisterFilters,
    scope: ScopeFilter,
  ): Promise<Prisma.Sql> {
    if (!filters.orgUnitId || filters.orgUnitId.length === 0) {
      return Prisma.sql`TRUE`;
    }

    const requested = filters.includeDescendants
      ? Array.from(await this.orgScopeRepository.expandToDescendants(filters.orgUnitId))
      : Array.from(new Set(filters.orgUnitId));

    const narrowed =
      scope.kind === 'GLOBAL' ? requested : requested.filter((id) => scope.unitIds.has(id));

    if (narrowed.length === 0) {
      return Prisma.sql`FALSE`;
    }

    return Prisma.sql`r.org_unit_id = ANY(${narrowed}::uuid[])`;
  }
}

function scopeFragment(scope: ScopeFilter): Prisma.Sql {
  if (scope.kind === 'GLOBAL') {
    return Prisma.sql`TRUE`;
  }
  if (scope.unitIds.size === 0) {
    // CLAUDE.md "escopo vazio": a caller with no grants sees an empty
    // page, never an error and never every risk.
    return Prisma.sql`FALSE`;
  }
  return Prisma.sql`r.org_unit_id = ANY(${Array.from(scope.unitIds)}::uuid[])`;
}

/**
 * `= ANY($1::type[])` rather than `IN ($1, $2, ...)` (`Prisma.join`):
 * PostgreSQL does not implicitly cast a raw-SQL parameter's wire type to a
 * `uuid`/enum COLUMN type in a comparison (confirmed empirically —
 * `uuid = text`/`"RiskStatus" = text` "operator does not exist" errors when
 * `IN` was tried first, see the implementation report). Binding the values
 * as ONE array parameter and casting the whole array to the column's array
 * type resolves it with a single explicit cast. `arrayType` is always one
 * of this file's own fixed literals (`'uuid[]'`, `'"RiskStatus"[]'`,
 * `'"RiskLevel"[]'`) — never built from request input.
 */
function inFragment(
  column: Prisma.Sql,
  values: readonly string[] | undefined,
  arrayType: string,
): Prisma.Sql {
  if (!values || values.length === 0) {
    return Prisma.sql`TRUE`;
  }
  return Prisma.sql`${column} = ANY(${values}::${Prisma.raw(arrayType)})`;
}

function overdueReviewFragment(overdueReview: boolean | undefined, todayParam: string): Prisma.Sql {
  if (!overdueReview) {
    return Prisma.sql`TRUE`;
  }
  return Prisma.sql`(r.next_review_on IS NOT NULL AND r.next_review_on < ${todayParam}::date)`;
}

/**
 * 007-implementation-remediation, Frente A, D-7 — the ONE `EXISTS`
 * predicate both the `overdue_treatment` SELECT column and the
 * `overdueTreatment` WHERE filter below are built from, so they cannot
 * disagree with each other (see the file header's "documented parity"
 * note). Reads `actions` directly, by origin
 * (`origin_type = 'RISK_TREATMENT' AND origin_id = r.id`) — `Action` is now
 * the sole authority for a risk treatment action's status/due date (D-1);
 * `risk_treatment_actions` no longer carries either column.
 * The overdue-eligible statuses are never a literal here — coordinator
 * correction: this used to hand-write `IN ('OPEN', 'IN_PROGRESS')`, one of
 * three sites that each restated
 * `grc/shared/domain/overdue.service.ts#isActionOverdue`'s status set
 * independently, agreeing only because three people wrote the same two
 * words three times. `overdueEligibleActionStatusSqlList()` below reads
 * that file's own array, so this SQL text is now generated FROM the single
 * authority instead of merely matching it by coincidence — proven by
 * `test/integration/overdue-eligible-status-consolidation.spec.ts`, which mutates
 * that array and executes this exact query for real. The scope predicate
 * stays on `r` (the RISK), never on
 * `a.org_unit_id` — see data-model.md §3's invariant: `Action.orgUnitId`
 * is a creation-time snapshot that can go stale after a reorganization,
 * while the risk's own current unit is what
 * `assertActionOriginInScope` already treats as authoritative at write
 * time. This EXISTS clause carries no scope predicate of its own (the
 * caller's own scope is applied to `r` elsewhere in this query), so that
 * invariant is preserved by construction, not by this fragment repeating
 * it.
 */
function overdueTreatmentExistsFragment(todayParam: string): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM actions a
    WHERE a.origin_type = 'RISK_TREATMENT'
      AND a.origin_id = r.id
      AND a.status IN (${Prisma.raw(overdueEligibleActionStatusSqlList())})
      AND a.due_on < ${todayParam}::date
  )`;
}

function overdueTreatmentFragment(
  overdueTreatment: boolean | undefined,
  todayParam: string,
): Prisma.Sql {
  if (!overdueTreatment) {
    return Prisma.sql`TRUE`;
  }
  return overdueTreatmentExistsFragment(todayParam);
}

function searchFragment(q: string | undefined): Prisma.Sql {
  const trimmed = q?.trim();
  if (!trimmed) {
    return Prisma.sql`TRUE`;
  }
  // Must match the GIN trigram index's expression EXACTLY (same operands,
  // same `||` associativity) — see the file header. `%...%` deliberately
  // does not escape literal `%`/`_` in `trimmed`: FR-089 requires substring
  // search, not literal-wildcard escaping, and doing so would risk the
  // planner no longer recognizing the indexed expression.
  const pattern = `%${trimmed}%`;
  return Prisma.sql`(r.code || ' ' || r.title || ' ' || r.description) ILIKE ${pattern}`;
}

function toDateOnlyParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toReferenceDataRefOrUndefined(
  id: string | null,
  code: string | null,
  name: string | null,
): { id: string; code: string; name: string } | undefined {
  return id && code && name ? { id, code, name } : undefined;
}

function toRegisterRow(row: RawRegisterRow): RiskRegisterRow {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    descriptionExcerpt: row.description_excerpt,
    status: row.status,
    category: toReferenceDataRefOrUndefined(row.category_id, row.category_code, row.category_name),
    orgUnit: { id: row.org_unit_id, code: row.org_unit_code, name: row.org_unit_name },
    owner: { id: row.owner_id, fullName: row.owner_full_name, email: row.owner_email },
    responsible:
      row.responsible_id && row.responsible_full_name && row.responsible_email
        ? {
            id: row.responsible_id,
            fullName: row.responsible_full_name,
            email: row.responsible_email,
          }
        : undefined,
    inherentScore: row.inherent_score ?? undefined,
    inherentLevel: row.inherent_level ?? undefined,
    residualScore: row.residual_score ?? undefined,
    residualLevel: row.residual_level ?? undefined,
    lastAssessedOn: row.last_assessed_on ?? undefined,
    nextReviewOn: row.next_review_on ?? undefined,
    overdueReview: row.overdue_review,
    overdueTreatment: row.overdue_treatment,
    pendingApproval: row.pending_approval,
    version: row.version,
    updatedAt: row.updated_at,
  };
}
