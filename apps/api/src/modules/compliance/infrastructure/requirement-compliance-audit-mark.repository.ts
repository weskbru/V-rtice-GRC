import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RequirementComplianceAuditMarkRepositoryPort } from '../domain/ports/requirement-compliance-audit-mark-repository.port';

import type { ComplianceAuditMarkObservation } from '../domain/requirement-compliance-audit-mark.entity';
import type { RequirementComplianceState } from '@prisma/client';

interface InsertedRow {
  readonly requirement_id: string;
}

interface UpdatedRow {
  readonly requirement_id: string;
  readonly previous_state: RequirementComplianceState;
}

@Injectable()
export class RequirementComplianceAuditMarkRepository implements RequirementComplianceAuditMarkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async recordObservation(
    requirementId: string,
    state: RequirementComplianceState,
    observedAt: Date,
  ): Promise<ComplianceAuditMarkObservation> {
    const inserted = await this.prisma.client.$queryRaw<InsertedRow[]>(Prisma.sql`
      INSERT INTO "requirement_compliance_audit_marks" ("requirement_id", "last_audited_state", "last_audited_at")
      VALUES (${requirementId}::uuid, ${state}::"RequirementComplianceState", ${observedAt})
      ON CONFLICT ("requirement_id") DO NOTHING
      RETURNING "requirement_id"
    `);
    if (inserted.length > 0) {
      return { outcome: 'CREATED' };
    }

    const updated = await this.prisma.client.$queryRaw<UpdatedRow[]>(Prisma.sql`
      WITH "old" AS (
        SELECT "last_audited_state" FROM "requirement_compliance_audit_marks"
        WHERE "requirement_id" = ${requirementId}::uuid
      )
      UPDATE "requirement_compliance_audit_marks"
      SET "last_audited_state" = ${state}::"RequirementComplianceState", "last_audited_at" = ${observedAt}
      WHERE "requirement_id" = ${requirementId}::uuid
        AND "last_audited_state" IS DISTINCT FROM ${state}::"RequirementComplianceState"
      RETURNING
        "requirement_id",
        (SELECT "last_audited_state" FROM "old") AS "previous_state"
    `);
    if (updated.length === 0) {
      return { outcome: 'UNCHANGED' };
    }
    return { outcome: 'CHANGED', previousState: updated[0]!.previous_state };
  }

  async recordObservations(
    entries: readonly {
      readonly requirementId: string;
      readonly state: RequirementComplianceState;
    }[],
    observedAt: Date,
  ): Promise<ReadonlyMap<string, ComplianceAuditMarkObservation>> {
    const results = new Map<string, ComplianceAuditMarkObservation>();
    if (entries.length === 0) {
      return results;
    }

    const insertValues = Prisma.join(
      entries.map(
        (entry) =>
          Prisma.sql`(${entry.requirementId}::uuid, ${entry.state}::"RequirementComplianceState")`,
      ),
    );
    const inserted = await this.prisma.client.$queryRaw<InsertedRow[]>(Prisma.sql`
      INSERT INTO "requirement_compliance_audit_marks" ("requirement_id", "last_audited_state", "last_audited_at")
      SELECT "v"."requirement_id", "v"."new_state", ${observedAt}
      FROM (VALUES ${insertValues}) AS "v"("requirement_id", "new_state")
      ON CONFLICT ("requirement_id") DO NOTHING
      RETURNING "requirement_id"
    `);
    for (const row of inserted) {
      results.set(row.requirement_id, { outcome: 'CREATED' });
    }

    const remaining = entries.filter((entry) => !results.has(entry.requirementId));
    if (remaining.length > 0) {
      const updateValues = Prisma.join(
        remaining.map(
          (entry) =>
            Prisma.sql`(${entry.requirementId}::uuid, ${entry.state}::"RequirementComplianceState")`,
        ),
      );
      const updated = await this.prisma.client.$queryRaw<UpdatedRow[]>(Prisma.sql`
        WITH "input"("requirement_id", "new_state") AS (VALUES ${updateValues}),
        "old" AS (
          SELECT "m"."requirement_id", "m"."last_audited_state" AS "previous_state"
          FROM "requirement_compliance_audit_marks" "m"
          JOIN "input" "i" ON "i"."requirement_id" = "m"."requirement_id"
        )
        UPDATE "requirement_compliance_audit_marks" "m"
        SET "last_audited_state" = "i"."new_state", "last_audited_at" = ${observedAt}
        FROM "input" "i"
        WHERE "m"."requirement_id" = "i"."requirement_id"
          AND "m"."last_audited_state" IS DISTINCT FROM "i"."new_state"
        RETURNING
          "m"."requirement_id" AS "requirement_id",
          (SELECT "o"."previous_state" FROM "old" "o" WHERE "o"."requirement_id" = "m"."requirement_id") AS "previous_state"
      `);
      for (const row of updated) {
        results.set(row.requirement_id, { outcome: 'CHANGED', previousState: row.previous_state });
      }
      for (const entry of remaining) {
        if (!results.has(entry.requirementId)) {
          results.set(entry.requirementId, { outcome: 'UNCHANGED' });
        }
      }
    }

    return results;
  }
}
