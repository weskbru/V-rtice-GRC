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

const SESSION_CACHE_TTL_SECONDS = 60;

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

  async warmCache(session: SessionRecord, mustChangePassword: boolean): Promise<void> {
    await this.cache.set(
      session.tokenHash,
      this.toSnapshot(session, mustChangePassword),
      SESSION_CACHE_TTL_SECONDS,
    );
  }

  async validateSession(rawToken: string): Promise<SessionValidationResult> {
    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();

    const cached = await this.cache.get(tokenHash);
    if (cached) {
      const expiryCheck = this.checkExpiry(cached.expiresAt, cached.lastActivityAt, now);
      if (expiryCheck !== undefined) {
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
