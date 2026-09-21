/**
 * T066 — `LoginThrottleService` (FR-008, D-6). Owns BOTH throttling
 * dimensions:
 *
 *   - **Per-account**: `LocalCredential.failedAttempts`/`lockedUntil`
 *     (`UserDirectoryPort`) — locked after `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS`
 *     (default 5) consecutive failures, for `AUTH_LOCKOUT_MINUTES`.
 *   - **Per-origin**: a rolling cache counter keyed by IP address
 *     (`RateLimitCachePort`) — throttled after
 *     `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS` (default 20, deliberately higher —
 *     see D-6) failures from the same address across ALL accounts within
 *     `AUTH_RATE_LIMIT_WINDOW_SECONDS`.
 *
 * `assertNotThrottled` is a pre-check called BEFORE credential verification
 * (so an already-locked/throttled request never even reaches argon2) and
 * throws `RateLimitedDomainError` (429). `recordFailedAttempt`/
 * `recordSuccessfulAttempt` update state AFTER `AuthenticationProvider`
 * verdict is known.
 *
 * An unknown email is never locked (there is no `LocalCredential` row to
 * carry `failedAttempts` for) — this preserves FR-007's non-disclosure:
 * probing distinct nonexistent emails never trips the per-account
 * dimension, only ever the shared per-origin one, which is exactly the
 * "shared corporate NAT" ceiling D-6 describes, not an account-specific
 * signal.
 *
 * ## Assurance fix — lockout is now audited (confirmed gap, previously
 * silent)
 *
 * `recordFailedAttempt` emits `auth.account_locked` (entityType
 * `LOCAL_CREDENTIAL`, outcome `DENIED`) the moment a failure crosses
 * `accountAttempts` and sets `lockedUntil` for the first time — a distinct
 * fact from the `auth.login_failed`/`auth.login_failed_inactive` event
 * `AuthOrchestrator` already records for every failed attempt (locking or
 * not), so a brute-force lockout is now distinguishable in the trail from
 * an isolated wrong password. `AuditRecorder` (`core/audit/application`,
 * a different capability's `core-application`) is a legal dependency here
 * under `apps/api/eslint.config.mjs`'s boundary rules (`core-application`
 * -> `core-domain`/`core-application`, any capability) — this call relies
 * on running inside the SAME ambient transaction `AuthOrchestrator.login`
 * already opens around its own call to `recordFailedAttempt` (ADR-005);
 * `LoginThrottleService` itself never touches `PrismaService` (it cannot,
 * being `core-application`, not `core-infrastructure`).
 *
 * The credential-material rule holds here exactly as it already does for
 * `auth.login_failed`: no attempted password, no full credential row —
 * only `failedAttempts`/`lockedUntil` (already allow-listed for
 * `LOCAL_CREDENTIAL`, `core-entity-audit-allowlists.ts`) and the actor's
 * own email (identical to what `auth.login_failed` already records).
 *
 * `findActiveAccountLock` is the read-only counterpart used by
 * `AuthOrchestrator` to decide, in `assertNotThrottled`'s OWN refusal path
 * (called before any transaction is open), whether a throttled attempt is
 * refused because THIS account is already locked (worth its own audit
 * event) versus the shared per-origin ceiling (not account-specific,
 * D-6) — seeing this called is never itself audited; only the caller's own
 * decision to record something is.
 */
import { Injectable, Inject } from '@nestjs/common';
import { AuditEntityType, AuditOutcome } from '@prisma/client';

import { RateLimitedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { AUTH_THROTTLE_SETTINGS, type AuthThrottleSettings } from '../domain/identity-settings';
import { RateLimitCachePort } from '../domain/ports/rate-limit-cache.port';
import { UserDirectoryPort } from '../domain/ports/user-directory.port';

function originKey(ipAddress: string): string {
  return `auth-throttle:origin:${ipAddress}`;
}

export interface ThrottleCheckInput {
  readonly email: string;
  readonly ipAddress: string | undefined;
}

export interface RecordFailureResult {
  readonly accountFound: boolean;
  readonly userId: string | undefined;
}

/** An account's active lock, as of right now — returned only when
 * `lockedUntil` is set AND still in the future. */
export interface AccountLockState {
  readonly credentialId: string;
  readonly userId: string;
  readonly failedAttempts: number;
  readonly lockedUntil: Date;
}

@Injectable()
export class LoginThrottleService {
  constructor(
    private readonly userDirectory: UserDirectoryPort,
    private readonly rateLimitCache: RateLimitCachePort,
    private readonly auditRecorder: AuditRecorder,
    @Inject(AUTH_THROTTLE_SETTINGS) private readonly settings: AuthThrottleSettings,
  ) {}

  async assertNotThrottled(input: ThrottleCheckInput): Promise<void> {
    if (input.ipAddress) {
      const originCount = await this.rateLimitCache.peek(originKey(input.ipAddress));
      if (originCount !== undefined && originCount >= this.settings.originAttempts) {
        // Same generic message as the per-account branch below (FR-007):
        // a distinct wording per throttling reason would let a caller
        // infer whether a specific account exists from which 429 variant
        // it receives.
        throw new RateLimitedDomainError(
          USER_MESSAGES.auth.tooManyAttempts,
          this.settings.windowSeconds,
        );
      }
    }

    const record = await this.userDirectory.findAuthenticationSubject(input.email);
    if (record?.lockedUntil && record.lockedUntil.getTime() > Date.now()) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil.getTime() - Date.now()) / 1000);
      throw new RateLimitedDomainError(USER_MESSAGES.auth.tooManyAttempts, retryAfterSeconds);
    }
  }

  /** Read-only — see this file's own header for why `AuthOrchestrator`
   * calls this from `assertNotThrottled`'s OWN refusal path rather than
   * this service auditing that path itself. */
  async findActiveAccountLock(email: string): Promise<AccountLockState | undefined> {
    const record = await this.userDirectory.findAuthenticationSubject(email);
    if (record?.lockedUntil && record.lockedUntil.getTime() > Date.now()) {
      return {
        credentialId: record.credentialId,
        userId: record.userId,
        failedAttempts: record.failedAttempts,
        lockedUntil: record.lockedUntil,
      };
    }
    return undefined;
  }

  async recordFailedAttempt(input: ThrottleCheckInput): Promise<RecordFailureResult> {
    if (input.ipAddress) {
      await this.rateLimitCache.increment(originKey(input.ipAddress), this.settings.windowSeconds);
    }

    const record = await this.userDirectory.findAuthenticationSubject(input.email);
    if (!record) {
      return { accountFound: false, userId: undefined };
    }

    const failedAttempts = record.failedAttempts + 1;
    const justLocked = failedAttempts >= this.settings.accountAttempts;
    const lockedUntil = justLocked
      ? new Date(Date.now() + this.settings.lockoutMinutes * 60_000)
      : undefined;

    await this.userDirectory.recordFailedAttempt(record.credentialId, {
      failedAttempts,
      lockedUntil,
    });

    if (justLocked && lockedUntil) {
      // Assurance fix — see this file's own header. Relies on running
      // inside the ambient transaction `AuthOrchestrator.login` already
      // opened around this call (ADR-005).
      await this.auditRecorder.record({
        action: 'auth.account_locked',
        entityType: AuditEntityType.LOCAL_CREDENTIAL,
        entityId: record.credentialId,
        actorLabel: input.email,
        newValues: { failedAttempts, lockedUntil },
        outcome: AuditOutcome.DENIED,
      });
    }

    return { accountFound: true, userId: record.userId };
  }

  async recordSuccessfulAttempt(email: string): Promise<void> {
    const record = await this.userDirectory.findAuthenticationSubject(email);
    if (record) {
      await this.userDirectory.recordSuccessfulAuthentication(record.credentialId);
    }
  }
}
