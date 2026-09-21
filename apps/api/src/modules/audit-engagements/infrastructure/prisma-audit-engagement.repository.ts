/**
 * T024/005-audit-findings, User Story 1 — `PrismaAuditEngagementRepository`,
 * the sole implementation of `AuditEngagementRepositoryPort`. Extends
 * `AuditEngagementScopedRepository` so every method below is compile-time
 * required to apply the caller's organizational `ScopeFilter` (FR-018) —
 * the same discipline `ControlRepository`/`RiskRepository` establish.
 *
 * `updateWithVersion`/`applyLifecycleTransition` — race-free by the same
 * single conditional `UPDATE ... WHERE id = ? AND version = ? AND <scope>`
 * mechanism `ControlRepository`/`FrameworkVersionRepository` already
 * document (research.md D-18).
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditEngagementRepositoryPort } from '../domain/ports/audit-engagement-repository.port';

import { AuditEngagementScopedRepository } from './audit-engagement-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  ApplyAuditEngagementTransitionChanges,
  AuditEngagementListPage,
  AuditEngagementListQuery,
  AuditEngagementRecord,
  AuditEngagementUpdateResult,
  CreateAuditEngagementRecordInput,
  UpdateAuditEngagementChanges,
} from '../domain/ports/audit-engagement-repository.port';
import type { Prisma } from '@prisma/client';

const AUDIT_ENGAGEMENT_INCLUDE = {
  orgUnit: { select: { id: true, code: true, name: true } },
  leadAuditor: { select: { id: true, fullName: true, email: true } },
  startedByUser: { select: { id: true, fullName: true, email: true } },
  completedByUser: { select: { id: true, fullName: true, email: true } },
  cancelledByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.AuditEngagementInclude;

type AuditEngagementWithRelations = Prisma.AuditEngagementGetPayload<{
  include: typeof AUDIT_ENGAGEMENT_INCLUDE;
}>;

@Injectable()
export class PrismaAuditEngagementRepository
  extends AuditEngagementScopedRepository
  implements AuditEngagementRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateAuditEngagementRecordInput): Promise<AuditEngagementRecord> {
    const created = await this.prisma.client.auditEngagement.create({
      data: {
        code: input.code,
        objective: input.objective,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        orgUnitId: input.orgUnitId,
        leadAuditorUserId: input.leadAuditorUserId,
      },
      include: AUDIT_ENGAGEMENT_INCLUDE,
    });
    return toAuditEngagementRecord(created);
  }

  async findById(scope: ScopeFilter, id: string): Promise<AuditEngagementRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.auditEngagement.findFirst({ where, include: AUDIT_ENGAGEMENT_INCLUDE }),
    );
    return row ? toAuditEngagementRecord(row) : undefined;
  }

  /** F-38-style escape hatch — see `ControlRepository.findOrgUnitIdUnscoped`'s
   * doc comment for the full non-disclosure reasoning this mirrors. */
  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.auditEngagement.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }

  async list(query: AuditEngagementListQuery): Promise<AuditEngagementListPage> {
    let where: Prisma.AuditEngagementWhereInput = {};
    if (query.filters.status && query.filters.status.length > 0) {
      where.status = { in: Array.from(query.filters.status) };
    }
    if (query.filters.orgUnitId && query.filters.orgUnitId.length > 0) {
      where.orgUnitId = { in: Array.from(query.filters.orgUnitId) };
    }
    if (query.filters.leadAuditorUserId && query.filters.leadAuditorUserId.length > 0) {
      where.leadAuditorUserId = { in: Array.from(query.filters.leadAuditorUserId) };
    }
    where = this.applyScopeForList(query.scope, where);

    const orderBy: Prisma.AuditEngagementOrderByWithRelationInput = {
      [query.sortField]: query.sortDirection,
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.auditEngagement.findMany({
        where,
        include: AUDIT_ENGAGEMENT_INCLUDE,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.auditEngagement.count({ where }),
    ]);

    return { items: rows.map(toAuditEngagementRecord), total };
  }

  async updateWithVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: UpdateAuditEngagementChanges,
  ): Promise<AuditEngagementUpdateResult> {
    const data: Prisma.AuditEngagementUncheckedUpdateManyInput = { version: { increment: 1 } };
    if (changes.objective !== undefined) data.objective = changes.objective;
    if (changes.periodStart !== undefined) data.periodStart = changes.periodStart;
    if (changes.periodEnd !== undefined) data.periodEnd = changes.periodEnd;
    if (changes.orgUnitId !== undefined) data.orgUnitId = changes.orgUnitId;
    if (changes.leadAuditorUserId !== undefined) data.leadAuditorUserId = changes.leadAuditorUserId;

    return this.conditionalVersionUpdate(scope, id, expectedVersion, data);
  }

  async applyLifecycleTransition(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: ApplyAuditEngagementTransitionChanges,
  ): Promise<AuditEngagementUpdateResult> {
    const data: Prisma.AuditEngagementUncheckedUpdateManyInput = {
      version: { increment: 1 },
      status: changes.status,
    };
    if (changes.startedAt !== undefined) data.startedAt = changes.startedAt;
    if (changes.startedByUserId !== undefined) data.startedByUserId = changes.startedByUserId;
    if (changes.completedAt !== undefined) data.completedAt = changes.completedAt;
    if (changes.completedByUserId !== undefined) data.completedByUserId = changes.completedByUserId;
    if (changes.cancelledAt !== undefined) data.cancelledAt = changes.cancelledAt;
    if (changes.cancelledByUserId !== undefined) data.cancelledByUserId = changes.cancelledByUserId;
    if (changes.cancellationJustification !== undefined) {
      data.cancellationJustification = changes.cancellationJustification;
    }

    return this.conditionalVersionUpdate(scope, id, expectedVersion, data);
  }

  /** `list`'s own scope predicate, applied AFTER the caller's filters —
   * exposed via the protected base rather than reimplemented, mirroring
   * `ControlQueryService`'s own reliance on `applyScopeToWhere`. */
  private applyScopeForList(
    scope: ScopeFilter,
    where: Prisma.AuditEngagementWhereInput,
  ): Prisma.AuditEngagementWhereInput {
    return this.applyScope(scope, where);
  }

  /** Shared conditional `UPDATE ... WHERE id = ? AND version = ? AND
   * <scope>` mechanism, factored out of `updateWithVersion`/
   * `applyLifecycleTransition` exactly as `ControlRepository
   * .conditionalVersionUpdate` factors out its own equivalents. */
  private async conditionalVersionUpdate(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    data: Prisma.AuditEngagementUncheckedUpdateManyInput,
  ): Promise<AuditEngagementUpdateResult> {
    const result = await this.withScope(scope, { id, version: expectedVersion }, (where) =>
      this.prisma.client.auditEngagement.updateMany({ where, data }),
    );

    if (result.count > 0) {
      const updated = await this.findById(scope, id);
      // Defensive only: a row this same transaction just updated cannot
      // vanish from a `findById` scoped by the same filter a moment later.
      if (!updated) {
        return { outcome: 'NOT_FOUND' };
      }
      return { outcome: 'UPDATED', record: updated };
    }

    const current = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.auditEngagement.findFirst({
        where,
        select: { version: true, status: true },
      }),
    );

    if (!current) {
      return { outcome: 'NOT_FOUND' };
    }

    return {
      outcome: 'VERSION_CONFLICT',
      currentVersion: current.version,
      currentStatus: current.status,
    };
  }
}

function toOptionalRef(
  row: { id: string; fullName: string; email: string } | null,
): AuditEngagementRecord['startedBy'] {
  return row ? { id: row.id, fullName: row.fullName, email: row.email } : undefined;
}

function toRequiredRef(row: {
  id: string;
  fullName: string;
  email: string;
}): AuditEngagementRecord['leadAuditor'] {
  return { id: row.id, fullName: row.fullName, email: row.email };
}

function toAuditEngagementRecord(row: AuditEngagementWithRelations): AuditEngagementRecord {
  return {
    id: row.id,
    code: row.code,
    objective: row.objective,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    orgUnit: { id: row.orgUnit.id, code: row.orgUnit.code, name: row.orgUnit.name },
    leadAuditor: toRequiredRef(row.leadAuditor),
    status: row.status,
    startedAt: row.startedAt ?? undefined,
    startedBy: toOptionalRef(row.startedByUser),
    completedAt: row.completedAt ?? undefined,
    completedBy: toOptionalRef(row.completedByUser),
    cancelledAt: row.cancelledAt ?? undefined,
    cancelledBy: toOptionalRef(row.cancelledByUser),
    cancellationJustification: row.cancellationJustification ?? undefined,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
