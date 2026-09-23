import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { calculateControlEffectiveness } from '../domain/control-effectiveness.service';
import { ControlRepositoryPort } from '../domain/ports/control-repository.port';

import { ControlScopedRepository } from './control-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ControlAssessmentForEffectiveness } from '../domain/control-effectiveness.service';
import type {
  ApplyControlTransitionChanges,
  ControlOrgUnitRefRecord,
  ControlRecord,
  ControlUpdateResult,
  ControlUserRefRecord,
  CreateControlRecordInput,
  UpdateControlChanges,
} from '../domain/ports/control-repository.port';
import type { Prisma } from '@prisma/client';

const CONTROL_INCLUDE = {
  orgUnit: { select: { id: true, code: true, name: true } },
  owner: { select: { id: true, fullName: true, email: true } },
  retiredByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ControlInclude;

type ControlWithRelations = Prisma.ControlGetPayload<{ include: typeof CONTROL_INCLUDE }>;

@Injectable()
export class ControlRepository extends ControlScopedRepository implements ControlRepositoryPort {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(input: CreateControlRecordInput, referenceDate: Date): Promise<ControlRecord> {
    const created = await this.prisma.client.control.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        orgUnitId: input.orgUnitId,
        ownerUserId: input.ownerUserId ?? null,
        nature: input.nature ?? null,
        type: input.type ?? null,
        frequency: input.frequency ?? null,
      },
      include: CONTROL_INCLUDE,
    });

    return toControlRecord(
      created,
      calculateControlEffectiveness([], created.frequency, referenceDate),
    );
  }

  async findById(
    scope: ScopeFilter,
    id: string,
    referenceDate: Date,
  ): Promise<ControlRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.control.findFirst({ where, include: CONTROL_INCLUDE }),
    );
    if (!row) {
      return undefined;
    }

    const assessments = await this.listAssessmentsForEffectiveness(id);
    return toControlRecord(
      row,
      calculateControlEffectiveness(assessments, row.frequency, referenceDate),
    );
  }

  async updateWithVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: UpdateControlChanges,
    referenceDate: Date,
  ): Promise<ControlUpdateResult> {
    const data: Prisma.ControlUncheckedUpdateManyInput = { version: { increment: 1 } };

    if (changes.name !== undefined) data.name = changes.name;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.orgUnitId !== undefined) data.orgUnitId = changes.orgUnitId;
    if (changes.ownerUserId !== undefined) data.ownerUserId = changes.ownerUserId;
    if (changes.nature !== undefined) data.nature = changes.nature;
    if (changes.type !== undefined) data.type = changes.type;
    if (changes.frequency !== undefined) data.frequency = changes.frequency;

    return this.conditionalVersionUpdate(scope, id, expectedVersion, data, referenceDate);
  }

  async applyLifecycleTransition(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: ApplyControlTransitionChanges,
    referenceDate: Date,
  ): Promise<ControlUpdateResult> {
    const data: Prisma.ControlUncheckedUpdateManyInput = {
      version: { increment: 1 },
      status: changes.status,
      isActive: changes.isActive,
    };
    if (changes.retiredAt !== undefined) data.retiredAt = changes.retiredAt;
    if (changes.retiredByUserId !== undefined) data.retiredByUserId = changes.retiredByUserId;
    if (changes.retirementReason !== undefined) data.retirementReason = changes.retirementReason;

    return this.conditionalVersionUpdate(scope, id, expectedVersion, data, referenceDate);
  }

  async listAssessmentsForEffectiveness(
    controlId: string,
  ): Promise<readonly ControlAssessmentForEffectiveness[]> {
    const rows = await this.prisma.client.controlAssessment.findMany({
      where: { controlId },
      select: { assessedOn: true, createdAt: true, result: true, attestedAt: true },
    });
    return rows.map((row) => ({
      assessedOn: row.assessedOn,
      createdAt: row.createdAt,
      result: row.result,
      attestedAt: row.attestedAt,
    }));
  }

  private async conditionalVersionUpdate(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    data: Prisma.ControlUncheckedUpdateManyInput,
    referenceDate: Date,
  ): Promise<ControlUpdateResult> {
    const result = await this.withScope(scope, { id, version: expectedVersion }, (where) =>
      this.prisma.client.control.updateMany({ where, data }),
    );

    if (result.count > 0) {
      const updated = await this.findById(scope, id, referenceDate);
      if (!updated) {
        return { outcome: 'NOT_FOUND' };
      }
      return { outcome: 'UPDATED', record: updated };
    }

    const current = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.control.findFirst({ where, select: { version: true, status: true } }),
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

function toRef(row: { id: string; fullName: string; email: string }): ControlUserRefRecord {
  return { id: row.id, fullName: row.fullName, email: row.email };
}

function toRefOrUndefined(
  row: { id: string; fullName: string; email: string } | null,
): ControlUserRefRecord | undefined {
  return row ? toRef(row) : undefined;
}

function toOrgUnitRef(
  row: { id: string; code: string; name: string } | null,
): ControlOrgUnitRefRecord | null {
  return row ? { id: row.id, code: row.code, name: row.name } : null;
}

function toControlRecord(
  row: ControlWithRelations,
  effectiveness: ControlRecord['effectiveness'],
): ControlRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    orgUnit: toOrgUnitRef(row.orgUnit),
    owner: toRefOrUndefined(row.owner),
    nature: row.nature ?? undefined,
    type: row.type ?? undefined,
    frequency: row.frequency ?? undefined,
    status: row.status,
    effectiveness,
    retiredAt: row.retiredAt ?? undefined,
    retiredBy: toRefOrUndefined(row.retiredByUser),
    retirementReason: row.retirementReason ?? undefined,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
