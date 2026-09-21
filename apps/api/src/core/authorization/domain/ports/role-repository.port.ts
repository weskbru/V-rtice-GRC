/**
 * Persistence port for role and role-permission administration (T177,
 * ADR-003, data-model.md §3). `core/authorization/application` depends on
 * this abstract class — never on `PrismaService` directly (ADR-011).
 * `core/authorization/infrastructure/prisma-role.repository.ts` is the only
 * implementation, wired in `authorization.module.ts`.
 *
 * Kept separate from `PermissionRepositoryPort` (T036) rather than folded
 * into it: that port's whole reason for existing is effective-permission
 * *resolution* (`PermissionResolverService`'s single decision path,
 * ADR-003) plus the `permissionsVersion` counter it shares with this one —
 * `Role`/`RolePermission`/`UserRole` row administration is a distinct
 * concern with its own shape (pagination, uniqueness, assignment counts)
 * that has nothing to do with resolving one user's effective set.
 */
import type { PermissionRecord } from './permission-repository.port';

/** Mirrors `contracts/admin.openapi.yaml`'s `Role` schema. */
export interface RoleRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isSystem: boolean;
  readonly permissions: readonly PermissionRecord[];
  readonly assignedUserCount: number;
}

export interface ListRolesResult {
  readonly items: readonly RoleRecord[];
  readonly total: number;
}

/**
 * 2026-09-13 (015-roles-permissions-surface, FR-039/FR-040) — the four
 * platform-wide counts `GET /admin/roles/summary` answers, deliberately
 * shaped as ONE port method returning all four rather than four separate
 * counting methods: the operation is a single read, and splitting it would
 * invite a caller to issue the counts from four different places.
 *
 * `usersWithRoles` is `COUNT(DISTINCT user_id)` over `user_roles`, NOT the
 * sum of `RoleRecord.assignedUserCount` across roles: a person holding two
 * roles contributes to two `assignedUserCount`s and must still count ONCE
 * here (SC-004). No implementation of this port may derive it by summing.
 *
 * `totalRoles = systemRoles + customRoles` is an invariant of the data, not
 * an arithmetic identity this interface enforces — each of the three is an
 * independent aggregate, so a test asserting the invariant against a real
 * database is checking something real rather than a subtraction.
 */
export interface RoleSummaryCounts {
  readonly totalRoles: number;
  readonly systemRoles: number;
  readonly customRoles: number;
  readonly usersWithRoles: number;
}

export interface CreateRoleInput {
  readonly name: string;
  readonly description: string;
  readonly permissionIds: readonly string[];
}

export interface UpdateRoleFields {
  readonly name?: string;
  readonly description?: string;
}

/** The pre-update `Role`-own-column values, for the audit diff — always the
 * full set regardless of which fields actually changed. */
export interface PreviousRoleFields {
  readonly name: string;
  readonly description: string;
  readonly isSystem: boolean;
}

/** The result of replacing a many-to-many set (role permissions, or a
 * user's roles): which ids were newly added and which were removed, so the
 * caller can audit the change without re-reading the full before/after set
 * itself. Both are empty when the requested set already matches the
 * current one exactly. */
export interface SetDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

export abstract class RoleRepositoryPort {
  abstract list(page: number, pageSize: number): Promise<ListRolesResult>;

  abstract findById(id: string): Promise<RoleRecord | undefined>;

  /** For validating a `ReplaceUserRolesRequest`'s `roleIds` (422 when the
   * returned set is smaller than the input — some role id does not exist). */
  abstract findByIds(ids: readonly string[]): Promise<readonly { readonly id: string }[]>;

  /** For the uniqueness pre-check (409) on create/rename. `excludeRoleId`
   * lets `update` check "does another role already have this name" without
   * matching the role being renamed to its own current name. */
  abstract findByName(
    name: string,
    excludeRoleId?: string,
  ): Promise<{ readonly id: string } | undefined>;

  abstract create(input: CreateRoleInput): Promise<RoleRecord>;

  /** Updates the role's own `name`/`description` columns (never
   * `permissionIdentifiers` — see `replaceRolePermissions`). Returns the
   * pre-update values for the audit diff, or `undefined` if the role does
   * not exist. */
  abstract updateFields(
    id: string,
    patch: UpdateRoleFields,
  ): Promise<PreviousRoleFields | undefined>;

  /** Replaces the role's complete `RolePermission` set. Returns the diff
   * (added/removed permission ids) so the caller can record one
   * `role_permission.granted`/`role_permission.revoked` audit row per
   * changed permission — `RolePermission` has no own surrogate key, so a
   * per-column diff (mirroring `ROLE_PERMISSION`'s allow-listed
   * `roleId`/`permissionId` columns) is the natural audit shape, rather
   * than inventing a synthetic "permission set" field on `ROLE`. */
  abstract replaceRolePermissions(
    roleId: string,
    permissionIds: readonly string[],
  ): Promise<SetDiff>;

  abstract countAssignedUsers(roleId: string): Promise<number>;

  /**
   * The four platform-wide counts of `RoleSummaryCounts` (FR-039). MUST be
   * answered by aggregation — a constant number of queries regardless of
   * how many roles or users exist. `list()`'s own per-role
   * `countAssignedUsers` fan-out (a conscious N+1, `specs/013-stabilization-
   * audit/STATE.md` A7-F07) is precisely what this method must not repeat:
   * the screen that consumes it already pays that cost once.
   */
  abstract getSummaryCounts(): Promise<RoleSummaryCounts>;

  /** Deletes the role and its `RolePermission` rows. Caller (`RoleAdminService`)
   * is responsible for the `isSystem`/assignment-count checks first — this
   * method performs the deletion unconditionally. */
  abstract delete(id: string): Promise<void>;

  /** The role ids currently assigned to `userId` (`UserRole`), for
   * `replaceUserRoles`'s diff. */
  abstract getUserRoleIds(userId: string): Promise<readonly string[]>;

  /** Replaces the complete `UserRole` set for `userId` with `roleIds`,
   * stamping every newly-added row's `grantedByUserId`/`grantedAt`. Returns
   * the diff for the same per-row audit reasoning as
   * `replaceRolePermissions`. */
  abstract replaceUserRoles(
    userId: string,
    roleIds: readonly string[],
    grantedByUserId: string,
    grantedAt: Date,
  ): Promise<SetDiff>;
}
