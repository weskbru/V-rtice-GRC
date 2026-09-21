/**
 * `AuditModule` — the audit capability's composition root (T029/T030,
 * ADR-011: "nothing may import `infrastructure` except the module's own
 * composition root"). This file sits directly under `src/core/audit/`,
 * outside the `domain`/`application`/`infrastructure` folders the
 * boundary lint rules classify, so it is the one place allowed to wire a
 * domain port to its infrastructure implementation.
 *
 * Exports `AuditRecorder` (writes, FR-038 — every module depends on it,
 * never on `AuditEventWriterPort`/`AuditContextPort` directly) and, since
 * T168/US7, `AuditQueryService` (reads, `AuditEventReaderPort`) — the
 * reusable audit-query engine `modules/risk`'s own audit-trail endpoint
 * consumes (see `AuditQueryService`'s header for why the HTTP controller
 * itself lives in `modules/risk`, not here).
 */
import { Module } from '@nestjs/common';

import { AuditQueryService } from './application/audit-query.service';
import { AuditRecorder } from './application/audit-recorder.service';
import { registerCoreEntityAuditAllowlists } from './domain/core-entity-audit-allowlists';
import { AuditContextPort } from './domain/ports/audit-context.port';
import { AuditEventReaderPort } from './domain/ports/audit-event-reader.port';
import { AuditEventWriterPort } from './domain/ports/audit-event-writer.port';
import { PrismaAuditEventReader } from './infrastructure/prisma-audit-event-reader';
import { PrismaAuditEventWriter } from './infrastructure/prisma-audit-event-writer';
import { RequestContextAuditContextAdapter } from './infrastructure/request-context-audit-context.adapter';

@Module({
  providers: [
    AuditRecorder,
    AuditQueryService,
    { provide: AuditEventWriterPort, useClass: PrismaAuditEventWriter },
    { provide: AuditContextPort, useClass: RequestContextAuditContextAdapter },
    { provide: AuditEventReaderPort, useClass: PrismaAuditEventReader },
  ],
  exports: [AuditRecorder, AuditQueryService],
})
export class AuditModule {
  constructor() {
    // T030: register the allow-lists for the AuditEntityType values that
    // already exist (Core — identity/sessions/authorization/organizations).
    // A future business module registers its own entity types' allow-lists
    // the same way, from its own module's constructor, without editing
    // this line (ADR-011).
    registerCoreEntityAuditAllowlists();
  }
}
