import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { resetMutableTestData } from './database-roles';
import { TEST_DATABASE_MIGRATION_URL, TEST_DATABASE_URL } from './env';

function runPrismaMigrateDeploy(): void {
  const prismaPackageJson = require.resolve('prisma/package.json');
  const prismaCliEntry = path.join(path.dirname(prismaPackageJson), 'build', 'index.js');
  const schemaPath = path.resolve(__dirname, '../../../prisma/schema.prisma');

  const result = spawnSync(
    process.execPath,
    [prismaCliEntry, 'migrate', 'deploy', '--schema', schemaPath],
    {
      cwd: path.resolve(__dirname, '../../..'),
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
        DATABASE_MIGRATION_URL: TEST_DATABASE_MIGRATION_URL,
      },
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `"prisma migrate deploy" against the test database failed (exit code ${String(result.status)}).`,
    );
  }
}

export async function setup(): Promise<void> {
  console.log('[integration-setup] Applying migrations to the test database (migrate deploy)...');
  runPrismaMigrateDeploy();

  console.log('[integration-setup] Resetting mutable test tables (audit_event excluded)...');
  await resetMutableTestData();

  console.log('[integration-setup] Ready.');
}
