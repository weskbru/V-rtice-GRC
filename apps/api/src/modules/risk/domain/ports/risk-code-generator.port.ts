/**
 * T087 — port for allocating the next risk code within a given year
 * (FR-054). An abstract class (not an `interface`) so it doubles as a Nest
 * DI token, the same pattern every core port already uses
 * (`UserDirectoryPort`, `AuditEventWriterPort`, ...).
 *
 * `modules/risk/infrastructure/prisma-risk-code-generator.ts` is the only
 * implementation, wired in `risk.module.ts`.
 */
export abstract class RiskCodeGeneratorPort {
  /**
   * Atomically allocates and returns the next code for `year` (e.g.
   * `RSK-2026-0001`, then `RSK-2026-0002`, ...). MUST be called from inside
   * the same transaction as the `Risk` row insert it is generating a code
   * for — see the Prisma-backed implementation's header for why this makes
   * a failed creation never "burn" a code number, and for how it stays
   * collision-free under concurrent creates in the same year.
   */
  abstract nextCode(year: number): Promise<string>;
}
