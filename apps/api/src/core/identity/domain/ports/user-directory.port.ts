/**
 * Persistence port for everything the identity capability needs to read or
 * write about a `User`/`LocalCredential` (T059, T061, T066, T067). One
 * cohesive port rather than several narrower ones, deliberately: every
 * method below is used by more than one caller across the login, profile,
 * password-change and deactivation flows, and this capability has exactly
 * one Prisma-backed implementation (`PrismaUserDirectoryRepository`) — the
 * "não criar abstrações prematuras" principle argues against splitting this
 * into single-method ports with no second implementation ever in view.
 *
 * `core/identity/application` depends on this abstract class — never on
 * `PrismaService` directly (ADR-011).
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { AuthenticationMethod, UserStatus } from '@prisma/client';

export interface LocalAuthenticationSubject {
  readonly userId: string;
  readonly userStatus: UserStatus;
  readonly userFullName: string;
  readonly userEmail: string;
  readonly credentialId: string;
  readonly passwordHash: string;
  readonly failedAttempts: number;
  readonly lockedUntil: Date | undefined;
  readonly mustChangePassword: boolean;
}

export interface UserIdentitySummary {
  readonly id: string;
  readonly status: UserStatus;
  readonly fullName: string;
  readonly primaryOrgUnitId: string | undefined;
}

export interface OrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RoleRef {
  readonly id: string;
  readonly name: string;
}

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | undefined;
  readonly status: UserStatus;
  readonly primaryOrgUnit: OrgUnitRef | undefined;
  readonly roles: readonly RoleRef[];
  readonly lastLoginAt: Date | undefined;
}

export interface LocalCredentialSummary {
  readonly credentialId: string;
  readonly passwordHash: string;
}

/** One row of `GET /users` — mirrors `UserRef` (`contracts/admin.openapi.yaml`). */
export interface DirectoryUserRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle: string | undefined;
  readonly primaryOrgUnit: OrgUnitRef | undefined;
}

export interface ListDirectoryUsersInput {
  /**
   * T095b/FR-025 applied to the directory lookup: only `ACTIVE` users whose
   * `primaryOrgUnitId` falls inside `scope` are returned (a `GLOBAL` scope
   * sees every active user; the empty `UNIT` scope — no grants at all —
   * sees none, matching every other scoped read in this platform).
   *
   * This is the BROWSE rule: "whom may this actor look up". It is
   * deliberately no longer also used as the ASSIGNMENT rule — see
   * `assignment` below. An earlier version of this comment asserted that "a
   * risk owner/responsible person must be assignable only from users the
   * acting user is themselves authorized to see", and that sentence was the
   * whole defect: scope expands to descendants and never to ancestors
   * (FR-025b), so it made an analyst in a leaf unit unable to name their own
   * manager — or anyone at all, on a tree where no user's primary unit is
   * that leaf. It was never true of the write path either, which only ever
   * required the owner to be an active user.
   */
  readonly scope: ScopeFilter;
  /**
   * Present only for an ASSIGNMENT lookup — "who may be made responsible
   * for a record belonging to unit U" — and, when present, it REPLACES the
   * `scope` filter above rather than narrowing it further.
   *
   * `unitIds` is the assignment line of U (`core/organizations/domain/
   * assignment-line.ts`): U, its ancestors and its descendants. The caller's
   * own authority to ask the question at all is checked before this is
   * built — `ListDirectoryUsersUseCase` refuses a unit outside the actor's
   * scope — so replacing `scope` here widens nothing the actor could not
   * already act within; it only stops the browse rule from amputating the
   * upward half of a line the actor legitimately needs.
   *
   * Users with NO `primaryOrgUnitId` are included by this branch: a user
   * recorded against no unit is not confined to one, so they are assignable
   * anywhere. `primaryOrgUnitId IN (...)` alone would silently drop them,
   * which is exactly how 25 active users became unassignable without any
   * rule ever saying they should be.
   *
   * F-CV-2: when this is present, `page`/`pageSize` below are NOT applied
   * by `listDirectory` — every matching row comes back. This branch answers
   * a bounded question (a unit's assignment line, not the whole directory),
   * and `ListDirectoryUsersUseCase` must filter the set by per-candidate
   * visibility (`risk:view` + scope reaching the unit — not expressible as
   * a `WHERE` clause here) BEFORE paginating, or a page could silently
   * under-fill whenever an ineligible candidate would have occupied one of
   * its slots.
   */
  readonly assignment?: { readonly unitIds: readonly string[] };
  readonly page: number;
  readonly pageSize: number;
  readonly q: string | undefined;
}

export interface ListDirectoryUsersResult {
  readonly items: readonly DirectoryUserRecord[];
  readonly total: number;
}

// ---------------------------------------------------------------------------
// T176/US8 — administrative surface (`GET|POST /admin/users`, ...). Distinct
// from `UserProfile`/`DirectoryUserRecord` above (which back the
// non-administrative `GET /auth/me` and `GET /users` reads respectively):
// the admin representation additionally carries `authenticationMethods` and
// `createdAt` (`contracts/admin.openapi.yaml`'s `User` schema) that those
// two callers have no use for, and is never scope-filtered — administrative
// resources are not organizationally scoped records (that document's own
// description).
// ---------------------------------------------------------------------------

/** Mirrors `contracts/admin.openapi.yaml`'s `User` schema. */
export interface AdminUserRecord {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | undefined;
  readonly status: UserStatus;
  readonly primaryOrgUnit: OrgUnitRef | undefined;
  readonly roles: readonly RoleRef[];
  readonly authenticationMethods: readonly AuthenticationMethod[];
  readonly lastLoginAt: Date | undefined;
  readonly createdAt: Date;
}

export type AdminUserSortField = 'fullName' | 'email' | 'status' | 'lastLoginAt';
export type AdminSortDirection = 'asc' | 'desc';

export interface ListAdminUsersInput {
  readonly page: number;
  readonly pageSize: number;
  readonly q: string | undefined;
  readonly status: UserStatus | undefined;
  readonly orgUnitId: string | undefined;
  readonly roleId: string | undefined;
  readonly sortField: AdminUserSortField;
  readonly sortDirection: AdminSortDirection;
}

export interface ListAdminUsersResult {
  readonly items: readonly AdminUserRecord[];
  readonly total: number;
}

export interface CreateUserRow {
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | undefined;
  readonly primaryOrgUnitId: string | undefined;
  readonly passwordHash: string;
  readonly mustChangePassword: boolean;
}

export interface UpdateProfileFields {
  readonly email?: string;
  readonly fullName?: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnitId?: string | null;
}

/** The pre-update field values needed for the audit `previousValues` diff
 * (T176, FR-033) — always the full set, regardless of which fields
 * `UpdateProfileFields` actually changes, so the caller can diff exactly
 * the fields it touched. */
export interface PreviousProfileFields {
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | undefined;
  readonly primaryOrgUnitId: string | undefined;
}

export abstract class UserDirectoryPort {
  /** For login: joins `User` + `LocalCredential` by email. `undefined` when
   * no such email exists — callers must not let that distinction leak past
   * a generic failure response (FR-007). */
  abstract findAuthenticationSubject(
    email: string,
  ): Promise<LocalAuthenticationSubject | undefined>;

  /** For `IdentityResolverService` (LOCAL: `externalSubject` IS the user id). */
  abstract findIdentitySummary(userId: string): Promise<UserIdentitySummary | undefined>;

  /** For `GET /auth/me` and `GET /auth/session`. */
  abstract findProfileById(userId: string): Promise<UserProfile | undefined>;

  /** For `changeOwnPassword` — verifying the caller's current password. */
  abstract findLocalCredentialByUserId(userId: string): Promise<LocalCredentialSummary | undefined>;

  abstract touchLastLoginAt(userId: string, at: Date): Promise<void>;

  /** FR-008 per-account throttling. */
  abstract recordFailedAttempt(
    credentialId: string,
    input: { failedAttempts: number; lockedUntil: Date | undefined },
  ): Promise<void>;

  abstract recordSuccessfulAuthentication(credentialId: string): Promise<void>;

  /** FR-010/FR-017 own-password change. */
  abstract updatePassword(
    credentialId: string,
    input: { passwordHash: string; passwordChangedAt: Date; mustChangePassword: boolean },
  ): Promise<void>;

  /** FR-011/FR-017 deactivation support. Returns the previous status (for
   * the audit's `previousValues`), or `undefined` if the user does not
   * exist. */
  abstract setStatus(userId: string, status: UserStatus): Promise<UserStatus | undefined>;

  /** T095b — `GET /users`, the reduced directory lookup for assigning a risk
   * owner or responsible person (FR-058), scope-filtered per this
   * interface's own documentation above. */
  abstract listDirectory(input: ListDirectoryUsersInput): Promise<ListDirectoryUsersResult>;

  // -- T176/US8 administration --------------------------------------------

  /** For `CreateUserUseCase`'s email-uniqueness pre-check (409). */
  abstract findByEmail(email: string): Promise<{ id: string } | undefined>;

  /** Creates the `User` row and its `LocalCredential` together (US8 AS1: an
   * administratively-provisioned user always starts with a local password
   * flagged for mandatory change). `authenticationMethods` on the returned
   * record is always `['LOCAL']` — this release provisions no other kind
   * (data-model.md §1). */
  abstract createUserWithCredential(input: CreateUserRow): Promise<AdminUserRecord>;

  /** `PATCH /admin/users/{userId}`. Returns the pre-update field values for
   * the audit diff, or `undefined` if the user does not exist (404). */
  abstract updateProfile(
    userId: string,
    patch: UpdateProfileFields,
  ): Promise<PreviousProfileFields | undefined>;

  /** `GET /admin/users` — unscoped by organizational unit (administrative
   * resources are not organizationally scoped records,
   * `contracts/admin.openapi.yaml`'s own description). */
  abstract listAdmin(input: ListAdminUsersInput): Promise<ListAdminUsersResult>;

  /** `GET /admin/users/{userId}` and the response body of every other
   * `/admin/users/{userId}/**` mutation. `undefined` if the user does not
   * exist (404). */
  abstract findAdminRecordById(userId: string): Promise<AdminUserRecord | undefined>;

  /** FK validation for `primaryOrgUnitId` on create/update (FR-060-style
   * referential integrity, mirroring `RiskReferenceDataPort.findOrgUnit`'s
   * role in the risk module). `undefined` if the unit does not exist. */
  abstract findOrgUnitForValidation(
    orgUnitId: string,
  ): Promise<{ readonly id: string; readonly isActive: boolean } | undefined>;
}
