import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  RoleRepositoryPort,
  type CreateRoleInput,
  type ListRolesResult,
  type PreviousRoleFields,
  type RoleRecord,
  type RoleSummaryCounts,
  type SetDiff,
  type UpdateRoleFields,
} from '../domain/ports/role-repository.port';

@Injectable()
export class PrismaRoleRepository extends RoleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(page: number, pageSize: number): Promise<ListRolesResult> {
    const [rows, total] = await Promise.all([
      this.prisma.client.role.findMany({
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: ROLE_SELECT,
      }),
      this.prisma.client.role.count(),
    ]);

    const items = await Promise.all(rows.map((row) => this.toRoleRecord(row)));
    return { items, total };
  }

  async findById(id: string): Promise<RoleRecord | undefined> {
    const row = await this.prisma.client.role.findUnique({ where: { id }, select: ROLE_SELECT });
    return row ? this.toRoleRecord(row) : undefined;
  }

  async findByName(
    name: string,
    excludeRoleId?: string,
  ): Promise<{ readonly id: string } | undefined> {
    const row = await this.prisma.client.role.findFirst({
      where: { name, ...(excludeRoleId ? { id: { not: excludeRoleId } } : {}) },
      select: { id: true },
    });
    return row ?? undefined;
  }

  async create(input: CreateRoleInput): Promise<RoleRecord> {
    const role = await this.prisma.client.role.create({
      data: {
        name: input.name,
        description: input.description,
        isSystem: false,
        rolePermissions: {
          create: input.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      select: ROLE_SELECT,
    });
    return this.toRoleRecord(role);
  }

  async updateFields(id: string, patch: UpdateRoleFields): Promise<PreviousRoleFields | undefined> {
    const existing = await this.prisma.client.role.findUnique({
      where: { id },
      select: { name: true, description: true, isSystem: true },
    });
    if (!existing) {
      return undefined;
    }

    await this.prisma.client.role.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
      },
    });

    return existing;
  }

  async replaceRolePermissions(roleId: string, permissionIds: readonly string[]): Promise<SetDiff> {
    const current = await this.prisma.client.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });
    const currentIds = new Set(current.map((row) => row.permissionId));
    const requestedIds = new Set(permissionIds);

    const added = Array.from(requestedIds).filter((id) => !currentIds.has(id));
    const removed = Array.from(currentIds).filter((id) => !requestedIds.has(id));

    if (removed.length > 0) {
      await this.prisma.client.rolePermission.deleteMany({
        where: { roleId, permissionId: { in: removed } },
      });
    }
    if (added.length > 0) {
      await this.prisma.client.rolePermission.createMany({
        data: added.map((permissionId) => ({ roleId, permissionId })),
      });
    }

    return { added, removed };
  }

  async countAssignedUsers(roleId: string): Promise<number> {
    return this.prisma.client.userRole.count({ where: { roleId } });
  }

  async getSummaryCounts(): Promise<RoleSummaryCounts> {
    const [totalRoles, systemRoles, customRoles, usersWithRolesRows] = await Promise.all([
      this.prisma.client.role.count(),
      this.prisma.client.role.count({ where: { isSystem: true } }),
      this.prisma.client.role.count({ where: { isSystem: false } }),
      this.prisma.client.$queryRaw<UsersWithRolesRow[]>(Prisma.sql`
        SELECT COUNT(DISTINCT user_id)::int AS users_with_roles FROM user_roles
      `),
    ]);

    return {
      totalRoles,
      systemRoles,
      customRoles,
      usersWithRoles: usersWithRolesRows[0]?.users_with_roles ?? 0,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.client.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.client.role.delete({ where: { id } });
  }

  async getUserRoleIds(userId: string): Promise<readonly string[]> {
    const rows = await this.prisma.client.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    return rows.map((row) => row.roleId);
  }

  async findByIds(ids: readonly string[]): Promise<readonly { readonly id: string }[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.client.role.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true },
    });
  }

  async replaceUserRoles(
    userId: string,
    roleIds: readonly string[],
    grantedByUserId: string,
    grantedAt: Date,
  ): Promise<SetDiff> {
    const currentIds = new Set(await this.getUserRoleIds(userId));
    const requestedIds = new Set(roleIds);

    const added = Array.from(requestedIds).filter((id) => !currentIds.has(id));
    const removed = Array.from(currentIds).filter((id) => !requestedIds.has(id));

    if (removed.length > 0) {
      await this.prisma.client.userRole.deleteMany({
        where: { userId, roleId: { in: removed } },
      });
    }
    if (added.length > 0) {
      await this.prisma.client.userRole.createMany({
        data: added.map((roleId) => ({ userId, roleId, grantedByUserId, grantedAt })),
      });
    }

    return { added, removed };
  }

  private async toRoleRecord(row: RoleSelectResult): Promise<RoleRecord> {
    const assignedUserCount = await this.countAssignedUsers(row.id);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isSystem: row.isSystem,
      permissions: row.rolePermissions.map((rolePermission) => rolePermission.permission),
      assignedUserCount,
    };
  }
}

interface UsersWithRolesRow {
  readonly users_with_roles: number;
}

const ROLE_SELECT = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  rolePermissions: { select: { permission: true } },
} satisfies Prisma.RoleSelect;

type RoleSelectResult = Prisma.RoleGetPayload<{ select: typeof ROLE_SELECT }>;
