import { randomUUID } from 'node:crypto';

import { OrgScopeType, type OrgScopeGrant, type Role, type User } from '@prisma/client';

import { getAllPermissionDefinitions } from '../../../src/permission-catalogue';

import type { PermissionIdentifier } from '../../../src/core/authorization/domain/permissions';
import type { PrismaService } from '../../../src/infrastructure/prisma/prisma.service';

export async function createPermissionFixture(
  prisma: PrismaService,
  identifier: PermissionIdentifier,
): Promise<{ id: string; identifier: string }> {
  const definition = getAllPermissionDefinitions().find((d) => d.identifier === identifier);
  if (!definition) {
    throw new Error(
      `createPermissionFixture: "${identifier}" is not a registered permission identifier.`,
    );
  }

  return prisma.client.permission.upsert({
    where: { identifier: definition.identifier },
    create: {
      identifier: definition.identifier,
      resource: definition.resource,
      action: definition.action,
      description: definition.description,
    },
    update: {},
    select: { id: true, identifier: true },
  });
}

export interface RoleWithPermissionsFixtureOverrides {
  readonly id?: string;
  readonly name?: string;
}

export async function createRoleWithPermissionsFixture(
  prisma: PrismaService,
  permissionIdentifiers: readonly PermissionIdentifier[],
  overrides: RoleWithPermissionsFixtureOverrides = {},
): Promise<Role> {
  const role = await prisma.client.role.create({
    data: {
      id: overrides.id ?? randomUUID(),
      name: overrides.name ?? `fixture-role-${randomUUID()}`,
      description: 'Fixture role for tests.',
      isSystem: false,
    },
  });

  for (const identifier of permissionIdentifiers) {
    const permission = await createPermissionFixture(prisma, identifier);
    await prisma.client.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });
  }

  return role;
}

export async function assignRoleFixture(
  prisma: PrismaService,
  input: { user: User; role: Role; grantedByUserId?: string },
): Promise<void> {
  await prisma.client.userRole.create({
    data: {
      userId: input.user.id,
      roleId: input.role.id,
      grantedByUserId: input.grantedByUserId ?? input.user.id,
      grantedAt: new Date(),
    },
  });
}

export async function grantUnitScopeFixture(
  prisma: PrismaService,
  input: { user: User; orgUnitId: string; grantedByUserId?: string },
): Promise<OrgScopeGrant> {
  return prisma.client.orgScopeGrant.create({
    data: {
      userId: input.user.id,
      scopeType: OrgScopeType.UNIT,
      orgUnitId: input.orgUnitId,
      grantedByUserId: input.grantedByUserId ?? input.user.id,
      grantedAt: new Date(),
    },
  });
}

export async function makeRiskAssignmentVisible(
  prisma: PrismaService,
  input: { user: User; orgUnitId: string },
): Promise<void> {
  const role = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
    name: `fixture-risk-visibility-role-${randomUUID()}`,
  });
  await assignRoleFixture(prisma, { user: input.user, role });
  await grantUnitScopeFixture(prisma, { user: input.user, orgUnitId: input.orgUnitId });
}

export async function grantGlobalScopeFixture(
  prisma: PrismaService,
  input: { user: User; grantedByUserId?: string },
): Promise<OrgScopeGrant> {
  return prisma.client.orgScopeGrant.create({
    data: {
      userId: input.user.id,
      scopeType: OrgScopeType.GLOBAL,
      orgUnitId: null,
      grantedByUserId: input.grantedByUserId ?? input.user.id,
      grantedAt: new Date(),
    },
  });
}
