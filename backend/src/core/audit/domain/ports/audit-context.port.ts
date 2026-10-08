import type { AuditRequestContextSnapshot } from '../audit-event.types';

export abstract class AuditContextPort {
  abstract current(): AuditRequestContextSnapshot | undefined;
}
