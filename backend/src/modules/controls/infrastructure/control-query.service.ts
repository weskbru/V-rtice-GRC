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

const SORT_COLUMNS: Record<Exclude<ControlCatalogSortField, 'effectiveness'>, Prisma.Sql> = {
  code: Prisma.sql`c.code`,
  name: Prisma.sql`c.name`,
  status: Prisma.sql`c.status`,
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
    return Prisma.sql`FALSE`;
  }
  return Prisma.sql`c.org_unit_id = ANY(${Array.from(scope.unitIds)}::uuid[])`;
}

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
