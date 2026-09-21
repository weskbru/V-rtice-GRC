/**
 * Persistence port for a fully-populated audit row (T029, ADR-011).
 * `core/audit/application` depends on this abstract class — never on
 * `PrismaService` directly, which would violate the ADR-011 rule that
 * `core-application` may only import `core-domain`/`core-application`.
 * `core/audit/infrastructure/prisma-audit-event-writer.ts` is the only
 * implementation, wired in `core/audit/audit.module.ts` (the capability's
 * composition root).
 *
 * An abstract class, not a TypeScript `interface`, so it exists at
 * runtime and can be used as a Nest DI token (`{ provide:
 * AuditEventWriterPort, useClass: PrismaAuditEventWriter }`) the same way
 * research.md's other ports (`AuthenticationProvider`,
 * `FileStorageProvider`) are described.
 */
import type { AuditEventRecord } from '../audit-event.types';

export abstract class AuditEventWriterPort {
  /**
   * Persists one audit row. Implementations MUST throw
   * `AuditNotInTransactionError` rather than write anything if there is no
   * ambient transaction — see the Prisma implementation for why that
   * check belongs there rather than in the application layer.
   */
  abstract write(event: AuditEventRecord): Promise<void>;
}
