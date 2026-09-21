/**
 * T059 — `LocalAuthenticationProvider` (ADR-001, FR-003, FR-005, FR-011).
 * The only operational `AuthenticationProvider` in this release. Verifies
 * an email/password pair with **argon2id** at the configured cost
 * parameters (`ARGON2_MEMORY_COST`/`ARGON2_TIME_COST`/`ARGON2_PARALLELISM`).
 *
 * ## What this class does NOT own
 *
 * Per-account lockout state (`failedAttempts`/`lockedUntil`) is owned by
 * `LoginThrottleService` (T066) and checked by `AuthOrchestrator` BEFORE
 * this provider is ever called — this class only verifies a password
 * against whatever hash is on file right now. It never mutates
 * `LocalCredential` itself.
 *
 * ## Timing-safe handling of an unknown email (defense in depth for FR-007)
 *
 * A verify call always executes against SOME argon2 hash, even when no
 * `LocalCredential` row exists for the given email — `getDummyHash()`
 * lazily computes and caches a fixed hash of a fixed value the first time
 * it is needed, so an unknown-email request costs the same argon2 work as
 * a wrong-password request against a real account. This does not, by
 * itself, satisfy FR-007 (the response body is what must be
 * indistinguishable, and it already is — see `AuthOrchestrator`); it
 * closes a lower-value but real side channel (response latency) on top of
 * that.
 */
import { Injectable, Inject } from '@nestjs/common';
import { AuthenticationMethod, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

import {
  AUTHENTICATION_PROVIDERS,
  type AuthenticationCredentials,
  type AuthenticationProvider,
  type AuthenticationResult,
} from '../../../domain/authentication-provider';
import { ARGON2_SETTINGS, type Argon2Settings } from '../../../domain/identity-settings';
import { UserDirectoryPort } from '../../../domain/ports/user-directory.port';

const DUMMY_PASSWORD_SEED = 'pharosgrc-dummy-verification-seed';

@Injectable()
export class LocalAuthenticationProvider implements AuthenticationProvider {
  readonly method = AuthenticationMethod.LOCAL;

  private dummyHash: string | undefined;

  constructor(
    private readonly userDirectory: UserDirectoryPort,
    @Inject(ARGON2_SETTINGS) private readonly argon2Settings: Argon2Settings,
  ) {}

  supports(method: AuthenticationMethod): boolean {
    return method === AuthenticationMethod.LOCAL;
  }

  async authenticate(credentials: AuthenticationCredentials): Promise<AuthenticationResult> {
    if (credentials.method !== 'LOCAL') {
      return { outcome: 'INVALID_CREDENTIALS' };
    }

    const record = await this.userDirectory.findAuthenticationSubject(credentials.email);
    const hashToVerify = record?.passwordHash ?? (await this.getDummyHash());

    const passwordMatches = await argon2
      .verify(hashToVerify, credentials.password)
      .catch(() => false);

    if (!record || !passwordMatches) {
      return { outcome: 'INVALID_CREDENTIALS' };
    }

    if (record.userStatus !== UserStatus.ACTIVE) {
      return { outcome: 'ACCOUNT_INACTIVE' };
    }

    return {
      outcome: 'AUTHENTICATED',
      subject: {
        method: AuthenticationMethod.LOCAL,
        externalSubject: record.userId,
        profile: {
          email: record.userEmail,
          fullName: record.userFullName,
          mustChangePassword: record.mustChangePassword,
        },
      },
    };
  }

  private async getDummyHash(): Promise<string> {
    this.dummyHash ??= await argon2.hash(DUMMY_PASSWORD_SEED, {
      type: argon2.argon2id,
      memoryCost: this.argon2Settings.memoryCost,
      timeCost: this.argon2Settings.timeCost,
      parallelism: this.argon2Settings.parallelism,
    });
    return this.dummyHash;
  }
}

/** Convenience re-export so `identity.module.ts` can register this as one
 * entry of the `AUTHENTICATION_PROVIDERS` array without a second import
 * line for the token. */
export { AUTHENTICATION_PROVIDERS };
