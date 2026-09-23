import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: path.resolve(__dirname, '../../../.env'), override: false });

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} must be set to run integration tests. Copy apps/api/.env.example to ` +
        'apps/api/.env (or export it in the shell/CI job) — see docs/local-environment.md.',
    );
  }
  return value;
}

function databaseNameOf(connectionString: string): string | undefined {
  const match = /\/([^/?]+)(?:\?.*)?$/.exec(connectionString);
  return match?.[1];
}

function assertPointsAtTestDatabase(connectionString: string, varName: string): void {
  const dbName = databaseNameOf(connectionString);
  if (!dbName?.endsWith('_test')) {
    throw new Error(
      `${varName} does not look like a test database (parsed name: "${String(dbName)}", ` +
        'expected one ending in "_test"). Refusing to run integration tests against it — this ' +
        'guard exists specifically so the suite can never accidentally run against pharos_grc.',
    );
  }
}

export const TEST_DATABASE_URL = requiredEnv('TEST_DATABASE_URL');
export const TEST_DATABASE_MIGRATION_URL = requiredEnv('TEST_DATABASE_MIGRATION_URL');

assertPointsAtTestDatabase(TEST_DATABASE_URL, 'TEST_DATABASE_URL');
assertPointsAtTestDatabase(TEST_DATABASE_MIGRATION_URL, 'TEST_DATABASE_MIGRATION_URL');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.DATABASE_MIGRATION_URL = TEST_DATABASE_MIGRATION_URL;

export function uniqueTestMarker(prefix: string): string {
  const marker = `${prefix}-${randomUUID()}`;
  return marker.length === 43 ? `${marker}-` : marker;
}
