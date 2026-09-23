import { AuditEntityType, AuditOutcome } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuditRecorder } from '../../src/core/audit/application/audit-recorder.service';
import {
  __resetAuditFieldAllowlistRegistryForTests,
  registerAuditFieldAllowlist,
} from '../../src/core/audit/domain/audit-field-allowlist';
import { LoginThrottleService } from '../../src/core/identity/application/login-throttle.service';
import { RateLimitCachePort } from '../../src/core/identity/domain/ports/rate-limit-cache.port';
import { UserDirectoryPort } from '../../src/core/identity/domain/ports/user-directory.port';
import { RateLimitedDomainError } from '../../src/shared/errors/domain-error';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';

import type { AuditEventRecord } from '../../src/core/audit/domain/audit-event.types';
import type { AuditContextPort } from '../../src/core/audit/domain/ports/audit-context.port';
import type { AuditEventWriterPort } from '../../src/core/audit/domain/ports/audit-event-writer.port';
import type { AuthThrottleSettings } from '../../src/core/identity/domain/identity-settings';
import type {
  AdminUserRecord,
  ListAdminUsersResult,
  ListDirectoryUsersResult,
  LocalAuthenticationSubject,
  LocalCredentialSummary,
  PreviousProfileFields,
  UserIdentitySummary,
  UserProfile,
} from '../../src/core/identity/domain/ports/user-directory.port';
import type { UserStatus } from '@prisma/client';

const NOT_USED = (): never => {
  throw new Error('Not used by this test.');
};

interface FakeAccount {
  userId: string;
  credentialId: string;
  failedAttempts: number;
  lockedUntil: Date | undefined;
}

class FakeUserDirectory extends UserDirectoryPort {
  readonly accountsByEmail = new Map<string, FakeAccount>();
  readonly recordFailedAttemptCalls: {
    credentialId: string;
    failedAttempts: number;
    lockedUntil: Date | undefined;
  }[] = [];

  addAccount(email: string, account: FakeAccount): void {
    this.accountsByEmail.set(email, account);
  }

  findAuthenticationSubject(email: string): Promise<LocalAuthenticationSubject | undefined> {
    const account = this.accountsByEmail.get(email);
    if (!account) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve({
      userId: account.userId,
      userStatus: 'ACTIVE',
      userFullName: 'Fixture User',
      userEmail: email,
      credentialId: account.credentialId,
      passwordHash: 'irrelevant-for-this-test',
      failedAttempts: account.failedAttempts,
      lockedUntil: account.lockedUntil,
      mustChangePassword: false,
    });
  }

  recordFailedAttempt(
    credentialId: string,
    input: { failedAttempts: number; lockedUntil: Date | undefined },
  ): Promise<void> {
    this.recordFailedAttemptCalls.push({ credentialId, ...input });
    for (const account of this.accountsByEmail.values()) {
      if (account.credentialId === credentialId) {
        account.failedAttempts = input.failedAttempts;
        account.lockedUntil = input.lockedUntil;
      }
    }
    return Promise.resolve();
  }

  recordSuccessfulAuthentication(): Promise<void> {
    return Promise.resolve();
  }

  findIdentitySummary(): Promise<UserIdentitySummary | undefined> {
    return NOT_USED();
  }
  findProfileById(): Promise<UserProfile | undefined> {
    return NOT_USED();
  }
  findLocalCredentialByUserId(): Promise<LocalCredentialSummary | undefined> {
    return NOT_USED();
  }
  touchLastLoginAt(): Promise<void> {
    return NOT_USED();
  }
  updatePassword(): Promise<void> {
    return NOT_USED();
  }
  setStatus(): Promise<UserStatus | undefined> {
    return NOT_USED();
  }
  listDirectory(): Promise<ListDirectoryUsersResult> {
    return NOT_USED();
  }
  findByEmail(): Promise<{ id: string } | undefined> {
    return NOT_USED();
  }
  createUserWithCredential(): Promise<AdminUserRecord> {
    return NOT_USED();
  }
  updateProfile(): Promise<PreviousProfileFields | undefined> {
    return NOT_USED();
  }
  listAdmin(): Promise<ListAdminUsersResult> {
    return NOT_USED();
  }
  findAdminRecordById(): Promise<AdminUserRecord | undefined> {
    return NOT_USED();
  }
  findOrgUnitForValidation(): Promise<
    { readonly id: string; readonly isActive: boolean } | undefined
  > {
    return NOT_USED();
  }
}

class FakeRateLimitCache extends RateLimitCachePort {
  private readonly counters = new Map<string, number>();

  peek(key: string): Promise<number | undefined> {
    return Promise.resolve(this.counters.get(key));
  }

  increment(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return Promise.resolve(next);
  }
}

function createFakeAuditRecorder(): { recorder: AuditRecorder; events: AuditEventRecord[] } {
  const events: AuditEventRecord[] = [];
  const writer: AuditEventWriterPort = {
    write: (event: AuditEventRecord) => {
      events.push(event);
      return Promise.resolve();
    },
  };
  const context: AuditContextPort = { current: () => undefined };
  return { recorder: new AuditRecorder(writer, context), events };
}

const SETTINGS: AuthThrottleSettings = {
  accountAttempts: 3,
  originAttempts: 5,
  windowSeconds: 300,
  lockoutMinutes: 15,
};

describe('LoginThrottleService (assurance fix — audit + tests for account lockout)', () => {
  beforeEach(() => {
    __resetAuditFieldAllowlistRegistryForTests();
    registerAuditFieldAllowlist(AuditEntityType.LOCAL_CREDENTIAL, [
      'failedAttempts',
      'lockedUntil',
    ]);
  });

  function buildService(): {
    service: LoginThrottleService;
    directory: FakeUserDirectory;
    cache: FakeRateLimitCache;
    events: AuditEventRecord[];
  } {
    const directory = new FakeUserDirectory();
    const cache = new FakeRateLimitCache();
    const { recorder, events } = createFakeAuditRecorder();
    const service = new LoginThrottleService(directory, cache, recorder, SETTINGS);
    return { service, directory, cache, events };
  }

  it('locks the account after exactly `accountAttempts` failures, and audits it as auth.account_locked (LOCAL_CREDENTIAL, DENIED)', async () => {
    const { service, directory, events } = buildService();
    directory.addAccount('locked@example.test', {
      userId: 'user-1',
      credentialId: 'credential-1',
      failedAttempts: 0,
      lockedUntil: undefined,
    });

    await service.recordFailedAttempt({ email: 'locked@example.test', ipAddress: '10.0.0.1' });
    await service.recordFailedAttempt({ email: 'locked@example.test', ipAddress: '10.0.0.1' });
    expect(events).toHaveLength(0);
    await expect(
      service.assertNotThrottled({ email: 'locked@example.test', ipAddress: '10.0.0.1' }),
    ).resolves.toBeUndefined();

    await service.recordFailedAttempt({ email: 'locked@example.test', ipAddress: '10.0.0.1' });

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.action).toBe('auth.account_locked');
    expect(event.entityType).toBe(AuditEntityType.LOCAL_CREDENTIAL);
    expect(event.entityId).toBe('credential-1');
    expect(event.outcome).toBe(AuditOutcome.DENIED);
    expect(event.newValues).toMatchObject({ failedAttempts: 3 });
    expect(event.newValues?.lockedUntil).toBeInstanceOf(Date);
    expect(event.newValues).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(event.newValues)).not.toMatch(/password/i);

    await expect(
      service.assertNotThrottled({ email: 'locked@example.test', ipAddress: '10.0.0.1' }),
    ).rejects.toBeInstanceOf(RateLimitedDomainError);
  });

  it('a further failed attempt while already locked does not emit a second auth.account_locked event', async () => {
    const { service, directory, events } = buildService();
    directory.addAccount('already-locked@example.test', {
      userId: 'user-2',
      credentialId: 'credential-2',
      failedAttempts: 3,
      lockedUntil: new Date(Date.now() + 60_000),
    });

    await service.recordFailedAttempt({
      email: 'already-locked@example.test',
      ipAddress: '10.0.0.2',
    });

    const lockEvents = events.filter((e) => e.action === 'auth.account_locked');
    expect(lockEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('the lock expires after its window — no real wait, a `lockedUntil` already in the past is treated as unlocked', async () => {
    const { service, directory } = buildService();
    directory.addAccount('expired-lock@example.test', {
      userId: 'user-3',
      credentialId: 'credential-3',
      failedAttempts: 3,
      lockedUntil: new Date(Date.now() - 1_000),
    });

    await expect(
      service.assertNotThrottled({ email: 'expired-lock@example.test', ipAddress: '10.0.0.3' }),
    ).resolves.toBeUndefined();
  });

  it('an unknown email never creates a lock and is never audited, however many times it fails (FR-007)', async () => {
    const { service, directory, events } = buildService();

    for (let i = 0; i < SETTINGS.accountAttempts + 5; i += 1) {
      const result = await service.recordFailedAttempt({
        email: 'nobody@example.test',
        ipAddress: `10.1.0.${String(i)}`,
      });
      expect(result.accountFound).toBe(false);
    }

    expect(directory.recordFailedAttemptCalls).toHaveLength(0);
    expect(events).toHaveLength(0);
    await expect(
      service.assertNotThrottled({ email: 'nobody@example.test', ipAddress: '10.1.0.99' }),
    ).resolves.toBeUndefined();
  });

  it('the per-origin cap trips across DISTINCT accounts sharing an IP, refusing a brand-new account from that address', async () => {
    const { service, directory } = buildService();
    const sharedIp = '198.51.100.7';

    directory.addAccount('victim-a@example.test', {
      userId: 'user-a',
      credentialId: 'credential-a',
      failedAttempts: 0,
      lockedUntil: undefined,
    });
    directory.addAccount('victim-b@example.test', {
      userId: 'user-b',
      credentialId: 'credential-b',
      failedAttempts: 0,
      lockedUntil: undefined,
    });

    for (let i = 0; i < SETTINGS.originAttempts; i += 1) {
      const email = i % 2 === 0 ? 'victim-a@example.test' : 'victim-b@example.test';
      await service.recordFailedAttempt({ email, ipAddress: sharedIp });
    }

    await expect(
      service.assertNotThrottled({ email: 'unrelated@example.test', ipAddress: sharedIp }),
    ).rejects.toBeInstanceOf(RateLimitedDomainError);

    await expect(
      service.assertNotThrottled({ email: 'unrelated@example.test', ipAddress: '203.0.113.9' }),
    ).resolves.toBeUndefined();
  });

  it('refuses with the IDENTICAL generic message whether the reason is a per-account lock or the shared per-origin ceiling (FR-007 regression guard)', async () => {
    const { service: accountService, directory } = buildService();
    directory.addAccount('locked-message@example.test', {
      userId: 'user-4',
      credentialId: 'credential-4',
      failedAttempts: 3,
      lockedUntil: new Date(Date.now() + 60_000),
    });

    let accountLockedMessage: string | undefined;
    try {
      await accountService.assertNotThrottled({
        email: 'locked-message@example.test',
        ipAddress: '10.2.0.1',
      });
    } catch (error) {
      accountLockedMessage = error instanceof RateLimitedDomainError ? error.message : undefined;
    }

    const { service: originService } = buildService();
    for (let i = 0; i < SETTINGS.originAttempts; i += 1) {
      await originService.recordFailedAttempt({
        email: `origin-flood-${String(i)}@example.test`,
        ipAddress: '10.2.0.2',
      });
    }
    let originThrottledMessage: string | undefined;
    try {
      await originService.assertNotThrottled({
        email: 'yet-another@example.test',
        ipAddress: '10.2.0.2',
      });
    } catch (error) {
      originThrottledMessage = error instanceof RateLimitedDomainError ? error.message : undefined;
    }

    expect(accountLockedMessage).toBeDefined();
    expect(originThrottledMessage).toBeDefined();
    expect(accountLockedMessage).toBe(originThrottledMessage);
    expect(accountLockedMessage).toBe(USER_MESSAGES.auth.tooManyAttempts);
  });
});
