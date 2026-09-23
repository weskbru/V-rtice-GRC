import { Injectable } from '@nestjs/common';
import { AuthenticationMethod, UserStatus } from '@prisma/client';

import { UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { UserDirectoryPort, type UserIdentitySummary } from '../domain/ports/user-directory.port';

import type { VerifiedExternalSubject } from '../domain/authentication-provider';

export class UnsupportedAuthenticationMethodError extends Error {
  constructor(method: AuthenticationMethod) {
    super(`No identity-resolution strategy is implemented for authentication method "${method}".`);
  }
}

@Injectable()
export class IdentityResolverService {
  constructor(private readonly userDirectory: UserDirectoryPort) {}

  async resolve(subject: VerifiedExternalSubject): Promise<UserIdentitySummary> {
    if (subject.method !== AuthenticationMethod.LOCAL) {
      throw new UnsupportedAuthenticationMethodError(subject.method);
    }

    const identity = await this.userDirectory.findIdentitySummary(subject.externalSubject);
    if (identity?.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedDomainError();
    }

    return identity;
  }
}
