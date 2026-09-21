/**
 * Vitest `globalSetup` for the integration project (T031/T032 harness).
 * Runs exactly once for the whole `pnpm --filter @pharos/api run
 * test:integration` invocation, before any test file executes:
 *
 *   1. Ensures the test schema is migrated (`prisma migrate deploy`
 *      against `TEST_DATABASE_MIGRATION_URL` — the owner role; NEVER
 *      `migrate dev`, per schema.prisma's header comment: Prisma's diff
 *      engine is unaware of `audit_event`'s hand-written partitioning and
 *      would try to "fix" it).
 *   2. Resets ordinary tables to empty (`resetMutableTestData` —
 *      `audit_event` deliberately excluded; see that function's comment).
 *
 * This file is loaded by Vitest in its own process/context, independent
 * of the worker(s) that run test files — importing `./env` here re-runs
 * (harmlessly) the same guard/redirection those workers also apply on
 * their own first import, so this step alone is never sufficient for a
 * test file's own `PrismaService`/`AppConfigModule` to see the test
 * database; each test file's own import chain must (and does, via
 * support/test-app.ts) import `./env` too.
 */
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
  // Plain console output, not pino: this runs before any Nest application
  // (and its logging infrastructure) exists — it is the harness's own
  // bootstrap step, useful for CI logs.
  console.log('[integration-setup] Applying migrations to the test database (migrate deploy)...');
  runPrismaMigrateDeploy();

  console.log('[integration-setup] Resetting mutable test tables (audit_event excluded)...');
  await resetMutableTestData();

  console.log('[integration-setup] Ready.');
}
