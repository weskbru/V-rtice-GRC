import type { EntityCodePrefix } from '../entity-code.service';

/**
 * T012/002-shared-grc-foundation — port for allocating the next entity code
 * within a given `(prefix, year)` pair (R-008). An abstract class (not an
 * `interface`) so it doubles as a Nest DI token, the same pattern every
 * core port already uses (`UserDirectoryPort`, `AuditEventWriterPort`, ...)
 * and the exact shape `modules/risk/domain/ports/risk-code-generator.port.ts`
 * establishes for `Risk`.
 *
 * `grc/shared/infrastructure/prisma-entity-code-generator.ts` is the only
 * implementation, wired by whichever module composition root needs it
 * (`EvidenceModule`/`ActionModule`/`FindingModule`, a later task's scope).
 */
export abstract class EntityCodeGeneratorPort {
  /**
   * Atomically allocates and returns the next code for `(prefix, year)`
   * (e.g. `EVD-2026-0001`, then `EVD-2026-0002`, ...). MUST be called from
   * inside the same transaction as the row insert it is generating a code
   * for — see the Prisma-backed implementation's header for why this makes
   * a failed creation never "burn" a code number, and for how it stays
   * collision-free under concurrent creates of the same prefix in the same
   * year.
   */
  abstract nextCode(prefix: EntityCodePrefix, year: number): Promise<string>;
}
