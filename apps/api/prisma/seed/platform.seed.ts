import { randomUUID } from 'node:crypto';

import {
  OrgScopeType,
  OrgUnitStatus,
  UserStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import * as argon2 from 'argon2';

import {
  computeChildPath,
  computeRootPath,
  type OrgUnitPathInfo,
} from '../../src/core/organizations/domain/org-unit-path';
import { getAllPermissionDefinitions } from '../../src/permission-catalogue';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';
import type {
  AppConfigService,
  Argon2Settings,
} from '../../src/infrastructure/config/app-config.service';

interface SystemRoleDefinition {
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly PermissionIdentifier[];
  readonly globalScope: boolean;
}

const ALL_PERMISSION_IDENTIFIERS: readonly PermissionIdentifier[] =
  getAllPermissionDefinitions().map((definition) => definition.identifier as PermissionIdentifier);

export const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] = [
  {
    name: 'Platform Administrator',
    description:
      'Acesso administrativo completo à plataforma: usuários, papéis, unidades organizacionais, ' +
      'configuração da metodologia e todas as operações dos módulos GRC.',
    permissions: ALL_PERMISSION_IDENTIFIERS,
    globalScope: true,
  },
  {
    name: 'Risk Manager',
    description:
      'Opera o registro de riscos de ponta a ponta — captura, avalia, trata e transiciona riscos, ' +
      'com comentários e anexos. Não decide aprovações nem administra a plataforma.',
    permissions: [
      'risk:view',
      'risk:create',
      'risk:edit',
      'risk:assess',
      'risk:treat',
      'risk:transition',
      'comment:create',
      'comment:delete',
      'attachment:create',
      'attachment:delete',
      'evidence:view',
      'evidence:create',
      'evidence:edit',
      'evidence:administer',
      'evidence:link',
      'action:view',
      'action:create',
      'action:edit',
      'finding:view',
      'finding:create',
      'finding:edit',
      'finding:administer',
      'control:view',
      'asset:view',
      'process:view',
    ],
    globalScope: false,
  },
  {
    name: 'Risk Analyst',
    description:
      'Captura e avalia riscos no seu escopo organizacional e pode solicitar transições de ciclo ' +
      'de vida sujeitas a aprovação — mas nunca decide a aprovação que solicitou.',
    permissions: [
      'risk:view',
      'risk:create',
      'risk:edit',
      'risk:assess',
      'risk:transition',
      'comment:create',
      'attachment:create',
      'evidence:view',
      'evidence:create',
      'evidence:link',
      'action:view',
      'action:edit',
      'finding:view',
      'finding:create',
      'finding:edit',
      'asset:view',
      'process:view',
    ],
    globalScope: false,
  },
  {
    name: 'Risk Approver',
    description:
      'Decide as aprovações do ciclo de vida do risco, como aceitação e encerramento. Papel de ' +
      'decisão: consulta os riscos para decidir, mas não os captura, edita, avalia nem trata.',
    permissions: [
      'risk:view',
      'risk:approve',
      'comment:create',
      'evidence:view',
      'action:view',
      'finding:view',
      'finding:close',
      'asset:view',
      'process:view',
    ],
    globalScope: false,
  },
  {
    name: 'Control Owner',
    description:
      'Mantém o catálogo de controles no seu escopo organizacional: cadastra, edita, coloca em ' +
      'operação e executa verificações de efetividade. Não atesta as próprias verificações.',
    permissions: ['control:view', 'control:create', 'control:edit', 'control:test'],
    globalScope: false,
  },
  {
    name: 'Control Approver',
    description:
      'Atesta ou recusa as verificações de efetividade pendentes de decisão. Papel de decisão: ' +
      'não cadastra, não edita e não executa verificações de controle.',
    permissions: ['control:view', 'control:approve'],
    globalScope: false,
  },
  {
    name: 'Compliance Manager',
    description:
      'Mantém a biblioteca normativa — frameworks, versões e requisitos —, o mapeamento entre ' +
      'requisito e controle e as declarações de aplicabilidade.',
    permissions: ['compliance:view', 'compliance:administer', 'compliance:map', 'control:view'],
    globalScope: false,
  },
  {
    name: 'Auditor',
    description:
      'Leitura de toda a organização: riscos, evidências, ações, achados, engajamentos de ' +
      'auditoria, ativos, processos, incidentes, problemas, indicadores, relatórios e a trilha ' +
      'de auditoria.',
    // global role being created for the identical purpose (§19.4,
    permissions: [
      'risk:view',
      'audit:view',
      'evidence:view',
      'action:view',
      'finding:view',
      'audit-engagement:view',
      'asset:view',
      'process:view',
      'incident:view',
      'problem:view',
      'indicator:view',
      'report:view',
    ],
    globalScope: true,
  },
  {
    name: 'Read Only',
    description:
      'Somente leitura, dentro do escopo organizacional do usuário: riscos, evidências, ações, ' +
      'achados, ativos, processos, incidentes, problemas, indicadores e relatórios.',
    permissions: [
      'risk:view',
      'evidence:view',
      'action:view',
      'finding:view',
      'asset:view',
      'process:view',
      'incident:view',
      'problem:view',
      'indicator:view',
      'report:view',
    ],
    globalScope: false,
  },
  {
    name: 'Audit Lead',
    description:
      'Conduz engajamentos de auditoria de ponta a ponta — abre, escopa, inicia e encerra —, ' +
      'registra os achados que produz, move-os para remediação e os vincula ao controle ou ao ' +
      'risco que apontam.',
    permissions: [
      'audit-engagement:view',
      'audit-engagement:create',
      'audit-engagement:edit',
      'audit-engagement:scope',
      'audit-engagement:transition',
      'finding:view',
      'finding:create',
      'finding:close',
      'finding:remediate',
      'finding:link',
      'control:view',
      'risk:view',
      'asset:view',
      'process:view',
    ],
    globalScope: false,
  },
  {
    name: 'Incident Manager',
    description:
      'Opera o registro de incidentes de ponta a ponta no seu escopo organizacional: registra, ' +
      'edita, transiciona, vincula a risco, ativo ou processo e conduz a ação corretiva e sua ' +
      'evidência.',
    permissions: [
      'incident:view',
      'incident:create',
      'incident:edit',
      'incident:transition',
      'incident:link',
      'risk:view',
      'asset:view',
      'process:view',
      'action:view',
      'action:create',
      'action:edit',
      'evidence:view',
      'evidence:create',
      'evidence:link',
      'comment:create',
      'attachment:create',
    ],
    globalScope: false,
  },
  {
    name: 'Problem Manager',
    description:
      'Opera o registro de problemas de ponta a ponta no seu escopo organizacional: registra, ' +
      'edita, transiciona, documenta a causa raiz, vincula a risco ou incidente e conduz a ação ' +
      'corretiva definitiva.',
    permissions: [
      'problem:view',
      'problem:create',
      'problem:edit',
      'problem:transition',
      'problem:link',
      'risk:view',
      'incident:view',
      'action:view',
      'action:create',
      'action:edit',
      'evidence:view',
      'evidence:create',
      'evidence:link',
      'comment:create',
      'attachment:create',
    ],
    globalScope: false,
  },
];

const ROOT_ORG_UNIT_CODE = 'ROOT';
const ROOT_ORG_UNIT_NAME = 'PharosGRC';

export interface PlatformSeedResult {
  readonly permissionCount: number;
  readonly roleCount: number;
  readonly rootOrgUnitId: string;
  readonly adminUserId: string;
  readonly devFixturesSeeded: boolean;
}

export async function seedPlatform(
  prisma: PrismaClient,
  appConfig: AppConfigService,
): Promise<PlatformSeedResult> {
  const runDevFixtures = assertDevFixturesAllowed(appConfig);

  const adminPasswordHash = await hashPassword(requireAdminPassword(appConfig), appConfig.argon2);
  const devFixturePasswordHash = runDevFixtures
    ? await hashPassword(requireAdminPassword(appConfig), appConfig.argon2)
    : undefined;

  return prisma.$transaction(async (tx) => {
    const permissionsByIdentifier = await upsertPermissions(tx);
    const rolesByName = await upsertSystemRoles(tx, permissionsByIdentifier);
    const rootUnit = await upsertRootOrgUnit(tx);

    const admin = await upsertBootstrapAdmin(tx, {
      email: appConfig.seed.adminEmail,
      passwordHash: adminPasswordHash,
      role: rolesByName.get('Platform Administrator')!,
      primaryOrgUnitId: rootUnit.id,
    });

    let devFixturesSeeded = false;
    if (runDevFixtures && devFixturePasswordHash) {
      await seedDevFixtures(tx, {
        rolesByName,
        rootUnit,
        passwordHash: devFixturePasswordHash,
        provisionedByUserId: admin.id,
      });
      devFixturesSeeded = true;
    }

    return {
      permissionCount: permissionsByIdentifier.size,
      roleCount: rolesByName.size,
      rootOrgUnitId: rootUnit.id,
      adminUserId: admin.id,
      devFixturesSeeded,
    };
  });
}

function assertDevFixturesAllowed(appConfig: AppConfigService): boolean {
  const { devFixtures } = appConfig.seed;
  const { isProduction } = appConfig.app;

  if (devFixtures && isProduction) {
    throw new Error(
      'SEED_DEV_FIXTURES=true while NODE_ENV=production. Refusing to run the seed at all: ' +
        'development fixture users (with a known, shared, configuration-sourced password) must ' +
        'never be created in a production database. Set SEED_DEV_FIXTURES=false (or remove it) ' +
        'before seeding a production environment.',
    );
  }

  return devFixtures && !isProduction;
}

function requireAdminPassword(appConfig: AppConfigService): string {
  const { adminPassword } = appConfig.seed;
  if (!adminPassword) {
    throw new Error(
      'SEED_ADMIN_PASSWORD is not set. Refusing to seed a bootstrap administrator account with an ' +
        'empty/no password — set SEED_ADMIN_PASSWORD in apps/api/.env before running the seed.',
    );
  }
  return adminPassword;
}

async function hashPassword(password: string, argon2Settings: Argon2Settings): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: argon2Settings.memoryCost,
    timeCost: argon2Settings.timeCost,
    parallelism: argon2Settings.parallelism,
  });
}

async function upsertPermissions(
  tx: Prisma.TransactionClient,
): Promise<ReadonlyMap<PermissionIdentifier, { id: string }>> {
  const definitions = getAllPermissionDefinitions();
  const byIdentifier = new Map<PermissionIdentifier, { id: string }>();

  for (const definition of definitions) {
    const row = await tx.permission.upsert({
      where: { identifier: definition.identifier },
      create: {
        identifier: definition.identifier,
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
      },
      update: {
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
      },
      select: { id: true },
    });
    byIdentifier.set(definition.identifier as PermissionIdentifier, row);
  }

  return byIdentifier;
}

async function upsertSystemRoles(
  tx: Prisma.TransactionClient,
  permissionsByIdentifier: ReadonlyMap<PermissionIdentifier, { id: string }>,
): Promise<ReadonlyMap<string, { id: string }>> {
  const rolesByName = new Map<string, { id: string }>();

  for (const definition of SYSTEM_ROLE_DEFINITIONS) {
    const role = await tx.role.upsert({
      where: { name: definition.name },
      create: {
        name: definition.name,
        description: definition.description,
        isSystem: true,
      },
      update: {
        description: definition.description,
        isSystem: true,
      },
      select: { id: true },
    });
    rolesByName.set(definition.name, role);

    await reconcileRolePermissions(tx, role.id, definition.permissions, permissionsByIdentifier);
  }

  return rolesByName;
}

async function reconcileRolePermissions(
  tx: Prisma.TransactionClient,
  roleId: string,
  permissions: readonly PermissionIdentifier[],
  permissionsByIdentifier: ReadonlyMap<PermissionIdentifier, { id: string }>,
): Promise<void> {
  const desiredPermissionIds = new Set(
    permissions.map((identifier) => {
      const permission = permissionsByIdentifier.get(identifier);
      if (!permission) {
        throw new Error(
          `Role definition references permission identifier "${identifier}", which is not in ` +
            'getAllPermissionDefinitions(). Every role permission must be a real, registered ' +
            'permission identifier.',
        );
      }
      return permission.id;
    }),
  );

  const existing = await tx.rolePermission.findMany({
    where: { roleId },
    select: { permissionId: true },
  });
  const existingPermissionIds = new Set(existing.map((row) => row.permissionId));

  const toAdd = Array.from(desiredPermissionIds).filter((id) => !existingPermissionIds.has(id));
  const toRemove = Array.from(existingPermissionIds).filter((id) => !desiredPermissionIds.has(id));

  if (toAdd.length > 0) {
    await tx.rolePermission.createMany({
      data: toAdd.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
  }

  if (toRemove.length > 0) {
    await tx.rolePermission.deleteMany({
      where: { roleId, permissionId: { in: toRemove } },
    });
  }

  if (toAdd.length > 0 || toRemove.length > 0) {
    await tx.permissionCacheState.update({
      where: { id: 'singleton' },
      data: { permissionsVersion: { increment: 1 } },
    });
  }
}

interface SeededOrgUnit extends OrgUnitPathInfo {
  readonly code: string;
}

async function upsertRootOrgUnit(tx: Prisma.TransactionClient): Promise<SeededOrgUnit> {
  const existing = await tx.organizationalUnit.findUnique({
    where: { code: ROOT_ORG_UNIT_CODE },
    select: { id: true, path: true, depth: true },
  });

  if (existing) {
    return {
      id: existing.id,
      path: existing.path,
      depth: existing.depth,
      code: ROOT_ORG_UNIT_CODE,
    };
  }

  const id = randomUUID();
  const rootPath = computeRootPath(id);

  await tx.organizationalUnit.create({
    data: {
      id,
      code: ROOT_ORG_UNIT_CODE,
      name: ROOT_ORG_UNIT_NAME,
      parentId: null,
      path: rootPath.path,
      depth: rootPath.depth,
      status: OrgUnitStatus.ACTIVE,
    },
  });

  return { ...rootPath, code: ROOT_ORG_UNIT_CODE };
}

interface UpsertBootstrapAdminInput {
  readonly email: string;
  readonly passwordHash: string;
  readonly role: { id: string };
  readonly primaryOrgUnitId: string;
}

async function upsertBootstrapAdmin(
  tx: Prisma.TransactionClient,
  input: UpsertBootstrapAdminInput,
): Promise<{ id: string }> {
  const user = await tx.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      fullName: 'Platform Administrator',
      status: UserStatus.ACTIVE,
      primaryOrgUnitId: input.primaryOrgUnitId,
    },
    update: {},
    select: { id: true },
  });

  await ensureLocalCredential(tx, user.id, input.passwordHash);
  await ensureRoleAssignment(tx, {
    userId: user.id,
    roleId: input.role.id,
    grantedByUserId: user.id,
  });
  await ensureGlobalScopeGrant(tx, { userId: user.id, grantedByUserId: user.id });

  return user;
}

async function ensureLocalCredential(
  tx: Prisma.TransactionClient,
  userId: string,
  passwordHash: string,
): Promise<void> {
  const existing = await tx.localCredential.findUnique({ where: { userId }, select: { id: true } });
  if (existing) {
    return;
  }

  await tx.localCredential.create({
    data: {
      userId,
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}

async function ensureRoleAssignment(
  tx: Prisma.TransactionClient,
  input: { userId: string; roleId: string; grantedByUserId: string },
): Promise<void> {
  await tx.userRole.upsert({
    where: { userId_roleId: { userId: input.userId, roleId: input.roleId } },
    create: {
      userId: input.userId,
      roleId: input.roleId,
      grantedByUserId: input.grantedByUserId,
      grantedAt: new Date(),
    },
    update: {},
  });
}

async function ensureGlobalScopeGrant(
  tx: Prisma.TransactionClient,
  input: { userId: string; grantedByUserId: string },
): Promise<void> {
  const existing = await tx.orgScopeGrant.findFirst({
    where: { userId: input.userId, scopeType: OrgScopeType.GLOBAL },
    select: { id: true },
  });
  if (existing) {
    return;
  }

  await tx.orgScopeGrant.create({
    data: {
      userId: input.userId,
      scopeType: OrgScopeType.GLOBAL,
      orgUnitId: null,
      grantedByUserId: input.grantedByUserId,
      grantedAt: new Date(),
    },
  });
}

async function ensureUnitScopeGrant(
  tx: Prisma.TransactionClient,
  input: { userId: string; orgUnitId: string; grantedByUserId: string },
): Promise<void> {
  const existing = await tx.orgScopeGrant.findFirst({
    where: { userId: input.userId, scopeType: OrgScopeType.UNIT, orgUnitId: input.orgUnitId },
    select: { id: true },
  });
  if (existing) {
    return;
  }

  await tx.orgScopeGrant.create({
    data: {
      userId: input.userId,
      scopeType: OrgScopeType.UNIT,
      orgUnitId: input.orgUnitId,
      grantedByUserId: input.grantedByUserId,
      grantedAt: new Date(),
    },
  });
}

interface SeedDevFixturesInput {
  readonly rolesByName: ReadonlyMap<string, { id: string }>;
  readonly rootUnit: SeededOrgUnit;
  readonly passwordHash: string;
  readonly provisionedByUserId: string;
}

async function seedDevFixtures(
  tx: Prisma.TransactionClient,
  input: SeedDevFixturesInput,
): Promise<void> {
  const divisionA = await upsertChildOrgUnit(tx, input.rootUnit, 'DIV-A', 'Division A (fixture)');
  const divisionB = await upsertChildOrgUnit(tx, input.rootUnit, 'DIV-B', 'Division B (fixture)');
  const teamA1 = await upsertChildOrgUnit(
    tx,
    divisionA,
    'DIV-A-TEAM-1',
    'Division A / Team 1 (fixture)',
  );
  const teamA2 = await upsertChildOrgUnit(
    tx,
    divisionA,
    'DIV-A-TEAM-2',
    'Division A / Team 2 (fixture)',
  );

  await tx.control.upsert({
    where: { code: 'FIXTURE-CONTROL-1' },
    create: {
      code: 'FIXTURE-CONTROL-1',
      name: 'Controle de acesso lógico (fixture)',
      isActive: true,
    },
    update: {},
  });
  await tx.process.upsert({
    where: { code: 'FIXTURE-PROCESS-1' },
    create: {
      code: 'FIXTURE-PROCESS-1',
      name: 'Processo de aprovação de pagamentos (fixture)',
      isActive: true,
      orgUnitId: divisionA.id,
    },
    update: { orgUnitId: divisionA.id },
  });
  await tx.asset.upsert({
    where: { code: 'FIXTURE-ASSET-1' },
    create: {
      code: 'FIXTURE-ASSET-1',
      name: 'Servidor de banco de dados (fixture)',
      isActive: true,
      orgUnitId: divisionA.id,
    },
    update: { orgUnitId: divisionA.id },
  });

  const fixtureUnitsRoundRobin = [divisionA, divisionB, teamA1, teamA2];

  const SHARED_ANALYST_APPROVER_UNIT_ROLE_NAMES = new Set(['Risk Analyst', 'Risk Approver']);

  for (const [index, definition] of SYSTEM_ROLE_DEFINITIONS.entries()) {
    const role = input.rolesByName.get(definition.name);
    if (!role) {
      throw new Error(`Role "${definition.name}" was not seeded — cannot create its fixture user.`);
    }

    const orgUnit = SHARED_ANALYST_APPROVER_UNIT_ROLE_NAMES.has(definition.name)
      ? teamA1
      : fixtureUnitsRoundRobin[index % fixtureUnitsRoundRobin.length]!;
    const email = `fixture-${slugify(definition.name)}@pharosgrc.local`;

    const existingFixtureUser = await tx.user.findUnique({
      where: { email },
      select: { primaryOrgUnitId: true },
    });
    if (existingFixtureUser && existingFixtureUser.primaryOrgUnitId !== orgUnit.id) {
      console.log(
        `[platform.seed] Reconciling primaryOrgUnitId for ${email}: ` +
          `${existingFixtureUser.primaryOrgUnitId ?? 'null'} -> ${orgUnit.id}.`,
      );
    }

    const user = await tx.user.upsert({
      where: { email },
      create: {
        email,
        fullName: `Fixture — ${definition.name}`,
        status: UserStatus.ACTIVE,
        primaryOrgUnitId: orgUnit.id,
      },
      update: { primaryOrgUnitId: orgUnit.id },
      select: { id: true },
    });

    await ensureLocalCredential(tx, user.id, input.passwordHash);
    await ensureRoleAssignment(tx, {
      userId: user.id,
      roleId: role.id,
      grantedByUserId: input.provisionedByUserId,
    });

    if (definition.globalScope) {
      await ensureGlobalScopeGrant(tx, {
        userId: user.id,
        grantedByUserId: input.provisionedByUserId,
      });
    } else {
      await ensureUnitScopeGrant(tx, {
        userId: user.id,
        orgUnitId: orgUnit.id,
        grantedByUserId: input.provisionedByUserId,
      });
    }
  }
}

async function upsertChildOrgUnit(
  tx: Prisma.TransactionClient,
  parent: SeededOrgUnit,
  code: string,
  name: string,
): Promise<SeededOrgUnit> {
  const existing = await tx.organizationalUnit.findUnique({
    where: { code },
    select: { id: true, path: true, depth: true },
  });
  if (existing) {
    return { id: existing.id, path: existing.path, depth: existing.depth, code };
  }

  const id = randomUUID();
  const childPath = computeChildPath(parent, id);

  await tx.organizationalUnit.create({
    data: {
      id,
      code,
      name,
      parentId: parent.id,
      path: childPath.path,
      depth: childPath.depth,
      status: OrgUnitStatus.ACTIVE,
    },
  });

  return { ...childPath, code };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
