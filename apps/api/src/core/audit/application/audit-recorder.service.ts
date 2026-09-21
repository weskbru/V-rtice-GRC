/**
 * T029 — `AuditRecorder`, the single centralized audit capability (FR-031,
 * ADR-005). Every module — core or business — that needs to record an
 * audit entry depends on this service and nothing else; there is no
 * second, per-module way to write to `audit_event` (FR-038).
 *
 * ## Transactional coupling (ADR-005) is enforced below the port, not here
 *
 * `AuditRecorder` itself never touches `PrismaService` — it cannot: under
 * the ADR-011 boundary rules, `core-application` may only import
 * `core-domain`/`core-application`, never the top-level `infrastructure`
 * element `PrismaService` lives in. So "fail loudly if there is no ambient
 * transaction" cannot be a check written in this file; it is written in
 * `PrismaAuditEventWriter` (`core/audit/infrastructure`), the only place
 * that legitimately knows what a Prisma transaction is. Concretely:
 * `AuditEventWriterPort.write(...)` is documented, and its Prisma
 * implementation is verified by test, to throw `AuditNotInTransactionError`
 * synchronously before issuing any SQL whenever
 * `prismaService.isInTransaction` is `false` — so calling `record(...)`
 * outside `prismaService.runInTransaction(...)` always throws instead of
 * silently writing a standalone, unaudited-by-rollback row. This is the
 * mechanism, described in the module contract of `PrismaService`, that
 * lets a business write and its audit entry share one transaction without
 * `AuditRecorder` itself needing to know about `tx`.
 *
 * ## Making it hard to omit a required field
 *
 * `record(input: RecordAuditEventInput)` accepts only what a caller can
 * know and must supply: `action`, `entityType` and `actorLabel` have no
 * optional variant and no default (see `audit-event.types.ts`), so
 * forgetting one is a compile error, not a runtime gap silently written as
 * `null`/`''`. Every field `AuditRecorder` can derive itself — actor id,
 * IP, user agent, session id, correlation id (from `AuditContextPort`),
 * plus `id`/`occurredAt` (generated here) — is not part of the input type
 * at all, so a caller cannot get it wrong by supplying a stale or
 * inconsistent value either.
 */
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

  /**
   * Records one audit entry. MUST be called from inside the same
   * `prismaService.runInTransaction(...)` scope as the business change it
   * describes (ADR-005) — see the file-level comment for what happens
   * otherwise.
   */
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
      // `correlationId` is NOT NULL in the schema (it ties audit to logs,
      // ADR-012). Outside any request context (a script, or a unit test
      // that does not wire RequestContextStore) there is nothing to read,
      // so a fresh one is minted rather than leaving the row unattributable.
      correlationId: context?.correlationId ?? randomUUID(),
      outcome: input.outcome ?? AuditOutcome.SUCCESS,
    };

    await this.writer.write(event);
  }
}
