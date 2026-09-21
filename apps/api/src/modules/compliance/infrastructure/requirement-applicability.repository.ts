/**
 * T045/004-compliance-management, User Story 3 —
 * `RequirementApplicabilityRepository`: the sole Prisma-backed
 * implementation of `RequirementApplicabilityRepositoryPort`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  RequirementApplicabilityRepositoryPort,
  type ApplicabilityDeclarationListPage,
} from '../domain/ports/requirement-applicability-repository.port';

import type { RequirementApplicabilityDeclarationRecord } from '../domain/requirement-applicability-declaration.entity';
import type { Prisma } from '@prisma/client';

const DECLARATION_INCLUDE = {
  declaredByUser: { select: { id: true, fullName: true, email: true } },
  revokedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RequirementApplicabilityDeclarationInclude;

type DeclarationWithRelations = Prisma.RequirementApplicabilityDeclarationGetPayload<{
  include: typeof DECLARATION_INCLUDE;
}>;

@Injectable()
export class RequirementApplicabilityRepository implements RequirementApplicabilityRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(
    requirementId: string,
  ): Promise<RequirementApplicabilityDeclarationRecord | undefined> {
    const row = await this.prisma.client.requirementApplicabilityDeclaration.findFirst({
      where: { requirementId, revokedAt: null },
      include: DECLARATION_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    requirementId: string,
    justification: string,
    declaredByUserId: string,
    declaredAt: Date,
  ): Promise<RequirementApplicabilityDeclarationRecord> {
    const created = await this.prisma.client.requirementApplicabilityDeclaration.create({
      data: { requirementId, justification, declaredByUserId, declaredAt },
      include: DECLARATION_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(
    requirementId: string,
    declarationId: string,
  ): Promise<RequirementApplicabilityDeclarationRecord | undefined> {
    const row = await this.prisma.client.requirementApplicabilityDeclaration.findFirst({
      where: { id: declarationId, requirementId },
      include: DECLARATION_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async revoke(
    declarationId: string,
    revokedByUserId: string,
    revokedAt: Date,
  ): Promise<RequirementApplicabilityDeclarationRecord> {
    const updated = await this.prisma.client.requirementApplicabilityDeclaration.update({
      where: { id: declarationId },
      data: { revokedByUserId, revokedAt },
      include: DECLARATION_INCLUDE,
    });
    return toRecord(updated);
  }

  async list(
    requirementId: string,
    page: number,
    pageSize: number,
  ): Promise<ApplicabilityDeclarationListPage> {
    const where: Prisma.RequirementApplicabilityDeclarationWhereInput = { requirementId };
    const [rows, total] = await Promise.all([
      this.prisma.client.requirementApplicabilityDeclaration.findMany({
        where,
        include: DECLARATION_INCLUDE,
        orderBy: { declaredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.requirementApplicabilityDeclaration.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  }
}

function toRecord(row: DeclarationWithRelations): RequirementApplicabilityDeclarationRecord {
  return {
    id: row.id,
    requirementId: row.requirementId,
    justification: row.justification,
    declaredBy: row.declaredByUser,
    declaredAt: row.declaredAt,
    revokedBy: row.revokedByUser ?? undefined,
    revokedAt: row.revokedAt ?? undefined,
  };
}
