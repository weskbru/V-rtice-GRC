import { Injectable } from '@nestjs/common';

import { AuditEventReaderPort } from '../domain/ports/audit-event-reader.port';

import type { AuditEventQuery, AuditEventPage } from '../domain/ports/audit-event-reader.port';

@Injectable()
export class AuditQueryService {
  constructor(private readonly reader: AuditEventReaderPort) {}

  async query(input: AuditEventQuery): Promise<AuditEventPage> {
    return this.reader.query(input);
  }
}
