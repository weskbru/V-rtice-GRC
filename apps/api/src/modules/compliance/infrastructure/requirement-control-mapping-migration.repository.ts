/**
 * T036/004-compliance-management, User Story 2 — the sole Prisma-backed
 * implementation of `RequirementControlMappingMigrationRepositoryPort`.
 * `create` writes the migration row, every item row and every `COPIED`
 * item's new `RequirementControlLink` rows in one call — always invoked
 * from inside `ExecuteMappingMigrationUseCase`'s own
 * `transactionRunner.run(...)` scope (ADR-005), so every write below and
 * the use case's own single `REQUIREMENT_CONTROL_MAPPING_MIGRATION` audit
 * event land in one transaction (SC-004: the whole execution is atomic).
 *
 * `RequirementControlMappingMigrationItem.sourceRequirementIds` is a plain
 * `uuid[]` column, not an FK set (schema's own doc comment — a snapshot,
 * not a live relation, mirroring `RiskAssessment.controlsConsidered`), so
 * resolving each item's `sourceRequirements` refs for the detail view
 * needs one extra batch `Requirement` lookup keyed by the union of every
 * id across every item — never one query per item.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  RequirementControlMappingMigrationRepositoryPort,
  type CreateMappingMigrationInput,
  type MappingMigrationListPage,
} from '../domain/ports/requirement-control-mapping-migration-repository.port';

import type {
  MappingMigrationDetailRecord,
  MappingMigrationItemRecord,
  MappingMigrationRequirementRef,
  MappingMigrationSummaryRecord,
} from '../domain/requirement-control-mapping-migration.entity';
import type { Prisma } from '@prisma/client';

const SUMMARY_INCLUDE = {
  sourceFrameworkVersion: { select: { id: true, label: true, status: true } },
  targetFrameworkVersion: { select: { id: true, label: true, status: true } },
  executedByUser: { select: { id: true, fullName: true, email: true } },
  items: { select: { outcome: true } },
} satisfies Prisma.RequirementControlMappingMigrationInclude;

const DETAIL_INCLUDE = {
  sourceFrameworkVersion: { select: { id: true, label: true, status: true } },
  targetFrameworkVersion: { select: { id: true, label: true, status: true } },
  executedByUser: { select: { id: true, fullName: true, email: true } },
  items: {
    include: {
      targetRequirement: { select: { id: true, externalRef: true, title: true } },
    },
  },
} satisfies Prisma.RequirementControlMappingMigrationInclude;

type SummaryWithRelations = Prisma.RequirementControlMappingMigrationGetPayload<{
  include: typeof SUMMARY_INCLUDE;
}>;

type DetailWithRelations = Prisma.RequirementControlMappingMigrationGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

@Injectable()
export class RequirementControlMappingMigrationRepository implements RequirementControlMappingMigrationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateMappingMigrationInput): Promise<MappingMigrationDetailRecord> {
    const migration = await this.prisma.client.requirementControlMappingMigration.create({
      data: {
        frameworkId: input.frameworkId,
        sourceFrameworkVersionId: input.sourceFrameworkVersionId,
        targetFrameworkVersionId: input.targetFrameworkVersionId,
        executedByUserId: input.executedByUserId,
        executedAt: input.executedAt,
        items: {
          create: input.items.map((item) => ({
            targetRequirementId: item.targetRequirementId,
            sourceRequirementIds: Array.from(item.sourceRequirementIds),
            outcome: item.outcome,
            copiedLinkCount: item.controlIdsToLink.length,
          })),
        },
      },
    });

    // One `RequirementControlLink` row per `COPIED` item's resolved
    // control — no per-link audit event (SC-004: the migration's own
    // single event, recorded by the use case, covers all of them).
    const linkRows: Prisma.RequirementControlLinkCreateManyInput[] = input.items.flatMap((item) =>
      item.controlIdsToLink.map((controlId) => ({
        requirementId: item.targetRequirementId,
        controlId,
        linkedByUserId: input.executedByUserId,
        linkedAt: input.executedAt,
      })),
    );
    if (linkRows.length > 0) {
      await this.prisma.client.requirementControlLink.createMany({ data: linkRows });
    }

    const detail = await this.prisma.client.requirementControlMappingMigration.findUniqueOrThrow({
      where: { id: migration.id },
      include: DETAIL_INCLUDE,
    });
    return this.toDetailRecord(detail);
  }

  async findById(
    targetFrameworkVersionId: string,
    migrationId: string,
  ): Promise<MappingMigrationDetailRecord | undefined> {
    const row = await this.prisma.client.requirementControlMappingMigration.findFirst({
      where: { id: migrationId, targetFrameworkVersionId },
      include: DETAIL_INCLUDE,
    });
    return row ? this.toDetailRecord(row) : undefined;
  }

  async list(
    targetFrameworkVersionId: string,
    page: number,
    pageSize: number,
  ): Promise<MappingMigrationListPage> {
    const where: Prisma.RequirementControlMappingMigrationWhereInput = { targetFrameworkVersionId };
    const [rows, total] = await Promise.all([
      this.prisma.client.requirementControlMappingMigration.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: { executedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.requirementControlMappingMigration.count({ where }),
    ]);
    return { items: rows.map(toSummaryRecord), total };
  }

  private async toDetailRecord(row: DetailWithRelations): Promise<MappingMigrationDetailRecord> {
    const allSourceIds = Array.from(
      new Set(row.items.flatMap((item) => item.sourceRequirementIds)),
    );
    const sourceRequirements =
      allSourceIds.length > 0
        ? await this.prisma.client.requirement.findMany({
            where: { id: { in: allSourceIds } },
            select: { id: true, externalRef: true, title: true },
          })
        : [];
    const sourceById = new Map<string, MappingMigrationRequirementRef>(
      sourceRequirements.map((requirement) => [requirement.id, requirement]),
    );

    const items: MappingMigrationItemRecord[] = row.items.map((item) => ({
      targetRequirement: item.targetRequirement,
      sourceRequirements: item.sourceRequirementIds
        .map((id) => sourceById.get(id))
        .filter((ref): ref is MappingMigrationRequirementRef => ref !== undefined),
      outcome: item.outcome,
      copiedLinkCount: item.copiedLinkCount,
    }));

    return {
      id: row.id,
      sourceFrameworkVersion: row.sourceFrameworkVersion,
      targetFrameworkVersion: row.targetFrameworkVersion,
      executedBy: row.executedByUser,
      executedAt: row.executedAt,
      itemCount: row.items.length,
      copiedCount: row.items.filter((item) => item.outcome === 'COPIED').length,
      pendingDecisionCount: row.items.filter((item) => item.outcome === 'PENDING_DECISION').length,
      skippedAlreadyMappedCount: row.items.filter(
        (item) => item.outcome === 'SKIPPED_ALREADY_MAPPED',
      ).length,
      items,
    };
  }
}

function toSummaryRecord(row: SummaryWithRelations): MappingMigrationSummaryRecord {
  return {
    id: row.id,
    sourceFrameworkVersion: row.sourceFrameworkVersion,
    targetFrameworkVersion: row.targetFrameworkVersion,
    executedBy: row.executedByUser,
    executedAt: row.executedAt,
    itemCount: row.items.length,
    copiedCount: row.items.filter((item) => item.outcome === 'COPIED').length,
    pendingDecisionCount: row.items.filter((item) => item.outcome === 'PENDING_DECISION').length,
    skippedAlreadyMappedCount: row.items.filter((item) => item.outcome === 'SKIPPED_ALREADY_MAPPED')
      .length,
  };
}
