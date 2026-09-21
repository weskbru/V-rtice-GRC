/**
 * 008-incidents-problems, US2 — `PrismaProblemRepository`, the sole
 * implementation of `ProblemRepositoryPort`. Extends
 * `ProblemScopedRepository`, which fixes `applyScope`/`withScope` to
 * `orgUnitId` — every scoped method below is compile-time required to
 * thread the caller's `ScopeFilter` through it.
 *
 * `findCompletedOriginActionCompleters` reads the shared `actions` table
 * directly via the same `PrismaService` client this repository already
 * holds — not a `modules/problems -> grc/action` boundary violation, the
 * identical reasoning `PrismaFindingRepository`'s own header gives for
 * its equivalent query (no FK from `Action.originId` to any table,
 * R-001; the only way to answer "which actions target this problem" is a
 * plain `WHERE originType = 'PROBLEM' AND originId = :id` query against
 * the one shared table).
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import { ProblemScopedRepository } from './problem-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  ApplyProblemTransitionChanges,
  CreateProblemRecordInput,
  ProblemListFilter,
  ProblemListPage,
  ProblemListSortField,
  ProblemRecord,
  ProblemRepositoryPort,
  UpdateProblemChanges,
} from '../domain/ports/problem-repository.port';
import type { Prisma } from '@prisma/client';

const PROBLEM_INCLUDE = {
  orgUnit: { select: { id: true, code: true, name: true } },
  owner: { select: { id: true, fullName: true } },
  resolvedByUser: { select: { id: true, fullName: true } },
  closedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.ProblemInclude;

type ProblemWithRelations = Prisma.ProblemGetPayload<{ include: typeof PROBLEM_INCLUDE }>;

const SORT_FIELD_TO_COLUMN: Readonly<
  Record<ProblemListSortField, keyof Prisma.ProblemOrderByWithRelationInput>
> = {
  code: 'code',
  title: 'title',
  severity: 'severity',
  status: 'status',
  identifiedOn: 'identifiedOn',
  updatedAt: 'updatedAt',
};

@Injectable()
export class PrismaProblemRepository
  extends ProblemScopedRepository
  implements ProblemRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateProblemRecordInput): Promise<ProblemRecord> {
    const created = await this.prisma.client.problem.create({
      data: {
        code: input.code,
        title: input.title,
        description: input.description,
        severity: input.severity,
        orgUnitId: input.orgUnitId,
        ownerUserId: input.ownerUserId,
        identifiedOn: input.identifiedOn,
      },
      include: PROBLEM_INCLUDE,
    });
    return this.toProblemRecord(created);
  }

  async findById(scope: ScopeFilter, id: string): Promise<ProblemRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.problem.findFirst({ where, include: PROBLEM_INCLUDE }),
    );
    return row ? this.toProblemRecord(row) : undefined;
  }

  /** F-38 — see `ProblemRepositoryPort.findOrgUnitIdUnscoped`'s doc
   * comment. One extra indexed-by-PK `SELECT`, paid only by a caller that
   * already knows a scoped lookup just returned nothing. */
  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.problem.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }

  async update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateProblemChanges,
  ): Promise<ProblemRecord | undefined> {
    const data: Prisma.ProblemUncheckedUpdateManyInput = {};
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.severity !== undefined) data.severity = changes.severity;
    if (changes.ownerUserId !== undefined) data.ownerUserId = changes.ownerUserId;

    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.problem.updateMany({ where, data }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async applyTransition(
    scope: ScopeFilter,
    id: string,
    changes: ApplyProblemTransitionChanges,
  ): Promise<ProblemRecord | undefined> {
    const data: Prisma.ProblemUncheckedUpdateManyInput = { status: changes.status };
    if (changes.rootCause !== undefined) data.rootCause = changes.rootCause;
    if (changes.resolvedAt !== undefined) data.resolvedAt = changes.resolvedAt;
    if (changes.resolvedByUserId !== undefined) data.resolvedByUserId = changes.resolvedByUserId;
    if (changes.closedAt !== undefined) data.closedAt = changes.closedAt;
    if (changes.closedByUserId !== undefined) data.closedByUserId = changes.closedByUserId;
    if (changes.cancellationReason !== undefined)
      data.cancellationReason = changes.cancellationReason;
    if (changes.cancelledAt !== undefined) data.cancelledAt = changes.cancelledAt;
    if (changes.cancelledByUserId !== undefined) data.cancelledByUserId = changes.cancelledByUserId;

    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.problem.updateMany({ where, data }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async findCompletedOriginActionCompleters(problemId: string): Promise<readonly string[]> {
    const rows = await this.prisma.client.action.findMany({
      where: { originType: 'PROBLEM', originId: problemId, status: 'COMPLETED' },
      select: { completedByUserId: true },
    });
    // Invariant A1 (`grc/action`): `completedByUserId` is stamped together
    // with `status: COMPLETED` — never `null` for a row this query
    // matches. The filter below is defensive, not an expected branch.
    return rows
      .map((row) => row.completedByUserId)
      .filter((value): value is string => value !== null);
  }

  async list(
    scope: ScopeFilter,
    filter: ProblemListFilter,
    page: number,
    pageSize: number,
    sort: ProblemListSortField,
    direction: 'asc' | 'desc',
  ): Promise<ProblemListPage> {
    const where: Prisma.ProblemWhereInput = {};
    if (filter.status && filter.status.length > 0) where.status = { in: [...filter.status] };
    if (filter.severity && filter.severity.length > 0)
      where.severity = { in: [...filter.severity] };
    if (filter.orgUnitId !== undefined) where.orgUnitId = filter.orgUnitId;
    if (filter.search) {
      // `search` matches `code` and `title` (contracts/problems.openapi
      // .yaml's own `listProblems` description).
      where.OR = [
        { code: { contains: filter.search, mode: 'insensitive' } },
        { title: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const scopedWhere = this.applyScope(scope, where);
    const orderBy: Prisma.ProblemOrderByWithRelationInput = {
      [SORT_FIELD_TO_COLUMN[sort]]: direction,
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.problem.findMany({
        where: scopedWhere,
        include: PROBLEM_INCLUDE,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.problem.count({ where: scopedWhere }),
    ]);

    return {
      items: rows.map((row) => this.toProblemRecord(row)),
      page,
      pageSize,
      total,
      totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
    };
  }

  private toProblemRecord(row: ProblemWithRelations): ProblemRecord {
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      orgUnit: { id: row.orgUnit.id, code: row.orgUnit.code, name: row.orgUnit.name },
      owner: { id: row.owner.id, fullName: row.owner.fullName },
      identifiedOn: row.identifiedOn,
      rootCause: row.rootCause ?? undefined,
      resolvedAt: row.resolvedAt ?? undefined,
      resolvedBy: row.resolvedByUser
        ? { id: row.resolvedByUser.id, fullName: row.resolvedByUser.fullName }
        : undefined,
      closedAt: row.closedAt ?? undefined,
      closedBy: row.closedByUser
        ? { id: row.closedByUser.id, fullName: row.closedByUser.fullName }
        : undefined,
      cancellationReason: row.cancellationReason ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
