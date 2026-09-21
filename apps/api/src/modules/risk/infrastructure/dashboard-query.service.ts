/**
 * T197 — `DashboardQueryService`: the sole Prisma-backed implementation of
 * `DashboardQueryPort` (`domain/ports/dashboard-query.port.ts`), backing
 * `GET /dashboard`'s Risk Management areas
 * (`contracts/platform.openapi.yaml`'s `getDashboard` operation, ~414,
 * FR-047 to FR-052).
 *
 * ## Aggregate in the database, never in application code
 *
 * Every number this service returns comes from a `COUNT(*)`/`FILTER`
 * aggregate evaluated by PostgreSQL. Nothing here fetches rows and counts
 * them in TypeScript — that would both duplicate the register's own
 * counting logic and be unable to meet plan.md's dashboard p95 budget
 * (≤600ms) at 50,000 risks (`prisma/seed/performance.seed.ts`, T200): a
 * full-table fetch to count in-process pays the network/deserialization
 * cost of every matching row on every dashboard load, where a `FILTER`
 * aggregate pays it once, inside the database, and returns a handful of
 * integers.
 *
 * ## Same conventions as `risk-query.service.ts` (this file's sibling)
 *
 * Read that file's header first — this one follows it exactly:
 *
 * - Raw SQL via `Prisma.sql`, every value parameterized; the only
 *   interpolated fragments are fixed, whitelisted literals this file
 *   builds from `@prisma/client`'s own enum exports (`RiskLevel`,
 *   `RiskStatus`) — never from request input (FR-106).
 * - `COUNT(*) OVER()` for a tile's `total` alongside its capped `items`
 *   page, in the SAME statement, so a 10-row tile does not cost a second
 *   round trip to learn how many rows exist beyond page 1. When the page
 *   comes back with zero items (either genuinely no matches, or the item
 *   cap is 0) there is no row to read `total` from, so `total: 0` is
 *   returned directly rather than a second `COUNT(*)` query — for these
 *   dashboard tiles (`limit` is always ≥1, from `GetDashboardUseCase`'s own
 *   constant), a zero-row page and a genuinely empty result are the same
 *   case, unlike the register's arbitrary-offset pagination.
 * - `scopeFragment` mirrors `risk-query.service.ts`'s OWN `scopeFragment`
 *   function verbatim (`GLOBAL` -> `TRUE`, empty `UNIT` scope -> `FALSE`,
 *   otherwise `org_unit_id = ANY(...)`) — the SAME "documented parity"
 *   pattern already established between that file's
 *   `overdueReviewFragment`/`domain/risk-overdue.ts`'s `isOverdueReview`.
 *   Not imported from that file because `RiskQueryService`'s own
 *   `scopeFragment` is a private, unexported function of a stable, already
 *   tested module — duplicating five lines here is materially safer than
 *   widening that file's surface to export a helper it has no other reason
 *   to expose. A change to the scope rule must update both; both carry
 *   this comment pointing at the other.
 * - `overdueTreatment` uses the IDENTICAL rule
 *   `domain/risk-overdue.ts`'s `isOverdueTreatmentAction` and
 *   `risk-query.service.ts`'s `overdueTreatmentExistsFragment` already
 *   encode: `status NOT IN ('COMPLETED','CANCELLED') AND due_on < today`.
 *   `overdueReview` uses the identical rule to
 *   `domain/risk-overdue.ts`'s `isOverdueReview`: `next_review_on IS NOT
 *   NULL AND next_review_on < today`.
 *
 * ## Risk level agrees with the register (ADR-006, Constitution VI)
 *
 * `byResidualLevel` groups the SAME `risks.residual_level` column the
 * register's `riskLevel`/`riskLevelBasis=RESIDUAL` filter reads
 * (`risk-query.service.ts`'s `riskLevelColumn`) — no separate scoring or
 * band lookup happens here. A risk's level is computed exactly once, by
 * `RiskScoringService` at assessment time, and stored on `risks.residual_level`
 * / `risks.inherent_level`; every reader (register, dashboard, this file)
 * reads that same column. See `test/contract/dashboard.spec.ts`'s
 * "agrees with the register" assertion for the end-to-end proof.
 */
import { Injectable } from '@nestjs/common';
import { Prisma, RiskLevel, RiskStatus } from '@prisma/client';

import {
  overdueEligibleActionStatusSqlList,
  todayDateOnlyUtc,
} from '../../../grc/shared/domain/overdue.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { DashboardQueryPort } from '../domain/ports/dashboard-query.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  DashboardActionItemRecord,
  DashboardRiskItemRecord,
  ItemsRequiringReviewRecord,
  OverdueActionsRecord,
  PendingApprovalsRecord,
  RiskProfileRecord,
  TreatmentActionsSummaryRecord,
} from '../domain/ports/dashboard-query.port';

const ALL_RISK_LEVELS = Object.values(RiskLevel);
const ALL_RISK_STATUSES = Object.values(RiskStatus);

interface RiskProfileRow {
  readonly total: number;
  readonly level_low: number;
  readonly level_medium: number;
  readonly level_high: number;
  readonly level_critical: number;
  readonly status_draft: number;
  readonly status_identified: number;
  readonly status_assessed: number;
  readonly status_under_treatment: number;
  readonly status_under_review: number;
  readonly status_accepted: number;
  readonly status_closed: number;
  readonly status_archived: number;
}

interface ReviewItemRow {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly residual_level: RiskLevel | null;
  readonly next_review_on: Date;
  readonly total_count: number;
}

interface OverdueActionRow {
  readonly action_id: string;
  readonly risk_id: string;
  readonly risk_code: string;
  readonly title: string;
  readonly due_on: Date;
  readonly responsible_id: string;
  readonly responsible_full_name: string;
  readonly responsible_email: string;
  readonly total_count: number;
}

interface PendingApprovalRow {
  readonly id: string;
  readonly requested_transition: string;
  readonly risk_id: string;
  readonly code: string;
  readonly title: string;
  readonly residual_level: RiskLevel | null;
  readonly total_count: number;
}

interface TreatmentSummaryRow {
  readonly total: number;
  readonly open_count: number;
  readonly overdue_count: number;
}

@Injectable()
export class DashboardQueryService implements DashboardQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getRiskProfile(scope: ScopeFilter): Promise<RiskProfileRecord> {
    const rows = await this.prisma.client.$queryRaw<RiskProfileRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE r.residual_level = 'LOW')::int AS level_low,
        COUNT(*) FILTER (WHERE r.residual_level = 'MEDIUM')::int AS level_medium,
        COUNT(*) FILTER (WHERE r.residual_level = 'HIGH')::int AS level_high,
        COUNT(*) FILTER (WHERE r.residual_level = 'CRITICAL')::int AS level_critical,
        COUNT(*) FILTER (WHERE r.status = 'DRAFT')::int AS status_draft,
        COUNT(*) FILTER (WHERE r.status = 'IDENTIFIED')::int AS status_identified,
        COUNT(*) FILTER (WHERE r.status = 'ASSESSED')::int AS status_assessed,
        COUNT(*) FILTER (WHERE r.status = 'UNDER_TREATMENT')::int AS status_under_treatment,
        COUNT(*) FILTER (WHERE r.status = 'UNDER_REVIEW')::int AS status_under_review,
        COUNT(*) FILTER (WHERE r.status = 'ACCEPTED')::int AS status_accepted,
        COUNT(*) FILTER (WHERE r.status = 'CLOSED')::int AS status_closed,
        COUNT(*) FILTER (WHERE r.status = 'ARCHIVED')::int AS status_archived
      FROM risks r
      WHERE ${scopeFragment(scope)}
    `);

    const row = rows[0];
    if (!row) {
      // Unreachable in practice (a bare aggregate with no GROUP BY always
      // returns exactly one row, even over zero matching source rows), but
      // typed defensively rather than with a non-null assertion.
      return {
        total: 0,
        byResidualLevel: zeroed(ALL_RISK_LEVELS),
        byStatus: zeroed(ALL_RISK_STATUSES),
      };
    }

    return {
      total: row.total,
      byResidualLevel: {
        LOW: row.level_low,
        MEDIUM: row.level_medium,
        HIGH: row.level_high,
        CRITICAL: row.level_critical,
      },
      byStatus: {
        DRAFT: row.status_draft,
        IDENTIFIED: row.status_identified,
        ASSESSED: row.status_assessed,
        UNDER_TREATMENT: row.status_under_treatment,
        UNDER_REVIEW: row.status_under_review,
        ACCEPTED: row.status_accepted,
        CLOSED: row.status_closed,
        ARCHIVED: row.status_archived,
      },
    };
  }

  async getItemsRequiringReview(
    scope: ScopeFilter,
    limit: number,
  ): Promise<ItemsRequiringReviewRecord> {
    const todayParam = toDateOnlyParam(todayDateOnlyUtc());

    const rows = await this.prisma.client.$queryRaw<ReviewItemRow[]>(Prisma.sql`
      SELECT r.id, r.code, r.title, r.residual_level, r.next_review_on,
        COUNT(*) OVER()::int AS total_count
      FROM risks r
      WHERE ${scopeFragment(scope)}
        AND r.next_review_on IS NOT NULL
        AND r.next_review_on < ${todayParam}::date
      ORDER BY r.next_review_on ASC, r.code ASC
      LIMIT ${limit}
    `);

    return {
      total: rows.length > 0 ? rows[0]!.total_count : 0,
      items: rows.map((row) => ({
        riskId: row.id,
        code: row.code,
        title: row.title,
        residualLevel: row.residual_level ?? undefined,
        dueContext: USER_MESSAGES.risk.dashboard.reviewOverdueSince(
          toDateOnlyParam(row.next_review_on),
        ),
      })),
    };
  }

  // 007-implementation-remediation, Frente A, D-7 — both queries below read
  // `actions` directly, by origin (`a.origin_type = 'RISK_TREATMENT' AND
  // a.origin_id = r.id`) — `Action` is the sole authority for a risk
  // treatment action's status/due date/title/responsible now (D-1);
  // `risk_treatment_actions` no longer carries any of those columns. The
  // scope predicate stays on `r` (the RISK) via the SAME `scopeFragment`
  // as before — never on `a.org_unit_id`, which is a creation-time
  // snapshot that can go stale after a reorganization (data-model.md §3's
  // invariant; the SAME rule `overdueTreatmentExistsFragment` in
  // `risk-query.service.ts` now follows). The overdue-eligible statuses are
  // never a literal here — coordinator correction: this used to hand-write
  // `IN ('OPEN', 'IN_PROGRESS')` independently of that file and of
  // `grc/shared/domain/overdue.service.ts#isActionOverdue`, agreeing only
  // because nobody had changed one without the others yet.
  // `overdueEligibleActionStatusSqlList()` generates this text FROM that
  // file's own array on every call, proven by
  // `test/integration/overdue-eligible-status-consolidation.spec.ts`.
  async getOverdueActions(scope: ScopeFilter, limit: number): Promise<OverdueActionsRecord> {
    const todayParam = toDateOnlyParam(todayDateOnlyUtc());
    const overdueStatusList = Prisma.raw(overdueEligibleActionStatusSqlList());

    const rows = await this.prisma.client.$queryRaw<OverdueActionRow[]>(Prisma.sql`
      SELECT
        a.id AS action_id, a.origin_id AS risk_id, r.code AS risk_code, a.title, a.due_on,
        resp.id AS responsible_id, resp.full_name AS responsible_full_name, resp.email AS responsible_email,
        COUNT(*) OVER()::int AS total_count
      FROM actions a
      JOIN risks r ON r.id = a.origin_id AND a.origin_type = 'RISK_TREATMENT'
      JOIN users resp ON resp.id = a.responsible_user_id
      WHERE ${scopeFragment(scope)}
        AND a.status IN (${overdueStatusList})
        AND a.due_on < ${todayParam}::date
      ORDER BY a.due_on ASC, a.id ASC
      LIMIT ${limit}
    `);

    return {
      total: rows.length > 0 ? rows[0]!.total_count : 0,
      items: rows.map((row): DashboardActionItemRecord => ({
        actionId: row.action_id,
        riskId: row.risk_id,
        riskCode: row.risk_code,
        title: row.title,
        dueOn: row.due_on,
        responsible: {
          id: row.responsible_id,
          fullName: row.responsible_full_name,
          email: row.responsible_email,
        },
      })),
    };
  }

  async getTreatmentActionsSummary(scope: ScopeFilter): Promise<TreatmentActionsSummaryRecord> {
    const todayParam = toDateOnlyParam(todayDateOnlyUtc());
    // Same authority, same generated text, as `getOverdueActions` above —
    // see that method's own comment. `open_count` reuses the identical
    // list for a plain "not yet terminal" count (no due-date condition);
    // it is the SAME status set this front's specification treats as one
    // rule, not a second, coincidentally-identical one.
    const overdueStatusList = Prisma.raw(overdueEligibleActionStatusSqlList());

    const rows = await this.prisma.client.$queryRaw<TreatmentSummaryRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE a.status IN (${overdueStatusList}))::int AS open_count,
        COUNT(*) FILTER (
          WHERE a.status IN (${overdueStatusList}) AND a.due_on < ${todayParam}::date
        )::int AS overdue_count
      FROM actions a
      JOIN risks r ON r.id = a.origin_id AND a.origin_type = 'RISK_TREATMENT'
      WHERE ${scopeFragment(scope)}
    `);

    const row = rows[0];
    return {
      total: row?.total ?? 0,
      open: row?.open_count ?? 0,
      overdue: row?.overdue_count ?? 0,
    };
  }

  async getPendingApprovals(
    scope: ScopeFilter,
    excludingUserId: string,
    limit: number,
  ): Promise<PendingApprovalsRecord> {
    const rows = await this.prisma.client.$queryRaw<PendingApprovalRow[]>(Prisma.sql`
      SELECT
        a.id, a.requested_transition, r.id AS risk_id, r.code, r.title, r.residual_level,
        COUNT(*) OVER()::int AS total_count
      FROM approvals a
      JOIN risks r ON r.id = a.entity_id
      WHERE a.entity_type = 'RISK'
        AND a.status = 'PENDING'
        AND a.requested_by_user_id != ${excludingUserId}::uuid
        AND ${scopeFragment(scope)}
      ORDER BY a.requested_at ASC, a.id ASC
      LIMIT ${limit}
    `);

    return {
      total: rows.length > 0 ? rows[0]!.total_count : 0,
      items: rows.map((row): DashboardRiskItemRecord => ({
        riskId: row.risk_id,
        code: row.code,
        title: row.title,
        residualLevel: row.residual_level ?? undefined,
        dueContext: approvalRequestedDueContext(row.requested_transition),
      })),
    };
  }
}

/**
 * Mirrors `risk-query.service.ts`'s own private `scopeFragment` — see this
 * file's header for why it is duplicated rather than imported. Every query
 * in this file joins `risks` under the alias `r`, so a single, fixed
 * `r.org_unit_id` reference (never request input) covers all of them.
 */
function scopeFragment(scope: ScopeFilter): Prisma.Sql {
  if (scope.kind === 'GLOBAL') {
    return Prisma.sql`TRUE`;
  }
  if (scope.unitIds.size === 0) {
    // CLAUDE.md "escopo vazio": a caller with no grants sees zeroed tiles,
    // never an error and never every risk.
    return Prisma.sql`FALSE`;
  }
  return Prisma.sql`r.org_unit_id = ANY(${Array.from(scope.unitIds)}::uuid[])`;
}

function toDateOnlyParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function zeroed<T extends string>(keys: readonly T[]): Readonly<Record<T, number>> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

/**
 * `requestedTransition` is stored as `"FROM_STATUS->TO_STATUS"`
 * (`Approval.requestedTransition`, `domain/ports/approval-repository.port.ts`).
 * Only the target status matters for display — reusing
 * `USER_MESSAGES.risk.history.approvalRequested`, the SAME sentence the
 * risk-history timeline already shows for this exact event
 * (`risk-history.service.ts`), rather than inventing a second phrasing
 * here.
 */
function approvalRequestedDueContext(requestedTransition: string): string {
  const toStatus = requestedTransition.split('->')[1] as RiskStatus | undefined;
  const toLabel = toStatus
    ? USER_MESSAGES.risk.history.statusLabels[toStatus]
    : requestedTransition;
  return USER_MESSAGES.risk.history.approvalRequested(toLabel);
}
