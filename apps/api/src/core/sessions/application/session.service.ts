/**
 * T062 — `SessionService` (ADR-002, FR-012 to FR-018, FR-020).
 *
 * Owns the full session lifecycle: create, validate (with sliding-expiry
 * "touch"), and revoke (single or bulk). Depends only on
 * `SessionRepositoryPort` (PostgreSQL, authoritative), `SessionCachePort`
 * (validation cache only) and `SessionExpiryRecorderPort` (the lazy-expiry
 * audit seam) — never on `PrismaService` directly (ADR-011): every method
 * that must be atomic with an `AuditRecorder.record(...)` call relies on
 * being invoked from inside an ambient `PrismaService.runInTransaction(...)`
 * scope opened by its caller (`AuthOrchestrator`, `core/identity/infrastructure`),
 * exactly like `AuditRecorder` itself.
 *
 * `AuditRecorder` (core-application, a DIFFERENT capability) is a legal
 * dependency here: the ADR-011 policy for `core-application -> core-domain,
 * core-application` carries no same-capability restriction.
 */
import { Injectable, Inject } from '@nestjs/common';
import {
  AuditEntityType,
  AuditOutcome,
  SessionRevocationReason,
  type AuthenticationMethod,
} from '@prisma/client';

import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { RequestContextEnricherPort } from '../domain/ports/request-context-enricher.port';
import { SessionCachePort, type CachedSessionSnapshot } from '../domain/ports/session-cache.port';
import { SessionExpiryRecorderPort } from '../domain/ports/session-expiry-recorder.port';
import { SessionRepositoryPort, type SessionRecord } from '../domain/ports/session-repository.port';
import { generateOpaqueSessionToken, hashSessionToken } from '../domain/session-cookie';
import { SESSION_SETTINGS, type SessionSettings } from '../domain/session-settings';

/** Cache TTL for a validation snapshot. Deliberately short and independent
 * of the session's own lifetime — see `SessionCachePort`'s header: this is
 * defense-in-depth staleness bounding, never the mechanism that makes
 * revocation take effect (that is the synchronous `cache.del` on every
 * revocation path). Matches the "touch at most once per minute" granularity
 * FR-014 already accepts. */
const SESSION_CACHE_TTL_SECONDS = 60;

/** FR-014: write `lastActivityAt` at most once per minute. */
const TOUCH_INTERVAL_MS = 60_000;

const REVOCATION_AUDIT_ACTION: Record<SessionRevocationReason, string> = {
  LOGOUT: 'auth.logout',
  EXPIRED: 'session.expired',
  ADMIN_REVOKED: 'session.revoked',
  USER_DEACTIVATED: 'session.revoked',
  PASSWORD_CHANGED: 'session.revoked',
};

export interface CreateSessionCommand {
  readonly userId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
  readonly actorLabel: string;
}

export interface CreatedSession {
  readonly session: SessionRecord;
  readonly rawToken: string;
}

export type SessionValidationFailureReason = 'NOT_FOUND' | 'REVOKED' | 'EXPIRED';

export interface ValidatedSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastActivityAt: Date;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
  /**
   * S-01 (audit A6-F01) — mirrors `LocalCredential.mustChangePassword` for
   * this session's user at the moment the session was validated. Read by
   * `MandatoryPasswordChangeGuard` (`core/sessions/presentation`), which
   * runs immediately after `SessionGuard` in the global guard chain
   * (`app.module.ts`) and refuses every non-exempt route while this is
   * `true`. Safe to cache alongside the rest of this snapshot
   * (`CachedSessionSnapshot`) because every code path that changes
   * `mustChangePassword` (`AuthOrchestrator.changeOwnPassword`,
   * `ResetUserPasswordUseCase`) also calls `revokeAllForUser`, which
   * synchronously deletes every cache entry for that user before returning
   * — so a cached value can never disagree with the database's current
   * `mustChangePassword` for a session that is still valid.
   */
  readonly mustChangePassword: boolean;
}

export type SessionValidationResult =
  | { readonly valid: true; readonly session: ValidatedSession }
  | { readonly valid: false; readonly reason: SessionValidationFailureReason };

@Injectable()
export class SessionService {
  constructor(
    private readonly repository: SessionRepositoryPort,
    private readonly cache: SessionCachePort,
    private readonly expiryRecorder: SessionExpiryRecorderPort,
    private readonly auditRecorder: AuditRecorder,
    private readonly requestContextEnricher: RequestContextEnricherPort,
    @Inject(SESSION_SETTINGS) private readonly settings: SessionSettings,
  ) {}

  /**
   * Creates a new session row and its FR-018 `session.created` audit event.
   * Must be called from inside the caller's `runInTransaction` scope.
   * Deliberately does NOT populate the cache (see `warmCache`) — a cache
   * write here could survive a later rollback of the same transaction.
   *
   * D-13/V2/FR-026: the login route is `@Public()`, so `SessionGuard` —
   * the only other caller of `RequestContextEnricherPort.enrich(...)` —
   * never runs on it, and every `session.created` row was written with
   * `actor_user_id`/`session_id` NULL despite `ip_address`/`user_agent`
   * being populated by `RequestContextMiddleware` regardless of guards
   * (measured: 1466/1466 rows, research.md D-13). This is the ONE
   * production call site of `createSession` (`AuthOrchestrator`, the login
   * use case) at the moment the session — and therefore the actor and
   * session id an audit event could ever attribute to — first exists, so
   * enriching here, immediately before the audit event below, fixes every
   * caller at once rather than duplicating the call at the login site.
   * The identity enriched is `session.userId`/`session.id`, both resolved
   * server-side by `repository.create` above from the already-authenticated
   * command — never a client-supplied value (CLAUDE.md §19.9, applied here
   * by analogy to any audit attribution, not only AI-authored writes).
   */
  async createSession(command: CreateSessionCommand): Promise<CreatedSession> {
    const rawToken = generateOpaqueSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.settings.absoluteLifetimeHours * 60 * 60 * 1000,
    );

    const session = await this.repository.create({
      tokenHash,
      userId: command.userId,
      authenticationMethod: command.authenticationMethod,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    this.requestContextEnricher.enrich({
      actorUserId: session.userId,
      sessionId: session.id,
      authMethod: session.authenticationMethod,
    });

    await this.auditRecorder.record({
      action: 'session.created',
      entityType: AuditEntityType.SESSION,
      entityId: session.id,
      actorLabel: command.actorLabel,
      newValues: {
        authenticationMethod: session.authenticationMethod,
        expiresAt: session.expiresAt,
        lastActivityAt: session.lastActivityAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
      outcome: AuditOutcome.SUCCESS,
    });

    return { session, rawToken };
  }

  /** Populates the validation cache for a session whose creating
   * transaction has already committed (see `createSession`'s header).
   * `mustChangePassword` is supplied by the caller (`AuthOrchestrator`,
   * which already resolved it while authenticating this login) rather than
   * re-queried here — `createSession`/`SessionRecord` describe the
   * `Session` row only, which has no such column (S-01: the flag lives on
   * `LocalCredential`). */
  async warmCache(session: SessionRecord, mustChangePassword: boolean): Promise<void> {
    await this.cache.set(
      session.tokenHash,
      this.toSnapshot(session, mustChangePassword),
      SESSION_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Validates a raw cookie token: not-found/revoked/expired is refused
   * (FR-015); an absolute or idle expiry discovered here is persisted and
   * audited via `SessionExpiryRecorderPort` (own short-lived transaction —
   * this method itself has no ambient one, being called from `SessionGuard`
   * on every request). On success, applies the FR-014 sliding-expiry
   * "touch" (DB write at most once per minute) and refreshes the cache.
   */
  async validateSession(rawToken: string): Promise<SessionValidationResult> {
    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();

    const cached = await this.cache.get(tokenHash);
    if (cached) {
      const expiryCheck = this.checkExpiry(cached.expiresAt, cached.lastActivityAt, now);
      if (expiryCheck !== undefined) {
        // A cached snapshot can never disagree with Postgres about
        // `revokedAt` (the cache is proactively deleted on every
        // revocation), but expiry is time-based and must be re-checked
        // regardless of source — fetch the real row to expire it.
        const record = await this.repository.findByTokenHash(tokenHash);
        if (record && !record.revokedAt) {
          await this.expiryRecorder.expireSession(record);
        }
        await this.cache.del(tokenHash);
        return { valid: false, reason: expiryCheck };
      }

      await this.maybeTouch(tokenHash, cached, now);

      return {
        valid: true,
        session: {
          sessionId: cached.sessionId,
          userId: cached.userId,
          authenticationMethod: cached.authenticationMethod,
          createdAt: new Date(cached.createdAt),
          expiresAt: new Date(cached.expiresAt),
          lastActivityAt:
            now.getTime() - new Date(cached.lastActivityAt).getTime() >= TOUCH_INTERVAL_MS
              ? now
              : new Date(cached.lastActivityAt),
          ipAddress: cached.ipAddress,
          userAgent: cached.userAgent,
          mustChangePassword: cached.mustChangePassword,
        },
      };
    }

    const record = await this.repository.findByTokenHash(tokenHash);
    if (!record) {
      return { valid: false, reason: 'NOT_FOUND' };
    }
    if (record.revokedAt) {
      return { valid: false, reason: 'REVOKED' };
    }

    const expiryCheck = this.checkExpiry(
      record.expiresAt.toISOString(),
      record.lastActivityAt.toISOString(),
      now,
    );
    if (expiryCheck !== undefined) {
      await this.expiryRecorder.expireSession(record);
      return { valid: false, reason: expiryCheck };
    }

    const lastActivityAt = await this.maybeTouchRecord(record, now);
    await this.cache.set(
      tokenHash,
      this.toSnapshot({ ...record, lastActivityAt }, record.mustChangePassword),
      SESSION_CACHE_TTL_SECONDS,
    );

    return {
      valid: true,
      session: {
        sessionId: record.id,
        userId: record.userId,
        authenticationMethod: record.authenticationMethod,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        lastActivityAt,
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
        mustChangePassword: record.mustChangePassword,
      },
    };
  }

  /** Revokes exactly one session (logout, or a future admin revoke) and
   * records its FR-018 audit event. Must be called from inside the
   * caller's `runInTransaction` scope. No-op (returns `undefined`) if
   * already revoked or missing — revocation is idempotent. */
  async revokeSession(
    sessionId: string,
    reason: SessionRevocationReason,
    actorLabel: string,
  ): Promise<SessionRecord | undefined> {
    const revoked = await this.repository.markRevoked(sessionId, reason, new Date());
    if (!revoked) {
      return undefined;
    }

    await this.auditRecorder.record({
      action: REVOCATION_AUDIT_ACTION[reason],
      entityType: AuditEntityType.SESSION,
      entityId: revoked.id,
      actorLabel,
      newValues: { revokedAt: revoked.revokedAt, revokedReason: revoked.revokedReason },
      outcome: AuditOutcome.SUCCESS,
    });

    await this.cache.del(revoked.tokenHash);
    return revoked;
  }

  /** Revokes EVERY currently-active session for `userId` (FR-017: user
   * deactivation, own-password change — always all sessions, including the
   * one making the request, per auth.openapi.yaml). Must be called from
   * inside the caller's `runInTransaction` scope. */
  async revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    actorLabel: string,
  ): Promise<readonly SessionRecord[]> {
    const revoked = await this.repository.markRevokedForUser(userId, reason, new Date());

    for (const session of revoked) {
      await this.auditRecorder.record({
        action: REVOCATION_AUDIT_ACTION[reason],
        entityType: AuditEntityType.SESSION,
        entityId: session.id,
        actorLabel,
        newValues: { revokedAt: session.revokedAt, revokedReason: session.revokedReason },
        outcome: AuditOutcome.SUCCESS,
      });
      await this.cache.del(session.tokenHash);
    }

    return revoked;
  }

  /** `undefined` when still valid; otherwise the specific reason it is not. */
  private checkExpiry(
    expiresAtIso: string,
    lastActivityAtIso: string,
    now: Date,
  ): SessionValidationFailureReason | undefined {
    if (now.getTime() >= new Date(expiresAtIso).getTime()) {
      return 'EXPIRED';
    }
    const idleMs = now.getTime() - new Date(lastActivityAtIso).getTime();
    if (idleMs >= this.settings.idleTimeoutMinutes * 60_000) {
      return 'EXPIRED';
    }
    return undefined;
  }

  private async maybeTouch(
    tokenHash: string,
    cached: CachedSessionSnapshot,
    now: Date,
  ): Promise<void> {
    if (now.getTime() - new Date(cached.lastActivityAt).getTime() < TOUCH_INTERVAL_MS) {
      return;
    }
    await this.repository.touchLastActivity(cached.sessionId, now);
    await this.cache.set(
      tokenHash,
      { ...cached, lastActivityAt: now.toISOString() },
      SESSION_CACHE_TTL_SECONDS,
    );
  }

  private async maybeTouchRecord(record: SessionRecord, now: Date): Promise<Date> {
    if (now.getTime() - record.lastActivityAt.getTime() < TOUCH_INTERVAL_MS) {
      return record.lastActivityAt;
    }
    await this.repository.touchLastActivity(record.id, now);
    return now;
  }

  private toSnapshot(session: SessionRecord, mustChangePassword: boolean): CachedSessionSnapshot {
    return {
      sessionId: session.id,
      userId: session.userId,
      authenticationMethod: session.authenticationMethod,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      mustChangePassword,
    };
  }
}
