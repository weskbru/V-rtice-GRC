import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { AuditOutcome } from '@prisma/client';

import { applyAuditFieldAllowlist } from '../domain/audit-field-allowlist';
import { AuditContextPort } from '../domain/ports/audit-context.port';
import { AuditEventWriterPort } from '../domain/ports/audit-event-writer.port';

import type { AuditEventRecord, RecordAuditEventInput } from '../domain/audit-event.types';

@Injectable()
export class AuditRecorder {
  constructor(
    private readonly writer: AuditEventWriterPort,
    private readonly context: AuditContextPort,
  ) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    const context = this.context.current();

    const event: AuditEventRecord = {
      id: randomUUID(),
      occurredAt: new Date(),
      actorUserId: context?.actorUserId,
      actorLabel: input.actorLabel,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousValues: applyAuditFieldAllowlist(input.entityType, input.previousValues),
      newValues: applyAuditFieldAllowlist(input.entityType, input.newValues),
      organizationalUnitId: input.organizationalUnitId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      sessionId: context?.sessionId,
      correlationId: context?.correlationId ?? randomUUID(),
      outcome: input.outcome ?? AuditOutcome.SUCCESS,
    };

    await this.writer.write(event);
  }
}
