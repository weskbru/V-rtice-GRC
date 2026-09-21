/**
 * T026/004-compliance-management — `RequirementRepository`: the sole
 * Prisma-backed implementation of `RequirementRepositoryPort`. No
 * `ScopeFilter` anywhere (research.md D-2).
 *
 * `updateWithVersion` additionally guards against the narrow race
 * research.md D-4 accepts: the parent version publishing between the use
 * case's own `isRequirementEditable` check and this call. The
 * `requirements_immutable_after_publish` trigger (T006) would reject the
 * underlying `UPDATE` in that case — this method catches exactly that
 * Postgres error (by its `RAISE EXCEPTION` message, the only signal a
 * trigger-raised error carries) and reports it as a version conflict
 * rather than letting a raw database error escape to the client. This is
 * deliberately NOT the guarantee `requirement-immutability-trigger.spec.ts`
 * (T028) tests — that test proves the trigger fires when the ENTIRE
 * application layer, including this catch, is bypassed via raw SQL. This
 * catch is defense in depth for the ordinary HTTP path, tested by
 * `update-requirement-refused-after-publish.spec.ts` (T029) only via the
 * use case's own pre-check (the common path), not via forcing this race.
 */
import { Injectable } from '@nestjs/common';
import { Prisma as PrismaRuntime } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  RequirementRepositoryPort,
  type CreateRequirementInput,
  type RequirementApplicabilityRef,
  type RequirementListPage,
  type RequirementRow,
  type RequirementUpdateResult,
  type UpdateRequirementChanges,
} from '../domain/ports/requirement-repository.port';

import type { Prisma } from '@prisma/client';

const REQUIREMENT_INCLUDE = {
  frameworkVersion: { select: { id: true, label: true, status: true } },
} satisfies Prisma.RequirementInclude;

type RequirementWithRelations = Prisma.RequirementGetPayload<{
  include: typeof REQUIREMENT_INCLUDE;
}>;

/** The trigger's own `RAISE EXCEPTION` message prefix
 * (`20260908100600_compliance_requirement_immutability_trigger/migration.sql`)
 * — matched narrowly so this catch never swallows an unrelated database
 * error. */
const IMMUTABILITY_TRIGGER_MESSAGE_FRAGMENT = 'is immutable';

@Injectable()
export class RequirementRepository implements RequirementRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateRequirementInput): Promise<RequirementRow> {
    const created = await this.prisma.client.requirement.create({
      data: {
        frameworkVersionId: input.frameworkVersionId,
        externalRef: input.externalRef,
        title: input.title,
        description: input.description,
        createdByUserId: input.createdByUserId,
      },
      include: REQUIREMENT_INCLUDE,
    });
    return toRequirementRow(created);
  }

  async findById(id: string): Promise<RequirementRow | undefined> {
    const row = await this.prisma.client.requirement.findUnique({
      where: { id },
      include: REQUIREMENT_INCLUDE,
    });
    return row ? toRequirementRow(row) : undefined;
  }

  async list(
    frameworkVersionId: string,
    page: number,
    pageSize: number,
  ): Promise<RequirementListPage> {
    const where: Prisma.RequirementWhereInput = { frameworkVersionId };
    const [rows, total] = await Promise.all([
      this.prisma.client.requirement.findMany({
        where,
        include: REQUIREMENT_INCLUDE,
        orderBy: { externalRef: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.requirement.count({ where }),
    ]);
    return { items: rows.map(toRequirementRow), total };
  }

  async findAllByFrameworkVersion(frameworkVersionId: string): Promise<readonly RequirementRow[]> {
    const rows = await this.prisma.client.requirement.findMany({
      where: { frameworkVersionId },
      include: REQUIREMENT_INCLUDE,
      orderBy: { externalRef: 'asc' },
    });
    return rows.map(toRequirementRow);
  }

  async updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: UpdateRequirementChanges,
  ): Promise<RequirementUpdateResult> {
    const data: Prisma.RequirementUncheckedUpdateManyInput = { version: { increment: 1 } };
    if (changes.externalRef !== undefined) data.externalRef = changes.externalRef;
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) data.description = changes.description;

    let result: Prisma.BatchPayload;
    try {
      result = await this.prisma.client.requirement.updateMany({
        where: { id, version: expectedVersion },
        data,
      });
    } catch (error) {
      if (isImmutabilityTriggerRejection(error)) {
        const current = await this.prisma.client.requirement.findUnique({
          where: { id },
          select: { version: true },
        });
        return { outcome: 'VERSION_CONFLICT', currentVersion: current?.version ?? expectedVersion };
      }
      throw error;
    }

    if (result.count > 0) {
      const updated = await this.findById(id);
      if (!updated) {
        return { outcome: 'NOT_FOUND' };
      }
      return { outcome: 'UPDATED', row: updated };
    }

    const current = await this.prisma.client.requirement.findUnique({
      where: { id },
      select: { version: true },
    });
    if (!current) {
      return { outcome: 'NOT_FOUND' };
    }
    return { outcome: 'VERSION_CONFLICT', currentVersion: current.version };
  }

  async findActiveApplicability(
    requirementId: string,
  ): Promise<RequirementApplicabilityRef | undefined> {
    const row = await this.prisma.client.requirementApplicabilityDeclaration.findFirst({
      where: { requirementId, revokedAt: null },
      select: {
        id: true,
        justification: true,
        declaredAt: true,
        declaredByUser: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      justification: row.justification,
      declaredBy: row.declaredByUser,
      declaredAt: row.declaredAt,
    };
  }

  async findActiveApplicabilityMany(
    requirementIds: readonly string[],
  ): Promise<ReadonlyMap<string, RequirementApplicabilityRef>> {
    if (requirementIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.client.requirementApplicabilityDeclaration.findMany({
      where: { requirementId: { in: Array.from(requirementIds) }, revokedAt: null },
      select: {
        requirementId: true,
        id: true,
        justification: true,
        declaredAt: true,
        declaredByUser: { select: { id: true, fullName: true, email: true } },
      },
    });
    return new Map(
      rows.map((row) => [
        row.requirementId,
        {
          id: row.id,
          justification: row.justification,
          declaredBy: row.declaredByUser,
          declaredAt: row.declaredAt,
        },
      ]),
    );
  }

  async findActiveLinkedControlIds(requirementId: string): Promise<readonly string[]> {
    const rows = await this.prisma.client.requirementControlLink.findMany({
      where: { requirementId, unlinkedAt: null },
      select: { controlId: true },
    });
    return rows.map((row) => row.controlId);
  }

  async findActiveLinkedControlIdsMany(
    requirementIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    if (requirementIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.client.requirementControlLink.findMany({
      where: { requirementId: { in: Array.from(requirementIds) }, unlinkedAt: null },
      select: { requirementId: true, controlId: true },
    });
    const byRequirement = new Map<string, string[]>();
    for (const row of rows) {
      const existing = byRequirement.get(row.requirementId);
      if (existing) {
        existing.push(row.controlId);
      } else {
        byRequirement.set(row.requirementId, [row.controlId]);
      }
    }
    return byRequirement;
  }
}

function isImmutabilityTriggerRejection(error: unknown): boolean {
  return (
    error instanceof PrismaRuntime.PrismaClientUnknownRequestError &&
    error.message.includes(IMMUTABILITY_TRIGGER_MESSAGE_FRAGMENT)
  );
}

function toRequirementRow(row: RequirementWithRelations): RequirementRow {
  return {
    id: row.id,
    frameworkVersion: row.frameworkVersion,
    externalRef: row.externalRef,
    title: row.title,
    description: row.description,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
