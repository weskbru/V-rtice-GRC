/**
 * Persistence port for organizational-scope resolution (T039, ADR-004).
 * `core/organizations/application` depends on this abstract class — never
 * on `PrismaService` directly, which would violate the ADR-011 rule that
 * `core-application` may only import `core-domain`/`core-application`.
 * `core/organizations/infrastructure/prisma-org-scope.repository.ts` is the
 * only implementation, wired in `organizations.module.ts`.
 */

export interface OrgScopeGrantRecord {
  readonly scopeType: 'GLOBAL' | 'UNIT';
  /** Present iff `scopeType === 'UNIT'` — mirrors the database `CHECK`
   * constraint on `org_scope_grants` (data-model.md §4). */
  readonly orgUnitId?: string;
}

// ---------------------------------------------------------------------------
// T179/US8 — scope-grant administration
// (`/admin/users/{userId}/scope-grants[/{grantId}]`). Distinct from the
// resolution-only methods above: these back the CRUD surface, not
// `ScopeResolverService`'s cache-backed read path.
// ---------------------------------------------------------------------------

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

/** Mirrors `contracts/admin.openapi.yaml`'s `OrgScopeGrant` schema. */
export interface DetailedOrgScopeGrantRecord {
  readonly id: string;
  readonly scopeType: 'GLOBAL' | 'UNIT';
  readonly orgUnit: OrgUnitRefRecord | undefined;
  readonly grantedBy: UserRefRecord;
  readonly grantedAt: Date;
}

export interface CreateOrgScopeGrantInput {
  readonly userId: string;
  readonly scopeType: 'GLOBAL' | 'UNIT';
  readonly orgUnitId: string | undefined;
  readonly grantedByUserId: string;
}

export abstract class OrgScopeRepositoryPort {
  /** Every `OrgScopeGrant` row held by `userId`, straight from PostgreSQL. */
  abstract getUserGrants(userId: string): Promise<readonly OrgScopeGrantRecord[]>;

  /**
   * Expands a set of directly-granted unit ids into that set plus every
   * descendant of each (FR-025b: "a grant on a unit extends to its
   * descendants"), resolved by the materialized-path prefix
   * (ADR-004) — one `path LIKE {grantedPath}%`-shaped query per granted
   * unit, unioned. Returns the empty set for an empty input, never a
   * sentinel meaning "everything".
   */
  abstract expandToDescendants(orgUnitIds: readonly string[]): Promise<ReadonlySet<string>>;

  /** Current value of the durable `orgTreeVersion` counter
   * (`org_scope_cache_state`, singleton row). Bumped when the org-unit
   * tree changes (create, reparent, deactivate). */
  abstract getOrgTreeVersion(): Promise<number>;

  /** Current value of the durable `grantsVersion` counter
   * (`org_scope_cache_state`, singleton row). Bumped when an
   * `OrgScopeGrant` row is created or removed. */
  abstract getGrantsVersion(): Promise<number>;

  /** Atomically increments and returns the new `orgTreeVersion`. Called by
   * the organizational-unit administration use case (a later phase, T177's
   * sibling for org units) whenever a unit is created, reparented or
   * deactivated — not by anything in this capability today. */
  abstract bumpOrgTreeVersion(): Promise<number>;

  /** Atomically increments and returns the new `grantsVersion`. Called by
   * the administration use cases (T177) whenever an `OrgScopeGrant` row is
   * created or removed — not by anything in this capability today. */
  abstract bumpGrantsVersion(): Promise<number>;

  // -- T179/US8 scope-grant administration ---------------------------------

  /** For the 404 check on every `/admin/users/{userId}/scope-grants[/**]`
   * route — `core/organizations` cannot depend on `core/identity`
   * (`IdentityModule` already imports this capability; the reverse would
   * cycle), so this reads the `users` table directly for existence,
   * exactly the way `ActorDirectoryPort` reads it for a display name. */
  abstract userExists(userId: string): Promise<boolean>;

  /** `GET /admin/users/{userId}/scope-grants` — the caller's full detail
   * (org unit ref, granting user ref), not just the resolution-shaped
   * `getUserGrants` above. */
  abstract listDetailedGrants(userId: string): Promise<readonly DetailedOrgScopeGrantRecord[]>;

  /** For the 409 "an identical grant already exists" pre-check. */
  abstract findDuplicateGrant(
    input: Pick<CreateOrgScopeGrantInput, 'userId' | 'scopeType' | 'orgUnitId'>,
  ): Promise<{ readonly id: string } | undefined>;

  abstract createGrant(input: CreateOrgScopeGrantInput): Promise<DetailedOrgScopeGrantRecord>;

  /** `undefined` if no grant with `grantId` belongs to `userId` (404) —
   * scoped to the user so a grant id belonging to a DIFFERENT user cannot
   * be revoked through this route. */
  abstract findGrantById(
    userId: string,
    grantId: string,
  ): Promise<
    | {
        readonly id: string;
        readonly scopeType: 'GLOBAL' | 'UNIT';
        readonly orgUnitId: string | undefined;
      }
    | undefined
  >;

  abstract deleteGrant(grantId: string): Promise<void>;
}
