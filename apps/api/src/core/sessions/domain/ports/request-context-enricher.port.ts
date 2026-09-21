/**
 * T064 — write-side counterpart to `CurrentActorPort`
 * (`core/authorization/domain/ports/current-actor.port.ts`). `SessionGuard`
 * (`core/sessions/presentation`) is what FIRST learns the caller's actor
 * id/session id/authentication method on a request, and must publish them
 * into the ambient `RequestContext` for every guard/service/audit call
 * downstream to read — but `infrastructure/logging/request-context.ts` is
 * the top-level `infrastructure` element, which `core-presentation` may
 * never import under the ADR-011 boundary rules. This port is the
 * sanctioned indirection, mirrored on `RequestContextEnricherAdapter`
 * (`core/sessions/infrastructure`), the only implementation.
 *
 * `actorUserId` is OPTIONAL (unlike `sessionId`/`authMethod`): a caller may
 * legitimately know the session but not have an identified human actor to
 * attribute — `AuditSessionExpiryRecorder` (D-13/FR-028) is exactly this
 * case, a system-discovered lifecycle event with no human initiator. Such a
 * caller omits `actorUserId` entirely rather than passing a value it does
 * not actually have.
 */
export interface RequestContextEnrichment {
  readonly actorUserId?: string;
  readonly sessionId: string;
  readonly authMethod: string;
}

export abstract class RequestContextEnricherPort {
  abstract enrich(fields: RequestContextEnrichment): void;
}
