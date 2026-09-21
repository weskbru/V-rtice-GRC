/**
 * T020/003-controls-management — `ControlQueryService`: the sole
 * Prisma-backed implementation of `ControlQueryPort`, backing `GET
 * /controls` (US1, `contracts/controls.openapi.yaml`'s
 * `listControlCatalog` operation, SC-008's 50,000-control target).
 *
 * Raw SQL, for the same reason `RiskQueryService` uses it (see that file's
 * header for the full account this one does not repeat): the combined
 * filter/search/sort/scope/effectiveness query needs to be ONE code path,
 * and `effectiveness` has no stored column at all (data-model.md §3,
 * FR-012) — it can only ever be expressed as the SQL expression
 * `controlEffectivenessExpression` builds (T015), never a typed Prisma
 * `where`.
 *
 * ## Effectiveness parity (D-2)
 *
 * `controlEffectivenessExpression` (`control-effectiveness-query.ts`) is
 * the SAME expression `control-effectiveness-parity.spec.ts` (T016)
 * already proves agrees with `calculateControlEffectiveness`
 * (`domain/control-effectiveness.service.ts`) over real data — this
 * service reuses it verbatim for both the `effectiveness` SELECT column
 * and the `effectiveness` filter/sort, so the catalog's derived value can
 * never diverge from the single-control read's own
 * `ControlRepository.findById` (which uses the TypeScript calculator
 * directly).
 *
 * ## Scope (FR-007) — required, never optional
 *
 * `scope` is a required, non-optional parameter on `ControlQueryPort
 * .listCatalog` and is applied unconditionally, independent of whatever
 * `orgUnitId` filter the caller supplied — the same two-independent-points
 * discipline `RiskQueryService`'s own header documents (its own "escopo
 * vazio" pitfall: an empty `UNIT` scope compiles to `FALSE`, never "no
 * filter").
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { createPageRequest, toOffsetLimit } from '../../../shared/pagination';
import { ControlQueryPort } from '../domain/ports/control-query.port';

import { controlEffectivenessExpression } from './control-effectiveness-query';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ControlEffectiveness } from '../domain/control-effectiveness.service';
import type {
  ControlCatalogFilters,
  ControlCatalogPage,
  ControlCatalogQuery,
  ControlCatalogRow,
  ControlCatalogSortField,
} from '../domain/ports/control-query.port';
import type { ControlFrequency, ControlNature, ControlStatus, ControlType } from '@prisma/client';

/** Whitelisted column fragments for every sort field except `effectiveness`,
 * which is resolved separately via `controlEffectivenessExpression`. Never
 * built from request input — `ControlCatalogSortField` is a closed union
 * the presentation-layer DTO already validated against. */
const SORT_COLUMNS: Record<Exclude<ControlCatalogSortField, 'effectiveness'>, Prisma.Sql> = {
  code: Prisma.sql`c.code`,
  name: Prisma.sql`c.name`,
  status: Prisma.sql`c.status`,
  // `COLLATE "pt-BR-x-icu"` — locale-correct ordering of Brazilian names,
  // same reasoning and same fixed literal `RiskQueryService`'s own `owner`
  // sort column documents at length (never request input).
  owner: Prisma.sql`owner.full_name COLLATE "pt-BR-x-icu"`,
  updatedAt: Prisma.sql`c.updated_at`,
};

interface RawCatalogRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description_excerpt: string | null;
  readonly description: string | null;
  readonly org_unit_id: string | null;
  readonly org_unit_code: string | null;
  readonly org_unit_name: string | null;
  readonly owner_id: string | null;
  readonly owner_full_name: string | null;
  readonly owner_email: string | null;
  readonly nature: ControlNature | null;
  readonly control_type: ControlType | null;
  readonly frequency: ControlFrequency | null;
  readonly status: ControlStatus;
  readonly effectiveness: ControlEffectiveness;
  readonly version: number;
  readonly updated_at: Date;
  readonly total_count: number;
}

@Injectable()
export class ControlQueryService implements ControlQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(query: ControlCatalogQuery): Promise<ControlCatalogPage> {
    // FR-086-equivalent (contracts/controls.openapi.yaml's PageSize cap):
    // enforced here regardless of what the presentation-layer DTO already
    // validated — a hard server-side ceiling, never a client-trusted one.
    const { page, pageSize } = createPageRequest({ page: query.page, pageSize: query.pageSize });
    const { offset, limit } = toOffsetLimit({ page, pageSize });

    const referenceDateParam = toDateOnlyParam(query.referenceDate);
    const effectivenessExpr = controlEffectivenessExpression(
      Prisma.sql`c.id`,
      Prisma.sql`c.frequency`,
      referenceDateParam,
    );

    const whereSql = Prisma.join(
      [
        scopeFragment(query.scope),
        resolveOrgUnitFilter(query.filters, query.scope),
        inFragment(Prisma.sql`c.status`, query.filters.status, '"ControlStatus"[]'),
        inFragment(Prisma.sql`c.nature`, query.filters.nature, '"ControlNature"[]'),
        inFragment(Prisma.sql`c.control_type`, query.filters.type, '"ControlType"[]'),
        inFragment(Prisma.sql`c.frequency`, query.filters.frequency, '"ControlFrequency"[]'),
        inFragment(Prisma.sql`c.owner_user_id`, query.filters.ownerUserId, 'uuid[]'),
        effectivenessFragment(effectivenessExpr, query.filters.effectiveness),
        searchFragment(query.filters.q),
      ],
      ' AND ',
    );

    const sortColumn =
      query.sort.field === 'effectiveness' ? effectivenessExpr : SORT_COLUMNS[query.sort.field];
    const directionSql = query.sort.direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    // Stable pagination: `code` is always the tiebreaker
    // (`contracts/controls.openapi.yaml`'s own "code as the tiebreaker"),
    // skipped only when `code` IS the primary sort — it is already unique
    // (`controls_code_key`), so a second `ORDER BY code` term would be
    // redundant, never wrong. Same convention as `RiskQueryService`.
    const orderBySql =
      query.sort.field === 'code'
        ? Prisma.sql`ORDER BY c.code ${directionSql}`
        : Prisma.sql`ORDER BY ${sortColumn} ${directionSql}, c.code ${directionSql}`;

    const rows = await this.prisma.client.$queryRaw<RawCatalogRow[]>(Prisma.sql`
      SELECT
        c.id, c.code, c.name, LEFT(c.description, 200) AS description_excerpt, c.description,
        ou.id AS org_unit_id, ou.code AS org_unit_code, ou.name AS org_unit_name,
        owner.id AS owner_id, owner.full_name AS owner_full_name, owner.email AS owner_email,
        c.nature, c.control_type, c.frequency, c.status,
        ${effectivenessExpr} AS effectiveness,
        c.version, c.updated_at,
        COUNT(*) OVER()::int AS total_count
      FROM controls c
      LEFT JOIN organizational_units ou ON ou.id = c.org_unit_id
      LEFT JOIN users owner ON owner.id = c.owner_user_id
      WHERE ${whereSql}
      ${orderBySql}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = rows.length > 0 ? rows[0]!.total_count : await this.countOnly(whereSql);

    return { items: rows.map(toCatalogRow), total };
  }

  /** Only reached when the data page came back empty — see
   * `RiskQueryService.countOnly`'s own doc comment for why the common case
   * never pays for this second query. */
  private async countOnly(whereSql: Prisma.Sql): Promise<number> {
    const rows = await this.prisma.client.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM controls c
      LEFT JOIN organizational_units ou ON ou.id = c.org_unit_id
      LEFT JOIN users owner ON owner.id = c.owner_user_id
      WHERE ${whereSql}
    `);
    return rows[0]?.total ?? 0;
  }
}

function scopeFragment(scope: ScopeFilter): Prisma.Sql {
  if (scope.kind === 'GLOBAL') {
    return Prisma.sql`TRUE`;
  }
  if (scope.unitIds.size === 0) {
    // Same "escopo vazio" discipline as `RiskQueryService`: a caller with
    // no grants sees an empty page, never an error and never every
    // control.
    return Prisma.sql`FALSE`;
  }
  return Prisma.sql`c.org_unit_id = ANY(${Array.from(scope.unitIds)}::uuid[])`;
}

/**
 * FR-025-equivalent — the `orgUnitId` filter, intersected with the
 * caller's scope BEFORE it reaches SQL (narrows, never widens), mirroring
 * `RiskQueryService.resolveOrgUnitFilter` minus descendant expansion —
 * `contracts/controls.openapi.yaml`'s `orgUnitId` parameter has no
 * `includeDescendants` sibling, unlike the risk register's.
 */
function resolveOrgUnitFilter(filters: ControlCatalogFilters, scope: ScopeFilter): Prisma.Sql {
  if (!filters.orgUnitId || filters.orgUnitId.length === 0) {
    return Prisma.sql`TRUE`;
  }

  const requested = Array.from(new Set(filters.orgUnitId));
  const narrowed =
    scope.kind === 'GLOBAL' ? requested : requested.filter((id) => scope.unitIds.has(id));

  if (narrowed.length === 0) {
    return Prisma.sql`FALSE`;
  }

  return Prisma.sql`c.org_unit_id = ANY(${narrowed}::uuid[])`;
}

/** `= ANY($1::type[])` rather than `IN (...)` — PostgreSQL does not
 * implicitly cast a raw-SQL parameter's wire type to a `uuid`/enum column
 * type in a comparison, the same reasoning `RiskQueryService.inFragment`
 * documents at length. `arrayType` is always one of this file's own fixed
 * literals, never request input. */
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

/** The `effectiveness` filter — built from the SAME expression the
 * `SELECT`/`ORDER BY` use (`effectivenessExpr`), so it can never disagree
 * with either. Compared as text, since the expression's own `CASE`
 * produces plain string literals, not a Postgres enum value. */
function effectivenessFragment(
  effectivenessExpr: Prisma.Sql,
  values: readonly ControlEffectiveness[] | undefined,
): Prisma.Sql {
  if (!values || values.length === 0) {
    return Prisma.sql`TRUE`;
  }
  return Prisma.sql`${effectivenessExpr} = ANY(${values}::text[])`;
}

function searchFragment(q: string | undefined): Prisma.Sql {
  const trimmed = q?.trim();
  if (!trimmed) {
    return Prisma.sql`TRUE`;
  }
  const pattern = `%${trimmed}%`;
  return Prisma.sql`(c.code || ' ' || c.name) ILIKE ${pattern}`;
}

function toDateOnlyParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toCatalogRow(row: RawCatalogRow): ControlCatalogRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    descriptionExcerpt: row.description_excerpt,
    description: row.description,
    orgUnit:
      row.org_unit_id && row.org_unit_code && row.org_unit_name
        ? { id: row.org_unit_id, code: row.org_unit_code, name: row.org_unit_name }
        : null,
    owner:
      row.owner_id && row.owner_full_name && row.owner_email
        ? { id: row.owner_id, fullName: row.owner_full_name, email: row.owner_email }
        : undefined,
    nature: row.nature ?? undefined,
    type: row.control_type ?? undefined,
    frequency: row.frequency ?? undefined,
    status: row.status,
    effectiveness: row.effectiveness,
    version: row.version,
    updatedAt: row.updated_at,
  };
}
