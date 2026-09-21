/**
 * PharosGRC frontend — auth/session/profile types (T070–T078).
 *
 * Hand-written against `specs/001-grc-platform-foundation/contracts/auth.openapi.yaml`
 * rather than generated, for the same reason `ApiProblem` is hand-written in
 * `api-client.ts`: `packages/api-types` is not yet populated from a live
 * `apps/api/openapi.json` for this surface (T205). Every shape below mirrors
 * a named schema in the contract — when T205 lands, replace these with the
 * generated `components['schemas'][...]` equivalents rather than widening
 * them; this file should shrink to nothing, not grow.
 */

/** Mirrors `AuthenticationMethod` in auth.openapi.yaml. Only `LOCAL` is operational (FR-003, FR-004). */
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

/** Mirrors `EffectiveScope` — the caller's resolved organizational scope (FR-025a, FR-025b, ADR-004). */
export interface EffectiveScope {
  readonly global: boolean;
  readonly orgUnitIds: readonly string[];
}

/** Mirrors `SessionMetadata` (FR-013). The internal session id is never part of this shape (FR-107). */
export interface SessionMetadata {
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastActivityAt: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

/** Mirrors `OwnProfile` (FR-009). Never carries credential material (FR-005). */
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

/** Mirrors `CurrentSession` — returned by `GET /auth/session`. */
export interface CurrentSession {
  readonly user: OwnProfile;
  /** Effective `resource:action` permission identifiers (ADR-003). Advisory for the client only — see `src/lib/permissions.ts`. */
  readonly permissions: readonly string[];
  readonly scope: EffectiveScope;
  readonly session: SessionMetadata;
}

/** Mirrors `AuthenticatedIdentity` — returned by `POST /auth/login`. */
export interface AuthenticatedIdentity extends CurrentSession {
  /** True when the credential is flagged for mandatory change (e.g. the seeded administrator). The login screen MUST route here instead of into the app. */
  readonly mustChangePassword: boolean;
}
