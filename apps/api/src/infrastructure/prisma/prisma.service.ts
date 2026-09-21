/**
 * `PrismaService` (T016) — the sole way any other layer touches PostgreSQL.
 *
 * ## Contract
 *
 * 1. **Lifecycle**: connects in `onModuleInit`, disconnects in
 *    `onModuleDestroy`, so Nest owns the connection pool's lifetime rather
 *    than Prisma's lazy-connect-on-first-query default racing the
 *    readiness probe (T023).
 *
 * 2. **Connection**: constructed with `datasourceUrl` explicitly taken from
 *    `AppConfigService` (never ambient `process.env`), always
 *    `DATABASE_URL` — the restricted `pharos_app` role (ADR-005). Prisma
 *    `migrate`/`generate` are the only commands ever run against
 *    `DATABASE_MIGRATION_URL` (the owner role, `pharos_owner`), and they run
 *    outside this service, from the CLI.
 *
 * 3. **Transactions** (ADR-005): `runInTransaction(fn)` opens a Prisma
 *    interactive transaction and publishes the transaction client into an
 *    `AsyncLocalStorage` for the lifetime of `fn`. A later application
 *    service does not need `tx` threaded through every method signature —
 *    it reads `prismaService.client` and transparently gets the active
 *    transaction client when called from inside `runInTransaction`, or the
 *    ambient (non-transactional) client otherwise. This is what lets a
 *    business write and its `AuditRecorder.record(...)` call share one
 *    transaction (so a rolled-back change leaves no audit row) without the
 *    audit call site needing to know whether it was handed a `tx`.
 *
 *    Usage from an application service:
 *
 *    ```ts
 *    await this.prisma.runInTransaction(async () => {
 *      const risk = await this.riskRepository.create(input); // uses prisma.client internally
 *      await this.auditRecorder.record({ action: 'risk.created', ... }); // same transaction
 *      return risk;
 *    });
 *    ```
 *
 *    Calling `runInTransaction` while already inside one (nested calls
 *    across services in the same request) reuses the existing transaction
 *    client rather than nesting Prisma interactive transactions, which
 *    Prisma does not support.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { AppConfigService } from '../config/app-config.service';

export type PrismaTransactionClient = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Per-async-context active transaction client. Static because
   * `AsyncLocalStorage` context propagates through the async call chain
   * regardless of which `PrismaService` instance is involved — there is
   * exactly one in the DI container in practice, but the storage itself
   * must not be duplicated per instance.
   */
  private static readonly transactionStorage = new AsyncLocalStorage<PrismaTransactionClient>();

  /**
   * A reference to this same instance, captured immediately after
   * `super(...)` returns — see `get client()` below for why this is not
   * redundant with a plain `this`.
   *
   * **Discovered while building the T029/T031 audit integration harness,
   * confirmed independent of any bundler/transform (reproduced verbatim
   * under `ts-node --transpile-only`, i.e. this is not the tsx/esbuild
   * issue this file's other comments warn about — it is a separate,
   * genuine behavior of `@prisma/client` 6.19.3 itself):** Prisma's
   * generated `PrismaClient` constructor does not return the freshly
   * allocated `this` — it explicitly executes
   * `return this._appliedParent = <internal wrap>(this)`, where the
   * wrapping function returns a Proxy over the raw instance so that model
   * delegates (`.user`, `.auditEvent`, ...) can be resolved dynamically.
   * Per the ECMAScript derived-class-constructor rules, an explicit object
   * return from a `super()` call becomes `this` for the REST of the
   * derived constructor's own body (which is why capturing it below, right
   * after `super(...)`, yields the fully-functional Proxy-wrapped client —
   * confirmed empirically: `appConfig`-based fixtures and `svc.user` both
   * work when read from outside the constructor). But a getter/method
   * defined on `PrismaService.prototype` and invoked THROUGH that outer
   * Proxy — e.g. `someCaller.client` — is reached via the Proxy's
   * fallback property lookup on the RAW pre-wrap object, not the Proxy
   * itself, so `this` *inside* such a getter is that raw object: it has
   * every internal `_xxx` field (so `$transaction`/`$connect`/`$queryRaw`
   * etc. still work, since those only touch those fields) but NONE of the
   * Proxy-provided model delegates. `get client()` returning bare `this`
   * would therefore silently hand back a client with every `.user`,
   * `.auditEvent`, ... delegate missing whenever there is no active
   * transaction — exactly the case this getter exists to serve. Capturing
   * the correctly-wrapped reference once, right after construction, and
   * returning THAT instead of `this` is the fix; see
   * `test/integration/audit-transactional.spec.ts` for the regression
   * coverage.
   */
  private readonly self: this;

  constructor(appConfig: AppConfigService) {
    super({
      datasourceUrl: appConfig.database.url,
    });
    this.self = this;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('PostgreSQL connection established.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * The client to issue queries against from the current async context:
   * the active transaction client if one is open, otherwise this ambient
   * (non-transactional) client. Application-layer repositories should read
   * this instead of assuming `PrismaService` itself is always the right
   * query root.
   */
  get client(): PrismaClient | PrismaTransactionClient {
    return PrismaService.transactionStorage.getStore() ?? this.self;
  }

  /** True when called from within an active `runInTransaction` scope. */
  get isInTransaction(): boolean {
    return PrismaService.transactionStorage.getStore() !== undefined;
  }

  async runInTransaction<T>(fn: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    const existing = PrismaService.transactionStorage.getStore();

    if (existing) {
      return fn(existing);
    }

    return this.$transaction(async (tx) => {
      return PrismaService.transactionStorage.run(tx, () => fn(tx));
    });
  }
}
