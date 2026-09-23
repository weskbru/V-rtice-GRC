import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ScopedRepository } from '../../../shared/persistence/scoped-repository';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';

import { toAssessmentRecord } from './risk-assessment.repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { AssessmentRecord } from '../domain/ports/risk-assessment-repository.port';
import type {
  CreateRiskRecordInput,
  OrgUnitRefRecord,
  ReferenceDataRefRecord,
  RiskAssessmentUpdateChanges,
  RiskLifecycleUpdateChanges,
  RiskRecord,
  RiskStatementRecord,
  RiskTreatmentUpdateChanges,
  RiskUpdateResult,
  UpdateRiskChanges,
  UserRefRecord,
} from '../domain/ports/risk-repository.port';
import type { Prisma } from '@prisma/client';

const CURRENT_ASSESSMENT_INCLUDE = {
  include: {
    methodologyVersion: { select: { id: true, versionNumber: true } },
    assessedByUser: { select: { id: true, fullName: true, email: true } },
    previousAssessment: { select: { inherentLevel: true, residualLevel: true } },
  },
} satisfies Prisma.Risk$currentAssessmentArgs;

const RISK_INCLUDE = {
  category: { select: { id: true, code: true, name: true } },
  type: { select: { id: true, code: true, name: true } },
  origin: { select: { id: true, code: true, name: true } },
  orgUnit: { select: { id: true, code: true, name: true } },
  owner: { select: { id: true, fullName: true, email: true } },
  responsible: { select: { id: true, fullName: true, email: true } },
  causes: { orderBy: { sortOrder: 'asc' } },
  consequences: { orderBy: { sortOrder: 'asc' } },
  currentAssessment: CURRENT_ASSESSMENT_INCLUDE,
} satisfies Prisma.RiskInclude;

type RiskWithRelations = Prisma.RiskGetPayload<{ include: typeof RISK_INCLUDE }>;

@Injectable()
export class RiskRepository
  extends ScopedRepository<Prisma.RiskWhereInput>
  implements RiskRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super('orgUnitId');
  }

  async create(input: CreateRiskRecordInput): Promise<RiskRecord> {
    const created = await this.prisma.client.risk.create({
      data: {
        code: input.code,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId ?? null,
        typeId: input.typeId ?? null,
        originId: input.originId ?? null,
        orgUnitId: input.orgUnitId,
        ownerUserId: input.ownerUserId,
        responsibleUserId: input.responsibleUserId ?? null,
        identifiedOn: input.identifiedOn,
        nextReviewOn: input.nextReviewOn ?? null,
        causes: {
          create: input.causes.map((description, index) => ({ description, sortOrder: index })),
        },
        consequences: {
          create: input.consequences.map((description, index) => ({
            description,
            sortOrder: index,
          })),
        },
      },
      include: RISK_INCLUDE,
    });

    return toRiskRecord(created);
  }

  async findById(scope: ScopeFilter, id: string): Promise<RiskRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.risk.findFirst({ where, include: RISK_INCLUDE }),
    );

    return row ? toRiskRecord(row) : undefined;
  }

  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.risk.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }

  async listIdsInScope(scope: ScopeFilter): Promise<readonly string[]> {
    const rows = await this.withScope(scope, {}, (where) =>
      this.prisma.client.risk.findMany({ where, select: { id: true } }),
    );
    return rows.map((row) => row.id);
  }

  async updateWithVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: UpdateRiskChanges,
  ): Promise<RiskUpdateResult> {
    const data: Prisma.RiskUncheckedUpdateManyInput = { version: { increment: 1 } };

    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.categoryId !== undefined) data.categoryId = changes.categoryId;
    if (changes.typeId !== undefined) data.typeId = changes.typeId;
    if (changes.originId !== undefined) data.originId = changes.originId;
    if (changes.orgUnitId !== undefined) data.orgUnitId = changes.orgUnitId;
    if (changes.ownerUserId !== undefined) data.ownerUserId = changes.ownerUserId;
    if (changes.responsibleUserId !== undefined) data.responsibleUserId = changes.responsibleUserId;
    if (changes.identifiedOn !== undefined) data.identifiedOn = changes.identifiedOn;
    if (changes.nextReviewOn !== undefined) data.nextReviewOn = changes.nextReviewOn;

    const result = await this.withScope(scope, { id, version: expectedVersion }, (where) =>
      this.prisma.client.risk.updateMany({ where, data }),
    );

    if (result.count > 0) {
      const updated = await this.findById(scope, id);
      if (!updated) {
        return { outcome: 'NOT_FOUND' };
      }
      return { outcome: 'UPDATED', record: updated };
    }

    const current = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.risk.findFirst({ where, select: { version: true, status: true } }),
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

  async applyAssessmentResult(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: RiskAssessmentUpdateChanges,
  ): Promise<RiskUpdateResult> {
    const data: Prisma.RiskUncheckedUpdateManyInput = {
      version: { increment: 1 },
      currentAssessmentId: changes.currentAssessmentId,
      inherentScore: changes.inherentScore,
      inherentLevel: changes.inherentLevel,
      residualScore: changes.residualScore,
      residualLevel: changes.residualLevel,
      lastAssessedOn: changes.lastAssessedOn,
    };
    if (changes.nextReviewOn !== undefined) {
      data.nextReviewOn = changes.nextReviewOn;
    }

    const result = await this.withScope(scope, { id, version: expectedVersion }, (where) =>
      this.prisma.client.risk.updateMany({ where, data }),
    );

    if (result.count > 0) {
      const updated = await this.findById(scope, id);
      if (!updated) {
        return { outcome: 'NOT_FOUND' };
      }
      return { outcome: 'UPDATED', record: updated };
    }

    const current = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.risk.findFirst({ where, select: { version: true, status: true } }),
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

  async applyTreatmentDecision(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: RiskTreatmentUpdateChanges,
  ): Promise<RiskUpdateResult> {
    return this.conditionalVersionUpdate(scope, id, expectedVersion, {
      version: { increment: 1 },
      currentTreatmentId: changes.currentTreatmentId,
    });
  }

  async touchVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
  ): Promise<RiskUpdateResult> {
    return this.conditionalVersionUpdate(scope, id, expectedVersion, {
      version: { increment: 1 },
    });
  }

  async applyLifecycleTransition(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: RiskLifecycleUpdateChanges,
  ): Promise<RiskUpdateResult> {
    const data: Prisma.RiskUncheckedUpdateManyInput = { version: { increment: 1 } };
    if (changes.status !== undefined) data.status = changes.status;
    if (changes.pendingApprovalId !== undefined) data.pendingApprovalId = changes.pendingApprovalId;
    if (changes.archivedAt !== undefined) data.archivedAt = changes.archivedAt;

    return this.conditionalVersionUpdate(scope, id, expectedVersion, data);
  }

  async replaceCauses(
    riskId: string,
    items: readonly string[],
  ): Promise<readonly RiskStatementRecord[]> {
    await this.prisma.client.riskCause.deleteMany({ where: { riskId } });
    if (items.length > 0) {
      await this.prisma.client.riskCause.createMany({
        data: items.map((description, index) => ({ riskId, description, sortOrder: index })),
      });
    }
    const rows = await this.prisma.client.riskCause.findMany({
      where: { riskId },
      orderBy: { sortOrder: 'asc' },
    });
    return toStatementRecords(rows);
  }

  async replaceConsequences(
    riskId: string,
    items: readonly string[],
  ): Promise<readonly RiskStatementRecord[]> {
    await this.prisma.client.riskConsequence.deleteMany({ where: { riskId } });
    if (items.length > 0) {
      await this.prisma.client.riskConsequence.createMany({
        data: items.map((description, index) => ({ riskId, description, sortOrder: index })),
      });
    }
    const rows = await this.prisma.client.riskConsequence.findMany({
      where: { riskId },
      orderBy: { sortOrder: 'asc' },
    });
    return toStatementRecords(rows);
  }

  private async conditionalVersionUpdate(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    data: Prisma.RiskUncheckedUpdateManyInput,
  ): Promise<RiskUpdateResult> {
    const result = await this.withScope(scope, { id, version: expectedVersion }, (where) =>
      this.prisma.client.risk.updateMany({ where, data }),
    );

    if (result.count > 0) {
      const updated = await this.findById(scope, id);
      if (!updated) {
        return { outcome: 'NOT_FOUND' };
      }
      return { outcome: 'UPDATED', record: updated };
    }

    const current = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.risk.findFirst({ where, select: { version: true, status: true } }),
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

function toReferenceDataRef(
  row: { id: string; code: string; name: string } | null,
): ReferenceDataRefRecord | undefined {
  return row ? { id: row.id, code: row.code, name: row.name } : undefined;
}

function toOrgUnitRef(row: { id: string; code: string; name: string }): OrgUnitRefRecord {
  return { id: row.id, code: row.code, name: row.name };
}

function toUserRef(row: { id: string; fullName: string; email: string }): UserRefRecord {
  return { id: row.id, fullName: row.fullName, email: row.email };
}

function toUserRefOrUndefined(
  row: { id: string; fullName: string; email: string } | null,
): UserRefRecord | undefined {
  return row ? toUserRef(row) : undefined;
}

function toPreviousAssessmentLevels(
  currentAssessment: RiskWithRelations['currentAssessment'],
): Pick<AssessmentRecord, 'inherentLevel' | 'residualLevel'> | undefined {
  const previous = currentAssessment?.previousAssessment;
  return previous
    ? { inherentLevel: previous.inherentLevel, residualLevel: previous.residualLevel }
    : undefined;
}

function toStatementRecords(
  rows: readonly { id: string; description: string; sortOrder: number }[],
): readonly RiskStatementRecord[] {
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    sortOrder: row.sortOrder,
  }));
}

function toRiskRecord(row: RiskWithRelations): RiskRecord {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    status: row.status,
    category: toReferenceDataRef(row.category),
    type: toReferenceDataRef(row.type),
    origin: toReferenceDataRef(row.origin),
    orgUnit: toOrgUnitRef(row.orgUnit),
    owner: toUserRef(row.owner),
    responsible: toUserRefOrUndefined(row.responsible),
    inherentScore: row.inherentScore ?? undefined,
    inherentLevel: row.inherentLevel ?? undefined,
    residualScore: row.residualScore ?? undefined,
    residualLevel: row.residualLevel ?? undefined,
    currentAssessmentId: row.currentAssessmentId ?? undefined,
    currentAssessment: row.currentAssessment
      ? toAssessmentRecord(row.currentAssessment)
      : undefined,
    previousAssessmentLevels: toPreviousAssessmentLevels(row.currentAssessment),
    currentTreatmentId: row.currentTreatmentId ?? undefined,
    identifiedOn: row.identifiedOn,
    lastAssessedOn: row.lastAssessedOn ?? undefined,
    nextReviewOn: row.nextReviewOn ?? undefined,
    pendingApprovalId: row.pendingApprovalId ?? undefined,
    archivedAt: row.archivedAt ?? undefined,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    causes: toStatementRecords(row.causes),
    consequences: toStatementRecords(row.consequences),
  };
}
