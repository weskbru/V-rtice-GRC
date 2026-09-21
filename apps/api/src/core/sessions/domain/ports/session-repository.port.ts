/**
 * T062 — persistence port for `Session` (ADR-002, data-model.md §2).
 * `core/sessions/application` depends on this abstract class — never on
 * `PrismaService` directly (ADR-011). `PrismaSessionRepository`
 * (`core/sessions/infrastructure`) is the only implementation.
 */
import type { AuthenticationMethod, SessionRevocationReason } from '@prisma/client';

export interface SessionRecord {
  readonly id: string;
  readonly tokenHash: string;
  readonly userId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastActivityAt: Date;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
  readonly revokedAt: Date | undefined;
  readonly revokedReason: SessionRevocationReason | undefined;
}

/**
 * S-01 (audit A6-F01) — `findByTokenHash`'s own return shape, extending
 * `SessionRecord` with the owning user's `LocalCredential.mustChangePassword`.
 * A dedicated type rather than adding the field to `SessionRecord` itself:
 * `create`/`markRevoked`/`markRevokedForUser` describe the `Session` row
 * only (no join), and `findByTokenHash` is `SessionService`'s only caller
 * that needs this flag (`validateSession`, to populate
 * `ValidatedSession.mustChangePassword`) — extending every method's return
 * type would force an unnecessary join onto revocation paths that have no
 * use for it.
 */
export interface SessionRecordWithCredentialFlags extends SessionRecord {
  readonly mustChangePassword: boolean;
}

export interface CreateSessionInput {
  readonly tokenHash: string;
  readonly userId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastActivityAt: Date;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
}

export abstract class SessionRepositoryPort {
  abstract create(input: CreateSessionInput): Promise<SessionRecord>;

  /** Returns the row regardless of its revoked/expired state — the caller
   * (`SessionService`) is responsible for deciding validity; the repository
   * never filters that out, so a lookup can never be mistaken for "does not
   * exist" when it is actually "exists but is no longer valid". Also joins
   * the owning user's `LocalCredential.mustChangePassword` (S-01) — a
   * single query, not a second round-trip; a user with no local credential
   * (a federated identity, not implemented in this release) reads as
   * `false`. */
  abstract findByTokenHash(
    tokenHash: string,
  ): Promise<SessionRecordWithCredentialFlags | undefined>;

  /** Written at most once per minute by the caller (`SessionService`) —
   * FR-014's sliding expiry, kept cheap by not writing on every request. */
  abstract touchLastActivity(sessionId: string, at: Date): Promise<void>;

  /** No-op (returns `undefined`) if the session does not exist or is
   * already revoked — revocation is idempotent by construction. */
  abstract markRevoked(
    sessionId: string,
    reason: SessionRevocationReason,
    at: Date,
  ): Promise<SessionRecord | undefined>;

  /** Revokes every currently-active session for `userId` (FR-017: user
   * deactivation, own-password change) and returns the rows that were
   * actually revoked (already-revoked sessions are excluded, not
   * re-revoked/re-audited). */
  abstract markRevokedForUser(
    userId: string,
    reason: SessionRevocationReason,
    at: Date,
  ): Promise<readonly SessionRecord[]>;
}
