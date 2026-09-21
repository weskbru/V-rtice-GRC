/**
 * Resolves the acting user's display name for `AuditRecorder.record(...)`'s
 * required `actorLabel` (data-model.md §5). `core/files` cannot depend on
 * `core/identity` for the reasons `core/authorization`'s own
 * `ActorDirectoryPort` already documents (avoiding an import cycle) — this
 * capability defines the identical small port and reads the `users` table
 * directly, exactly like `core/authorization`/`core/organizations` each do.
 */
export abstract class ActorDirectoryPort {
  /** `undefined` only if `userId` does not exist — defensive; every real
   * caller has already passed `SessionGuard`, so this should not happen in
   * practice, but callers must not fabricate a label if it does. */
  abstract findActorLabel(userId: string): Promise<string | undefined>;
}
