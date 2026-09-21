/**
 * `RequestContext` (T019 / ADR-005 / ADR-012).
 *
 * One `RequestContextData` object per inbound HTTP request, published into
 * an `AsyncLocalStorage` by `RequestContextMiddleware` before any guard,
 * pipe, interceptor or controller runs. Everything downstream — the pino
 * logger (logger.ts), the global exception filter (T021), and later
 * `AuditRecorder` (ADR-005) — reads the same object without it being
 * threaded through every function signature.
 *
 * The object is intentionally mutable after creation: `actorUserId`,
 * `sessionId` and `authMethod` are unknown at the very start of the request
 * (before authentication runs) and are filled in later, in the same async
 * context, once a session/guard resolves them — see `enrich()`.
 *
 * `sessionId` is carried here so `AuditRecorder` can attribute a change to
 * the session that made it (ADR-005 stores `sessionId` on every
 * `audit_event` row). It must never additionally be treated as loggable:
 * `logger.ts` deliberately does NOT copy `sessionId` into structured log
 * output — session identifiers must never be serializable in logs (T018),
 * only in the database's own append-only audit trail.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';

import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export interface RequestContextData {
  readonly correlationId: string;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly method: string;
  readonly path: string;
  /** Filled in once authentication resolves the caller, if it does. */
  actorUserId?: string;
  /** Filled in once a session is validated. Audit-only — never logged. */
  sessionId?: string;
  /** e.g. "local" | "ldap" | "oidc" | "saml" (ADR-001), once known. */
  authMethod?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextData>();

export const RequestContextStore = {
  run<T>(context: RequestContextData, callback: () => T): T {
    return asyncLocalStorage.run(context, callback);
  },

  get(): RequestContextData | undefined {
    return asyncLocalStorage.getStore();
  },

  /** Merges fields into the context active in the current async chain, if
   * any. A no-op outside of a request (e.g. the seed script). */
  enrich(
    fields: Partial<Pick<RequestContextData, 'actorUserId' | 'sessionId' | 'authMethod'>>,
  ): void {
    const context = asyncLocalStorage.getStore();
    if (!context) {
      return;
    }
    Object.assign(context, fields);
  },
};

/**
 * Populates `RequestContextStore` for the lifetime of one request. Applied
 * globally via `AppModule.configure()`. Must run before the global
 * exception filter and any guard so both can rely on the context already
 * being present.
 *
 * `req.ip` reflects Express's trust-proxy setting, configured explicitly in
 * `main.ts` (T024, ADR-014) — behind the Next.js single-origin proxy this
 * must resolve to the real client address, not the proxy's.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = randomUUID();
    const userAgent = req.get('user-agent');

    const context: RequestContextData = {
      correlationId,
      ipAddress: req.ip ?? '',
      userAgent: userAgent ?? '',
      method: req.method,
      path: req.path,
    };

    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    RequestContextStore.run(context, () => {
      next();
    });
  }
}
