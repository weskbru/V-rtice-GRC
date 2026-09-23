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

const SORT_COLUMNS: Record<Exclude<RiskRegisterSortField, 'riskLevel'>, Prisma.Sql> = {
  code: Prisma.sql`r.code`,
  title: Prisma.sql`r.title`,
  status: Prisma.sql`r.status`,
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

  private async countOnly(whereSql: Prisma.Sql): Promise<number> {
    const rows = await this.prisma.client.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM risks r
      WHERE ${whereSql}
    `);
    return rows[0]?.total ?? 0;
  }

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
    return Prisma.sql`FALSE`;
  }
  return Prisma.sql`r.org_unit_id = ANY(${Array.from(scope.unitIds)}::uuid[])`;
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

function overdueReviewFragment(overdueReview: boolean | undefined, todayParam: string): Prisma.Sql {
  if (!overdueReview) {
    return Prisma.sql`TRUE`;
  }
  return Prisma.sql`(r.next_review_on IS NOT NULL AND r.next_review_on < ${todayParam}::date)`;
}

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
