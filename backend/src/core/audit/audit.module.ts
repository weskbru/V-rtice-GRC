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
    registerCoreEntityAuditAllowlists();
  }
}
