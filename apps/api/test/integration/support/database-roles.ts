import { PrismaClient } from '@prisma/client';

import { TEST_DATABASE_MIGRATION_URL, TEST_DATABASE_URL } from './env';

export function createAppRolePrismaClient(): PrismaClient {
  return new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
}

export function createOwnerRolePrismaClient(): PrismaClient {
  return new PrismaClient({ datasourceUrl: TEST_DATABASE_MIGRATION_URL });
}

const MUTABLE_TABLES_IN_FK_SAFE_ORDER = [
  'risk_assessments',
  'risk_methodology_versions',
  'risk_methodologies',
  'risk_causes',
  'risk_consequences',
  'risks',
  'risk_categories',
  'risk_types',
  'risk_origins',
  'org_scope_grants',
  'user_roles',
  'role_permissions',
  'sessions',
  'external_identities',
  'local_credentials',
  'roles',
  'permissions',
  'users',
  'organizational_units',
] as const;

async function listAuditEventTruncateTriggerTargets(
  owner: PrismaClient,
): Promise<readonly string[]> {
  const rows = await owner.$queryRawUnsafe<{ relname: string }[]>(
    `SELECT 'audit_event' AS relname
     UNION ALL
     SELECT c.relname
     FROM pg_inherits i
     JOIN pg_class c ON c.oid = i.inhrelid
     JOIN pg_class p ON p.oid = i.inhparent
     JOIN pg_namespace n ON n.oid = p.relnamespace
     WHERE p.relname = 'audit_event' AND n.nspname = 'public'`,
  );
  return rows.map((row) => row.relname);
}

async function setAuditEventTruncateGuardEnabled(
  owner: PrismaClient,
  targets: readonly string[],
  enabled: boolean,
): Promise<void> {
  for (const target of targets) {
    await owner.$executeRawUnsafe(
      `ALTER TABLE "${target}" ${enabled ? 'ENABLE' : 'DISABLE'} TRIGGER audit_event_prevent_truncate`,
    );
  }
}

export async function resetMutableTestData(): Promise<void> {
  const owner = createOwnerRolePrismaClient();
  try {
    const tableList = MUTABLE_TABLES_IN_FK_SAFE_ORDER.map((table) => `"${table}"`).join(', ');

    const auditEventTruncateTargets = await listAuditEventTruncateTriggerTargets(owner);
    await setAuditEventTruncateGuardEnabled(owner, auditEventTruncateTargets, false);
    try {
      await owner.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
    } finally {
      await setAuditEventTruncateGuardEnabled(owner, auditEventTruncateTargets, true);
    }
  } finally {
    await owner.$disconnect();
  }
}
