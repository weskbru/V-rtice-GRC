/**
 * T088 — `RiskRepository`: the sole Prisma-backed implementation of
 * `RiskRepositoryPort`. Extends `ScopedRepository<Prisma.RiskWhereInput>`
 * (`shared/persistence/scoped-repository.ts`, ADR-004) so every method
 * below is compile-time required to apply the caller's organizational
 * `ScopeFilter` — there is no method on this class that queries `risk`
 * without going through `applyScope`/`withScope` (FR-025).
 *
 * ## `updateWithVersion` — why one `UPDATE ... WHERE id = ? AND version = ?`
 * is race-free with no explicit row lock (ADR-013)
 *
 * `updateMany({ where: { id, version: expectedVersion, ...scope } })` compiles
 * to a single SQL `UPDATE risks SET ..., version = version + 1 WHERE id = $1
 * AND version = $2 AND <scope predicate>`. PostgreSQL's MVCC + row-level
 * locking guarantees that if two concurrent transactions both attempt this
 * statement against the SAME row: whichever commits first wins and bumps
 * `version`; the second transaction's `UPDATE` blocks on the row lock until
 * the first commits, then PostgreSQL re-evaluates the `WHERE` clause against
 * the now-current row (`EvalPlanQual`) — since `version` has already moved
 * on, the second transaction's `version = expectedVersion` predicate no
 * longer matches, so it affects zero rows. `updateMany`'s `{ count }` is
 * exactly this signal: `count === 1` means this call's `expectedVersion` was
 * the winner; `count === 0` means either the row does not exist/is out of
 * scope, or someone else's write already moved `version` past what this
 * caller last read. `updateWithVersion` below distinguishes those two by a
 * follow-up scoped read — see its body. No `SELECT ... FOR UPDATE`, no
 * `SERIALIZABLE` isolation, and no extra lock statement are needed: ordinary
 * `READ COMMITTED` (PostgreSQL's default, unchanged here) already provides
 * this guarantee for a single-statement conditional `UPDATE`.
 */
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

// T126 — the SAME `methodologyVersion`/`assessedByUser` selection
// `RiskAssessmentRepository`'s own `ASSESSMENT_INCLUDE` uses, so
// `toAssessmentRecord` (imported above) can map either payload shape.
// `previousAssessment` is selected ONLY for its two derived levels — see
// `RiskRecord.previousAssessmentLevels`'s doc comment for why a full nested
// `AssessmentRecord` is not needed here.
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
  // T126 — the risk's current assessment, loaded in the SAME query as the
  // rest of the detail read (no separate repository call, no N+1 — see
  // `RiskRecord.currentAssessment`'s doc comment).
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

  /** F-38 — see `RiskRepositoryPort.findOrgUnitIdUnscoped`'s doc comment.
   * One extra indexed-by-PK `SELECT`, paid only by a caller that already
   * knows a scoped lookup just returned nothing. */
  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.risk.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }

  /** Backs `RiskActionOriginAccessor.listOriginIdsInScope` (Fix 1) — a
   * single scoped query, ids only, no relations loaded. */
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
      // Defensive only: a row this same transaction just updated cannot
      // vanish from a `findById` scoped by the same filter a moment later.
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

  /** T124/US4 — see `RiskRepositoryPort.applyAssessmentResult`'s doc
   * comment; the conditional-update mechanism is identical to
   * `updateWithVersion` above, just against a disjoint field set. */
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

  /** T139/US5 — see `RiskRepositoryPort.applyTreatmentDecision`'s doc
   * comment; identical conditional-update mechanism as `updateWithVersion`
   * above, against the disjoint `currentTreatmentId` field. */
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

  /** T140/T142/US5 — see `RiskRepositoryPort.touchVersion`'s doc comment;
   * bumps `version` alone. */
  async touchVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
  ): Promise<RiskUpdateResult> {
    return this.conditionalVersionUpdate(scope, id, expectedVersion, {
      version: { increment: 1 },
    });
  }

  /** T156/T157/US6 — see `RiskRepositoryPort.applyLifecycleTransition`'s
   * doc comment; identical conditional-update mechanism as
   * `updateWithVersion` above, against the disjoint `status`/
   * `pendingApprovalId`/`archivedAt` fields. */
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

  /** T093 — see `RiskRepositoryPort.replaceCauses`'s doc comment. A plain
   * `deleteMany` + `createMany` against the risk-owned child table, both
   * executed against `this.prisma.client`, which resolves to the ambient
   * transaction (`PrismaService.client`'s own doc comment) — so this always
   * runs inside `ReplaceRiskStatementsUseCase`'s transaction, atomically
   * with the `touchVersion` call that follows it. `createMany` is skipped
   * for an empty `items` array (Prisma accepts `data: []`, but skipping is
   * one fewer round trip for the common "clearing the list" case). */
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

  /** T093 — see `RiskRepositoryPort.replaceConsequences`'s doc comment;
   * identical mechanism as `replaceCauses` above, against the disjoint
   * `RiskConsequence` table. */
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

  /** Shared conditional `UPDATE ... WHERE id = ? AND version = ? AND
   * <scope>` mechanism, factored out of `updateWithVersion`/
   * `applyAssessmentResult`/`applyTreatmentDecision`/`touchVersion`/
   * `applyLifecycleTransition` — all differ only in which columns `data`
   * sets; the race-free conditional-update semantics (see this file's
   * header comment) and the "distinguish NOT_FOUND from VERSION_CONFLICT
   * via a follow-up scoped read" logic are identical across every one of
   * them. */
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

/** T126 — extracts the two derived levels from `row.currentAssessment`'s
 * `previousAssessment` relation (see `CURRENT_ASSESSMENT_INCLUDE`'s select),
 * or `undefined` when there is no current assessment or it has no
 * predecessor (FR-066: "null members mean there was no previous
 * assessment"). */
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
