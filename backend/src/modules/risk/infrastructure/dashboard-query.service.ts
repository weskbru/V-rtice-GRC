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

function scopeFragment(scope: ScopeFilter): Prisma.Sql {
  if (scope.kind === 'GLOBAL') {
    return Prisma.sql`TRUE`;
  }
  if (scope.unitIds.size === 0) {
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

function approvalRequestedDueContext(requestedTransition: string): string {
  const toStatus = requestedTransition.split('->')[1] as RiskStatus | undefined;
  const toLabel = toStatus
    ? USER_MESSAGES.risk.history.statusLabels[toStatus]
    : requestedTransition;
  return USER_MESSAGES.risk.history.approvalRequested(toLabel);
}
