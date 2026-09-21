/**
 * T020/003-controls-management — `ControlRepository`: the sole Prisma-
 * backed implementation of `ControlRepositoryPort`. Extends
 * `ControlScopedRepository` (T017) so every method below is compile-time
 * required to apply the caller's organizational `ScopeFilter` (FR-007) —
 * the same discipline `RiskRepository` establishes for Risk.
 *
 * `effectiveness` is never a stored column (data-model.md §3, FR-012):
 * every method that returns a `ControlRecord` computes it fresh, via the
 * single calculator (`calculateControlEffectiveness`,
 * `domain/control-effectiveness.service.ts`, D-2) fed by
 * `listAssessmentsForEffectiveness`'s own read of `control_assessments` —
 * never a second, hand-rolled rule.
 *
 * ## `updateWithVersion`/`applyLifecycleTransition` — race-free by the
 * same mechanism `RiskRepository` documents
 *
 * A single conditional `UPDATE ... WHERE id = ? AND version = ? AND
 * <scope>` (ADR-013) — see `RiskRepository`'s own header for the full
 * `EvalPlanQual` reasoning this file does not repeat.
 */
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

    // A brand-new control provably has no assessment yet — no query
    // needed to know `effectiveness` is `NOT_ASSESSED` (FR-013), but this
    // still routes through the ONE calculator rather than hard-coding the
    // literal, so a future change to "what counts as no history" cannot
    // diverge between this call site and every other one.
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

  // `findOrgUnitIdUnscoped` is implemented once, on `ControlScopedRepository`
  // (research.md D-11/D-R11) — both this class and `ControlLookupRepository`
  // used to duplicate the identical Prisma query.

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

  /** Shared conditional `UPDATE ... WHERE id = ? AND version = ? AND
   * <scope>` mechanism, factored out of `updateWithVersion`/
   * `applyLifecycleTransition` exactly as `RiskRepository
   * .conditionalVersionUpdate` factors out its own equivalents. */
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
      // Defensive only: a row this same transaction just updated cannot
      // vanish from a `findById` scoped by the same filter a moment later.
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
