/**
 * T062 — validation-cache port for sessions (ADR-002: "Redis mirrors active
 * sessions ... as a validation cache only"). `core/sessions/application`
 * cannot depend on `CacheProvider` (top-level `infrastructure`) directly
 * under ADR-011 — `CacheProviderSessionCacheAdapter`
 * (`core/sessions/infrastructure`) is the only implementation, mirroring
 * `PermissionCachePort`/`ScopeCachePort`'s already-established shape.
 *
 * ## How this design guarantees a stale cache entry never resurrects a
 * revoked session (the task's explicit requirement)
 *
 * A cache entry is written ONLY in two places: (1) after a session is
 * created and its creating transaction has committed
 * (`SessionService.warmCache`, called post-commit — never from inside the
 * write transaction itself, so a rolled-back creation can never leave a
 * phantom cache entry), and (2) as a refresh of `lastActivityAt` on an
 * already-valid session. It is DELETED, synchronously, as part of every
 * revocation path (`SessionService.revokeSession`/`revokeAllForUser`/the
 * lazy-expiry path) before that path's response is returned to the caller.
 * Because HTTP requests are strictly sequential per client connection — the
 * client can only send its next request after the revoking request's
 * response (which already awaited the cache deletion) comes back — the very
 * next request against that session is GUARANTEED to see a cache miss and
 * fall back to `SessionRepositoryPort` (PostgreSQL, always authoritative),
 * which already reflects `revokedAt`. There is no TTL-based "eventually
 * consistent" window this design relies on for correctness; the short TTL
 * below is defense-in-depth only (bounding staleness for the idle-timeout
 * check, not for the revoked/not-revoked decision itself, which is never
 * read from a value the cache could still be holding after deletion).
 */
import type { AuthenticationMethod } from '@prisma/client';

/** Minimal validation snapshot — never the raw token, never PII beyond what
 * a validation decision needs. `expiresAt`/`lastActivityAt` are ISO strings
 * (cache values must be JSON-serializable across both adapters). */
export interface CachedSessionSnapshot {
  readonly sessionId: string;
  readonly userId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastActivityAt: string;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
  /** S-01 — see `ValidatedSession.mustChangePassword`'s doc comment
   * (`session.service.ts`) for why caching this value alongside the rest of
   * the snapshot can never go stale while the session itself is valid. */
  readonly mustChangePassword: boolean;
}

export abstract class SessionCachePort {
  abstract get(tokenHash: string): Promise<CachedSessionSnapshot | undefined>;
  abstract set(
    tokenHash: string,
    snapshot: CachedSessionSnapshot,
    ttlSeconds: number,
  ): Promise<void>;
  abstract del(tokenHash: string): Promise<void>;
}
