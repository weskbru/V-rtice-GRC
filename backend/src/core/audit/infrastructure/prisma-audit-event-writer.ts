import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditNotInTransactionError } from '../domain/errors';
import { AuditEventWriterPort } from '../domain/ports/audit-event-writer.port';

import type { AuditEventRecord } from '../domain/audit-event.types';

@Injectable()
export class PrismaAuditEventWriter extends AuditEventWriterPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async write(event: AuditEventRecord): Promise<void> {
    if (!this.prisma.isInTransaction) {
      throw new AuditNotInTransactionError();
    }

    await this.prisma.client.auditEvent.create({
      data: {
        id: event.id,
        occurredAt: event.occurredAt,
        actorUserId: event.actorUserId ?? null,
        actorLabel: event.actorLabel,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        previousValues:
          (event.previousValues as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        newValues: (event.newValues as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        organizationalUnitId: event.organizationalUnitId ?? null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        sessionId: event.sessionId ?? null,
        correlationId: event.correlationId,
        outcome: event.outcome,
      },
    });
  }
}
