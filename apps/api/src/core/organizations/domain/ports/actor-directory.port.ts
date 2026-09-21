/**
 * T178/T179 — resolves the acting user's display name for
 * `AuditRecorder.record(...)`'s required `actorLabel`. See
 * `core/authorization/domain/ports/actor-directory.port.ts` for the full
 * rationale — `core/organizations` cannot depend on `core/identity`
 * (`IdentityModule` already imports this capability), so it reads the
 * `users` table directly, exactly like `modules/risk`'s
 * `RiskReferenceDataPort.findUser`.
 */
export abstract class ActorDirectoryPort {
  abstract findActorLabel(userId: string): Promise<string | undefined>;
}
