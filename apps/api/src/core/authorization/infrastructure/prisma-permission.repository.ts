/**
 * `PermissionRepositoryPort` implementation backed by PostgreSQL via
 * `PrismaService` (T036, ADR-003). Lives in
 * `core/authorization/infrastructure` because `PrismaService`
 * (`infrastructure/prisma/prisma.service.ts`) is the top-level
 * `infrastructure` element, which only `core-infrastructure`/
 * `core-presentation` may import under the ADR-011 boundary rules.
 *
 * No caching here — that is `PermissionResolverService`'s job, one layer
 * up, via the separate `PermissionCachePort`. This class always talks to
 * PostgreSQL and is therefore, by construction, the "identical answer on a
 * cache miss" the resolver's contract requires.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  PermissionRepositoryPort,
  type PermissionRecord,
} from '../domain/ports/permission-repository.port';

/** The one row `permission_cache_state` will ever hold (see the
 * `20260905130100_authorization_scope_cache_counters` migration, which
 * seeds it). */
const SINGLETON_ROW_ID = 'singleton';

@Injectable()
export class PrismaPermissionRepository extends PermissionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getEffectivePermissionIdentifiers(userId: string): Promise<readonly string[]> {
    const rolePermissions = await this.prisma.client.rolePermission.findMany({
      where: { role: { userRoles: { some: { userId } } } },
      select: { permission: { select: { identifier: true } } },
    });

    // A user commonly holds one role, occasionally several with overlapping
    // permissions — de-duplicate with a Set rather than relying on the
    // query (a `DISTINCT` across a joined result is markedly more awkward
    // to express correctly in Prisma than de-duplicating a small array
    // in-process).
    const identifiers = new Set(
      rolePermissions.map((rolePermission) => rolePermission.permission.identifier),
    );
    return Array.from(identifiers);
  }

  async getPermissionsVersion(): Promise<number> {
    const state = await this.prisma.client.permissionCacheState.findUniqueOrThrow({
      where: { id: SINGLETON_ROW_ID },
      select: { permissionsVersion: true },
    });
    return state.permissionsVersion;
  }

  async bumpPermissionsVersion(): Promise<number> {
    const state = await this.prisma.client.permissionCacheState.update({
      where: { id: SINGLETON_ROW_ID },
      data: { permissionsVersion: { increment: 1 } },
      select: { permissionsVersion: true },
    });
    return state.permissionsVersion;
  }

  async listAll(resource: string | undefined): Promise<readonly PermissionRecord[]> {
    const rows = await this.prisma.client.permission.findMany({
      where: resource ? { resource } : {},
      orderBy: { identifier: 'asc' },
    });
    return rows;
  }

  async findByIdentifiers(identifiers: readonly string[]): Promise<readonly PermissionRecord[]> {
    if (identifiers.length === 0) {
      return [];
    }
    return this.prisma.client.permission.findMany({
      where: { identifier: { in: Array.from(identifiers) } },
    });
  }
}
