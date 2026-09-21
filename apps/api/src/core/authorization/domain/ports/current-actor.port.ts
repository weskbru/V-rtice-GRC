/**
 * Port for identifying the caller of the current request (T035, ADR-011).
 * `RequestContext` (`infrastructure/logging/request-context.ts`) — where
 * `actorUserId` is actually filled in, once a future session/authentication
 * guard resolves it — lives in the top-level `infrastructure` element,
 * which `core-presentation` may not import directly under the ADR-011
 * boundary rules (only `core-infrastructure`/`module-infrastructure` may
 * reach top-level `infrastructure`). `PermissionGuard` (`core-presentation`)
 * therefore depends on this port instead;
 * `core/authorization/infrastructure/request-context-current-actor.provider.ts`
 * is the only implementation, wired in `authorization.module.ts`.
 *
 * An abstract class, not a TypeScript `interface`, so it exists at runtime
 * and can be used as a Nest DI token directly — the same pattern
 * `core/audit`'s ports use (`AuditContextPort`, `AuditEventWriterPort`).
 */
export abstract class CurrentActorPort {
  /**
   * The internal id of the user making the current request, or `undefined`
   * if no session/actor has been resolved yet (before authentication runs,
   * or outside of any request context — a script, a test). Never throws;
   * `PermissionGuard` fails closed (`UnauthorizedDomainError`) on
   * `undefined` rather than this port raising.
   */
  abstract getCurrentActorUserId(): string | undefined;
}
