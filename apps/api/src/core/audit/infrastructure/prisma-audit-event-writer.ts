/**
 * Prisma-backed `AuditEventWriterPort` implementation (T029, ADR-005).
 *
 * This is the ONLY place in the codebase that checks
 * `prismaService.isInTransaction` before writing an audit row, and the
 * reason it lives here rather than in `AuditRecorder` is architectural,
 * not incidental: `PrismaService` is the top-level `infrastructure`
 * element, and `core-application` (where `AuditRecorder` lives) is not
 * allowed to import it under the ADR-011 boundary rules — only
 * `core-infrastructure` (this file) and `core-presentation` may reach
 * `PrismaService` directly.
 *
 * `PrismaService.client` transparently resolves to the active
 * transaction's client when one is open (see that class's contract) — so
 * once `isInTransaction` is confirmed true, `this.prisma.client.auditEvent
 * .create(...)` below runs inside the caller's transaction automatically,
 * with no `tx` parameter threaded through `AuditRecorder`'s call sites.
 */
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
    // The append-only guarantee's evidentiary value depends entirely on
    // this check running BEFORE any SQL is issued (ADR-005): a
    // best-effort write that happens to occur outside a transaction would
    // survive even if the surrounding business operation later fails for
    // an unrelated reason, producing exactly the "audited change that
    // never committed" failure ADR-005 exists to rule out.
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
