import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  PermissionRepositoryPort,
  type PermissionRecord,
} from '../domain/ports/permission-repository.port';

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
