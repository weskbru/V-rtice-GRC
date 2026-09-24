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
