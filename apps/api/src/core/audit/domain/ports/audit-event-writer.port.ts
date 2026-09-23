import type { AuditEventRecord } from '../audit-event.types';

export abstract class AuditEventWriterPort {
  abstract write(event: AuditEventRecord): Promise<void>;
}
