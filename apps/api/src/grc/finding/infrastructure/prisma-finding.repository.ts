/**
 * T069/002-shared-grc-foundation, US3 — `PrismaFindingRepository`, the
 * sole implementation of `FindingRepositoryPort`. Extends
 * `FindingScopedRepository` (T013), which fixes `applyScope`/`withScope`
 * to `orgUnitId` — every scoped method below is compile-time required to
 * thread the caller's `ScopeFilter` through it (FR-031/FR-032).
 *
 * ## Reading `actions`/`evidence_links` directly — not a boundary violation
 *
 * `openActionCount`, `evidenceCount` and
 * `findCompletedLinkedActionResponsibles` all query the `actions`/
 * `evidence_links` tables directly via the SAME `PrismaService` client
 * this repository already holds. This is NOT `grc/finding` depending on
 * `grc/action`'s or `grc/evidence`'s domain ports — no import of either
 * capability's `*.repository.port.ts` appears anywhere in this file. It is
 * exactly the same kind of "infrastructure layer reads a sibling table it
 * does not own the domain meaning of" access
 * `EvidenceLinkVisibilityService`'s own header describes as the accepted
 * cost of `R-001`'s no-FK design: since `Action.originId`/
 * `EvidenceLink.subjectId` carry no foreign key at all (grc's own
 * capabilities cannot reference each other by FK any more than they can
 * reference `modules/**`), the ONLY way to answer "how many actions/how
 * much evidence does THIS finding have" is a plain `WHERE originType =
 * 'FINDING' AND originId = :id` / `WHERE subjectType = 'FINDING' AND
 * subjectId = :id` query against the shared table — there is no port to
 * put this behind that would not simply be this same query relocated.
 * `eslint-plugin-boundaries` (ADR-016) enforces the FOUR real rules (core
 * -> grc forbidden, grc -> modules forbidden, and the two inward-layering
 * rules) at the TypeScript-import level; a `Prisma.action.count(...)` call
 * against the platform's one shared database is not a TypeScript import of
 * `grc/action/**` at all.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { OVERDUE_ELIGIBLE_ACTION_STATUSES } from '../../shared/domain/overdue.service';

import { FindingScopedRepository } from './finding-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  CloseFindingChanges,
  CreateFindingRecordInput,
  FindingListFilter,
  FindingPageResult,
  FindingRecord,
  FindingRepositoryPort,
  UpdateFindingChanges,
} from '../domain/ports/finding-repository.port';
import type { ActionStatus, Prisma } from '@prisma/client';

const FINDING_INCLUDE = {
  orgUnit: { select: { id: true, name: true } },
  ownerUser: { select: { id: true, fullName: true } },
} satisfies Prisma.FindingInclude;

type FindingWithRelations = Prisma.FindingGetPayload<{ include: typeof FINDING_INCLUDE }>;

/** `Action` statuses that count toward `Finding.openActionCount`
 * (contracts/grc-foundation.openapi.yaml).
 *
 * Coordinator correction, 007-implementation-remediation, Frente A: this
 * used to be its OWN local literal, documented as "the same pair" as
 * `grc/shared/domain/overdue.service.ts`'s overdue-eligible set rather than
 * imported from it — exactly the "twin nobody forces to agree" shape the
 * front's consolidation exists to remove. On inspection this is genuinely
 * the SAME set, not a coincidence: `OVERDUE_ELIGIBLE_ACTION_STATUSES` is,
 * by that file's own header, precisely the complement of `Action`'s two
 * TERMINAL statuses (`COMPLETED`, `CANCELLED` — data-model.md §4's
 * transition table) — i.e. "not yet finished". `openActionCount` counts
 * "how many of this finding's linked actions are not yet finished", the
 * IDENTICAL question the overdue rule's status half asks, before that rule
 * ALSO requires a past due date. So this is not a second rule that
 * happens to match today; it is the same "still open" concept, consumed
 * two different ways (bare count here, `AND dueOn < today` there) — this
 * alias exists only to keep this file's own call sites reading a locally
 * meaningful name, never to fork the value. If a future status is ever
 * non-terminal but deliberately excluded from OVERDUE eligibility, that
 * would be the moment this alias needs to become its own array again —
 * make that split here, deliberately, rather than letting this comment go
 * stale. */
const OPEN_ACTION_STATUSES: readonly ActionStatus[] = OVERDUE_ELIGIBLE_ACTION_STATUSES;

@Injectable()
export class PrismaFindingRepository
  extends FindingScopedRepository
  implements FindingRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateFindingRecordInput): Promise<FindingRecord> {
    const created = await this.prisma.client.finding.create({
      data: {
        code: input.code,
        orgUnitId: input.orgUnitId,
        title: input.title,
        description: input.description,
        recommendation: input.recommendation ?? null,
        category: input.category,
        origin: input.origin,
        severity: input.severity,
        priority: input.priority,
        ownerUserId: input.ownerUserId,
        identifiedOn: input.identifiedOn,
        // T089/005-audit-findings — `undefined` (the manual path's own
        // default) becomes `null`, never a foreign key to a nonexistent row.
        auditEngagementId: input.auditEngagementId ?? null,
      },
      include: FINDING_INCLUDE,
    });
    return this.toFindingRecord(created);
  }

  async findById(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.findFirst({ where, include: FINDING_INCLUDE }),
    );
    return row ? this.toFindingRecord(row) : undefined;
  }

  /** F-38 — see `FindingRepositoryPort.findOrgUnitIdUnscoped`'s doc
   * comment. One extra indexed-by-PK `SELECT`, paid only by a caller that
   * already knows a scoped lookup just returned nothing. */
  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.finding.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }

  /** Backs `FindingActionOriginAccessor.listOriginIdsInScope` (Fix 1) — a
   * single scoped query, ids only, no relations loaded. */
  async listIdsInScope(scope: ScopeFilter): Promise<readonly string[]> {
    const rows = await this.withScope(scope, {}, (where) =>
      this.prisma.client.finding.findMany({ where, select: { id: true } }),
    );
    return rows.map((row) => row.id);
  }

  async update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateFindingChanges,
  ): Promise<FindingRecord | undefined> {
    const data: Prisma.FindingUncheckedUpdateManyInput = {};
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.recommendation !== undefined) data.recommendation = changes.recommendation;
    if (changes.category !== undefined) data.category = changes.category;
    if (changes.severity !== undefined) data.severity = changes.severity;
    if (changes.priority !== undefined) data.priority = changes.priority;
    if (changes.ownerUserId !== undefined) data.ownerUserId = changes.ownerUserId;

    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.updateMany({ where, data }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async close(
    scope: ScopeFilter,
    id: string,
    changes: CloseFindingChanges,
  ): Promise<FindingRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.updateMany({
        where,
        data: {
          status: 'CLOSED',
          closedAt: changes.closedAt,
          closedByUserId: changes.closedByUserId,
          closureJustification: changes.closureJustification,
        },
      }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async reopen(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.updateMany({
        where,
        data: {
          status: 'IN_REMEDIATION',
          closedAt: null,
          closedByUserId: null,
          closureJustification: null,
        },
      }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  /** T047/005-audit-findings — see `FindingRepositoryPort.startRemediation`'s
   * own doc comment: only `status` changes, coming from `OPEN`. */
  async startRemediation(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.updateMany({
        where,
        data: { status: 'IN_REMEDIATION' },
      }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async archive(
    scope: ScopeFilter,
    id: string,
    archivedByUserId: string,
    archivedAt: Date,
  ): Promise<FindingRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.updateMany({
        where,
        data: { status: 'ARCHIVED', archivedAt, archivedByUserId },
      }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async findCompletedLinkedActionResponsibles(findingId: string): Promise<readonly string[]> {
    const rows = await this.prisma.client.action.findMany({
      where: { originType: 'FINDING', originId: findingId, status: 'COMPLETED' },
      select: { responsibleUserId: true },
    });
    return rows.map((row) => row.responsibleUserId);
  }

  async list(
    scope: ScopeFilter,
    filter: FindingListFilter,
    page: number,
    pageSize: number,
  ): Promise<FindingPageResult> {
    const where: Prisma.FindingWhereInput = {};
    if (filter.severity !== undefined) where.severity = filter.severity;
    if (filter.ownerUserId !== undefined) where.ownerUserId = filter.ownerUserId;
    if (filter.orgUnitId !== undefined) where.orgUnitId = filter.orgUnitId;
    // T043/005-audit-findings — `listAuditEngagementFindings`'s own filter
    // (`ListAuditEngagementFindingsUseCase`, `modules/audit-engagements`).
    if (filter.auditEngagementId !== undefined) where.auditEngagementId = filter.auditEngagementId;

    if (filter.withoutRemediation) {
      // SC-010's "achados sem remediação": OPEN findings with no `Action`
      // at all pointing back at them. Two indexed queries rather than one
      // raw `NOT EXISTS` — first the (small, indexed-on-`originType`)
      // set of every `originId` an ACTION has ever named for `FINDING`,
      // then `id NOT IN (...)` on `findings` itself. `status` here is
      // ALWAYS `OPEN` regardless of `filter.status` — the contract's own
      // description ("Open findings with no linked action") makes
      // `withoutRemediation` and `status` express the SAME axis, so the
      // two are combined with AND rather than one silently overriding the
      // other, matching `PrismaActionRepository.list`'s own documented
      // "never one filter silently overriding another" convention.
      const originsWithActions = await this.prisma.client.action.findMany({
        where: { originType: 'FINDING' },
        select: { originId: true },
        distinct: ['originId'],
      });
      where.status = filter.status !== undefined && filter.status !== 'OPEN' ? { in: [] } : 'OPEN';
      if (originsWithActions.length > 0) {
        where.id = { notIn: originsWithActions.map((row) => row.originId) };
      }
    } else if (filter.status !== undefined) {
      where.status = filter.status;
    }

    const scopedWhere = this.applyScope(scope, where);

    const [rows, total] = await Promise.all([
      this.prisma.client.finding.findMany({
        where: scopedWhere,
        include: FINDING_INCLUDE,
        orderBy: [{ identifiedOn: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.finding.count({ where: scopedWhere }),
    ]);

    const items = await Promise.all(rows.map((row) => this.toFindingRecord(row)));

    return { items, page, pageSize, total };
  }

  private async toFindingRecord(row: FindingWithRelations): Promise<FindingRecord> {
    const [openActionCount, evidenceCount] = await Promise.all([
      this.prisma.client.action.count({
        where: {
          originType: 'FINDING',
          originId: row.id,
          status: { in: [...OPEN_ACTION_STATUSES] },
        },
      }),
      this.prisma.client.evidenceLink.count({
        where: { subjectType: 'FINDING', subjectId: row.id, unlinkedAt: null },
      }),
    ]);

    return {
      id: row.id,
      code: row.code,
      orgUnit: { id: row.orgUnit.id, name: row.orgUnit.name },
      title: row.title,
      description: row.description,
      recommendation: row.recommendation ?? undefined,
      category: row.category,
      origin: row.origin,
      severity: row.severity,
      priority: row.priority,
      owner: { id: row.ownerUser.id, fullName: row.ownerUser.fullName },
      identifiedOn: row.identifiedOn,
      status: row.status,
      openActionCount,
      evidenceCount,
      closedAt: row.closedAt ?? undefined,
      closedByUserId: row.closedByUserId ?? undefined,
      closureJustification: row.closureJustification ?? undefined,
      archivedAt: row.archivedAt ?? undefined,
      archivedByUserId: row.archivedByUserId ?? undefined,
      // T089/005-audit-findings — see `FindingRecord.auditEngagementId`'s
      // own doc comment.
      auditEngagementId: row.auditEngagementId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
