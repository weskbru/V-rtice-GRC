/**
 * T061 — `IdentityResolverService` (ADR-001). Maps a provider-verified
 * `VerifiedExternalSubject` to the internal `User` — the ONLY identity any
 * business module (or, in this release, the rest of the auth flow past this
 * point) ever sees.
 *
 * ## Why `LOCAL` is resolved by construction, with no `ExternalIdentity` lookup
 *
 * `LocalAuthenticationProvider` already IS operating against the internal
 * `User`/`LocalCredential` tables — local authentication has no separate
 * external system to be a subject of. Its `VerifiedExternalSubject.externalSubject`
 * is therefore the `User.id` itself (see `authentication-provider.ts`'s
 * header), and resolving it is a direct, trivial lookup — no
 * `ExternalIdentity` row is created or consulted for `LOCAL`.
 *
 * ## Where a future federated provider's resolution differs (documented,
 * not implemented — no LDAP/OIDC/SAML code exists in this release)
 *
 * A future `LDAP`/`ACTIVE_DIRECTORY`/`OIDC`/`SAML` subject's
 * `externalSubject` is a value meaningful only to that external system
 * (e.g. an LDAP DN, an OIDC `sub` claim) — resolving it means looking up
 * `ExternalIdentity` by the unique `(method, externalSubject)` pair
 * (data-model.md §1) already modeled in the schema for exactly this
 * purpose, and, on a first-time sign-in with no existing link, either
 * just-in-time provisioning a new `User` (a policy decision reviewed on its
 * own merits when that provider is built — see ADR-001's alternatives
 * table) or refusing. That branch is deliberately NOT implemented as a
 * silent fallback here: `resolve` throws `UnsupportedAuthenticationMethodError`
 * for any method other than `LOCAL` today, so a future provider's author is
 * forced to add and review real resolution logic rather than inherit an
 * untested guess.
 */
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
    // Defensive only: `LocalAuthenticationProvider` already verified this
    // user exists and is ACTIVE moments earlier in the same request, inside
    // the same non-transactional read path. A concurrent deletion between
    // those two reads is not a case this release needs to distinguish from
    // any other authentication failure (FR-007's generic message applies
    // equally here).
    if (identity?.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedDomainError();
    }

    return identity;
  }
}
