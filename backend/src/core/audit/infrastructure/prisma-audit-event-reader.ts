import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditEventReaderPort } from '../domain/ports/audit-event-reader.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  AuditEntityRef,
  AuditEventPage,
  AuditEventQuery,
} from '../domain/ports/audit-event-reader.port';
import type { AuditEntityType, AuditOutcome } from '@prisma/client';

interface RawAuditEventRow {
  readonly id: string;
  readonly occurred_at: Date;
  readonly actor_user_id: string | null;
  readonly actor_full_name: string | null;
  readonly actor_email: string | null;
  readonly actor_label: string;
  readonly action: string;
  readonly entity_type: AuditEntityType;
  readonly entity_id: string | null;
  readonly previous_values: Record<string, unknown> | null;
  readonly new_values: Record<string, unknown> | null;
  readonly outcome: AuditOutcome;
  readonly ip_address: string | null;
  readonly user_agent: string | null;
  readonly correlation_id: string;
  readonly total_count: number;
}

interface RawCountRow {
  readonly total: number;
}

@Injectable()
export class PrismaAuditEventReader implements AuditEventReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async query(input: AuditEventQuery): Promise<AuditEventPage> {
    const offset = (input.page - 1) * input.pageSize;

    const whereSql = Prisma.join(
      [
        entityRefsFragment(input.entityRefs),
        scopeFragment(input.scope),
        actionFragment(input.action),
        actorUserIdFragment(input.actorUserId),
        occurredFromFragment(input.occurredFrom),
        occurredToFragment(input.occurredTo),
      ],
      ' AND ',
    );

    const rows = await this.prisma.client.$queryRaw<RawAuditEventRow[]>(Prisma.sql`
      SELECT
        ae.id, ae.occurred_at, ae.actor_user_id,
        u.full_name AS actor_full_name, u.email AS actor_email,
        ae.actor_label, ae.action, ae.entity_type, ae.entity_id,
        ae.previous_values, ae.new_values, ae.outcome,
        ae.ip_address::text AS ip_address, ae.user_agent, ae.correlation_id,
        COUNT(*) OVER()::int AS total_count
      FROM audit_event ae
      LEFT JOIN users u ON u.id = ae.actor_user_id
      WHERE ${whereSql}
      ORDER BY ae.occurred_at DESC, ae.id DESC
      LIMIT ${input.pageSize} OFFSET ${offset}
    `);

    const total = rows.length > 0 ? rows[0]!.total_count : await this.countOnly(whereSql);

    return { items: rows.map(toSummary), total };
  }

  private async countOnly(whereSql: Prisma.Sql): Promise<number> {
    const rows = await this.prisma.client.$queryRaw<RawCountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total FROM audit_event WHERE ${whereSql}
    `);
    return rows[0]?.total ?? 0;
  }
}

function entityRefsFragment(refs: readonly AuditEntityRef[]): Prisma.Sql {
  const idsByType = new Map<AuditEntityType, string[]>();
  for (const ref of refs) {
    const bucket = idsByType.get(ref.entityType);
    if (bucket) {
      bucket.push(ref.entityId);
    } else {
      idsByType.set(ref.entityType, [ref.entityId]);
    }
  }

  if (idsByType.size === 0) {
    return Prisma.sql`FALSE`;
  }

  const groups = Array.from(idsByType.entries()).map(
    ([entityType, ids]) =>
      Prisma.sql`(entity_type = ${entityType}::"AuditEntityType" AND entity_id = ANY(${ids}::uuid[]))`,
  );

  return Prisma.sql`(${Prisma.join(groups, ' OR ')})`;
}

function scopeFragment(scope: ScopeFilter): Prisma.Sql {
  if (scope.kind === 'GLOBAL') {
    return Prisma.sql`TRUE`;
  }
  if (scope.unitIds.size === 0) {
    return Prisma.sql`FALSE`;
  }
  return Prisma.sql`organizational_unit_id = ANY(${Array.from(scope.unitIds)}::uuid[])`;
}

function actionFragment(action: string | undefined): Prisma.Sql {
  return action ? Prisma.sql`action = ${action}` : Prisma.sql`TRUE`;
}

function actorUserIdFragment(actorUserId: string | undefined): Prisma.Sql {
  return actorUserId ? Prisma.sql`actor_user_id = ${actorUserId}::uuid` : Prisma.sql`TRUE`;
}

function occurredFromFragment(occurredFrom: Date | undefined): Prisma.Sql {
  return occurredFrom ? Prisma.sql`occurred_at >= ${occurredFrom}` : Prisma.sql`TRUE`;
}

function occurredToFragment(occurredTo: Date | undefined): Prisma.Sql {
  return occurredTo ? Prisma.sql`occurred_at <= ${occurredTo}` : Prisma.sql`TRUE`;
}

function toSummary(row: RawAuditEventRow) {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actor:
      row.actor_user_id && row.actor_full_name && row.actor_email
        ? { id: row.actor_user_id, fullName: row.actor_full_name, email: row.actor_email }
        : null,
    actorLabel: row.actor_label,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    previousValues: row.previous_values,
    newValues: row.new_values,
    outcome: row.outcome,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    correlationId: row.correlation_id,
  };
}
