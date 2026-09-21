/**
 * Persistence port for effective-permission resolution (T036, ADR-003).
 * `core/authorization/application` depends on this abstract class — never
 * on `PrismaService` directly, which would violate the ADR-011 rule that
 * `core-application` may only import `core-domain`/`core-application`.
 * `core/authorization/infrastructure/prisma-permission.repository.ts` is
 * the only implementation, wired in `authorization.module.ts`.
 */
import type { PermissionAction } from '@prisma/client';

/** Mirrors `contracts/admin.openapi.yaml`'s `Permission` schema. */
export interface PermissionRecord {
  readonly id: string;
  readonly identifier: string;
  readonly resource: string;
  readonly action: PermissionAction;
  readonly description: string;
}

export abstract class PermissionRepositoryPort {
  /**
   * The union of permission identifiers granted to `userId` across every
   * role assigned to them (`UserRole` -> `Role` -> `RolePermission` ->
   * `Permission`), straight from PostgreSQL — always authoritative,
   * regardless of whether a caller reached this through a cache miss.
   */
  abstract getEffectivePermissionIdentifiers(userId: string): Promise<readonly string[]>;

  /** Current value of the durable `permissionsVersion` counter
   * (`permission_cache_state`, singleton row). */
  abstract getPermissionsVersion(): Promise<number>;

  /**
   * Atomically increments and returns the new `permissionsVersion`. Called
   * whenever a `Role`, `RolePermission` or `UserRole` row changes
   * (FR-028) — by the administration use cases (T177, a later phase), not
   * by anything in this capability today. Publishing this method here,
   * ahead of T177, is what lets T177 depend on `PermissionRepositoryPort`
   * without `core/authorization` growing an administration feature of its
   * own.
   */
  abstract bumpPermissionsVersion(): Promise<number>;

  /** `GET /admin/permissions` (T177/T180) — the seeded permission catalogue,
   * optionally filtered to one `resource`. */
  abstract listAll(resource: string | undefined): Promise<readonly PermissionRecord[]>;

  /** Resolves `identifiers` to their `Permission` rows, for validating a
   * `WriteRoleRequest`/`UpdateRoleRequest`'s `permissionIdentifiers`
   * (422 when the returned set is smaller than the input — some identifier
   * does not exist). */
  abstract findByIdentifiers(identifiers: readonly string[]): Promise<readonly PermissionRecord[]>;
}
