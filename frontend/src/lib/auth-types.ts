export type AuthenticationMethod = 'LOCAL' | 'LDAP' | 'ACTIVE_DIRECTORY' | 'OIDC' | 'SAML';

export interface OrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RoleRef {
  readonly id: string;
  readonly name: string;
}

export interface EffectiveScope {
  readonly global: boolean;
  readonly orgUnitIds: readonly string[];
}

export interface SessionMetadata {
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastActivityAt: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface OwnProfile {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly primaryOrgUnit: OrgUnitRef | null;
  readonly roles: readonly RoleRef[];
  readonly lastLoginAt: string | null;
}

export interface CurrentSession {
  readonly user: OwnProfile;
  readonly permissions: readonly string[];
  readonly scope: EffectiveScope;
  readonly session: SessionMetadata;
}

export interface AuthenticatedIdentity extends CurrentSession {
  readonly mustChangePassword: boolean;
}
