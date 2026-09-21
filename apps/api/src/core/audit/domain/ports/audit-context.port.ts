/**
 * Request-context port (T029, ADR-011). `RequestContext`
 * (infrastructure/logging/request-context.ts) lives in the top-level
 * `infrastructure` element, which `core-application` is not allowed to
 * import directly under the ADR-011 boundary rules (only
 * `core-infrastructure`/`module-infrastructure` may reach top-level
 * `infrastructure`). `AuditRecorder` therefore depends on this port
 * instead; `core/audit/infrastructure/request-context-audit-context.adapter.ts`
 * is the only implementation, reading the real `RequestContextStore`.
 */
import type { AuditRequestContextSnapshot } from '../audit-event.types';

export abstract class AuditContextPort {
  /**
   * The audit-relevant subset of the ambient request context, or
   * `undefined` when called from outside any request context (a script,
   * or a test that does not need to exercise context propagation).
   * `AuditRecorder` treats `undefined` the same as "no session, no known
   * actor, no known IP/user agent" and mints a fresh correlation id so
   * `correlationId` — `NOT NULL` in the schema — is always populated.
   */
  abstract current(): AuditRequestContextSnapshot | undefined;
}
