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

const DUMMY_PASSWORD_SEED = 'verticegrc-dummy-verification-seed';

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

export { AUTHENTICATION_PROVIDERS };
