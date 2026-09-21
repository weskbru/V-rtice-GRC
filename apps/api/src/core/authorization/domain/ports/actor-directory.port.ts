/**
 * T177 — resolves the acting user's display name for
 * `AuditRecorder.record(...)`'s required `actorLabel` (data-model.md §5:
 * "denormalized display name ... captured at the moment of the action so
 * history reads correctly even after the actor is later renamed or
 * deactivated").
 *
 * `core/authorization` cannot depend on `core/identity` (the reverse
 * direction is the one already wired — `IdentityModule` imports
 * `AuthorizationModule` — and NestJS module imports must not cycle), so
 * this capability reads the `users` table directly for this one reference
 * lookup, exactly the way `modules/risk`'s `RiskReferenceDataPort.findUser`
 * reads a table it does not "own" for referential-integrity/display
 * purposes. `core/organizations` defines its own identical copy for the
 * same reason (`org-unit-admin.service.ts`/`scope-grant.service.ts`).
 */
export abstract class ActorDirectoryPort {
  /** `undefined` only if `userId` does not exist — defensive; every real
   * caller has already passed `SessionGuard`, so this should not happen in
   * practice, but callers must not fabricate a label if it does. */
  abstract findActorLabel(userId: string): Promise<string | undefined>;
}
