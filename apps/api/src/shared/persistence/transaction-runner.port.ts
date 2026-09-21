/**
 * `TransactionRunnerPort` — lets an `application`-layer use case open the
 * one transaction its write-plus-audit sequence must share (ADR-005:
 * "Prisma's interactive transactions carry the audit insert and the
 * business write together"), without importing `PrismaService` directly.
 *
 * `PrismaService` lives in the top-level `infrastructure` element; only a
 * module's own `infrastructure` layer may import it (ADR-011,
 * `apps/api/eslint.config.mjs`). An `application`-layer use case
 * (`modules/<module>/application/**`) needs exactly one capability from
 * it — "run this async block as one transaction" — and nothing else. This
 * port is that narrow capability, expressed as an abstract class (so it
 * doubles as a Nest DI token, the same pattern every port in this codebase
 * uses) living in `shared/**`, which every layer may import (ADR-011) —
 * the same reasoning `ScopedRepository`/`ScopeFilter` in this same
 * directory are built on: the ABSTRACTION belongs where every layer can
 * reach it, even though the one real IMPLEMENTATION
 * (`modules/risk/infrastructure/prisma-transaction-runner.ts`, and any
 * future module's equivalent) lives in `infrastructure` and depends on
 * `PrismaService`.
 *
 * A future business module (Problems, Incidents, ...) hits the exact same
 * "application layer needs a transaction, but may not import PrismaService"
 * problem T089/T090 solved this for — it reuses this same port and writes
 * its own one-line adapter, rather than this abstraction being invented
 * again per module.
 */
export abstract class TransactionRunnerPort {
  /**
   * Runs `fn` inside a database transaction (opening one if none is already
   * active on the current async context, or reusing the ambient one — see
   * `PrismaService.runInTransaction`'s own contract). Every repository
   * write and `AuditRecorder.record(...)` call made from inside `fn`
   * automatically joins this same transaction.
   */
  abstract run<T>(fn: () => Promise<T>): Promise<T>;
}
