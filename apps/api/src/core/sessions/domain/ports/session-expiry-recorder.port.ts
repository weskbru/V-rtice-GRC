/**
 * T062/T068 — the lazy-expiry audit seam (FR-014, FR-018), structurally
 * identical to `PermissionDenialRecorderPort`/`OrgScopeDenialRecorderPort`.
 *
 * `SessionService.validateSession` runs on every authenticated request, in
 * `SessionGuard` (`core/sessions/presentation`) — a request path with no
 * ambient business transaction to join. Detecting that a session has passed
 * its absolute lifetime or idle timeout still requires an atomic
 * "revoke + audit" write (ADR-005), so — exactly like the two denial
 * recorders — that write is delegated to a `core-infrastructure`
 * implementation of this port, which alone may open a dedicated short-lived
 * transaction via `PrismaService.runInTransaction`.
 */
import type { SessionRecord } from './session-repository.port';

export abstract class SessionExpiryRecorderPort {
  /**
   * Atomically marks `session` revoked with reason `EXPIRED` and records
   * the FR-018 audit event, in its own short-lived transaction. Returns the
   * updated record (or `session` unchanged if it was concurrently already
   * revoked by another request — revocation is idempotent). Never throws:
   * a failure to write is caught, logged via `AppLogger.auditOps`, and
   * swallowed (see `AuditSessionExpiryRecorder`'s header) — the caller
   * already independently knows, from the timestamps alone, that the
   * session must be refused for THIS request regardless of whether the
   * audit write itself succeeded.
   */
  abstract expireSession(session: SessionRecord): Promise<SessionRecord>;
}
