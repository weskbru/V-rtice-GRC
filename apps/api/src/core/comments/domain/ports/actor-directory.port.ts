/**
 * Resolves the acting user's display name for `AuditRecorder.record(...)`'s
 * required `actorLabel`. `core/comments` defines its own small copy of this
 * port, exactly like `core/authorization`/`core/organizations`/
 * `core/files` each do — see `core/authorization/domain/ports/
 * actor-directory.port.ts`'s header for why.
 */
export abstract class ActorDirectoryPort {
  abstract findActorLabel(userId: string): Promise<string | undefined>;
}
