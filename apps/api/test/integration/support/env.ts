/**
 * Integration test environment guard (T031/T032 harness).
 *
 * Every integration spec imports this module (transitively, through
 * `support/test-app.ts` or `support/database-roles.ts`) BEFORE anything
 * that constructs `AppConfigModule`/`PrismaService`. Its job is narrow but
 * load-bearing: make it structurally impossible for the integration suite
 * to point at the development database (`pharos_grc`) instead of the test
 * database (`pharos_grc_test`), per docs/local-environment.md D-4 and the
 * working rule "must not touch the dev database".
 *
 * `@nestjs/config`'s `ConfigModule.forRoot()` loads `apps/api/.env` via
 * `dotenv`, which — like this file — never overrides a variable already
 * present in `process.env`. Setting `DATABASE_URL`/`DATABASE_MIGRATION_URL`
 * here, before that happens, is therefore sufficient to redirect the whole
 * application's configuration at the test database without needing a
 * second `.env` file or a code branch in `AppConfigService` itself.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { config as loadDotenv } from 'dotenv';

// Loads apps/api/.env for every variable this process does not already
// have (CI sets them directly as job env vars and never has a `.env`
// file, so this is a no-op there; local development gets the rest of the
// schema — SESSION_*, ARGON2_*, ... — from the checked-in dev `.env`).
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

/**
 * Extracts the database name from a `postgresql://user:pass@host:port/db`
 * connection string. Deliberately crude (no full URL parser needed) — good
 * enough to tell `pharos_grc` from `pharos_grc_test`.
 */
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

// Redirect the application's own configuration at the test database. Must
// run before any import of `AppConfigModule`/`PrismaService` in this
// worker/process — every support module that needs those imports this
// file first for exactly that reason.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.DATABASE_MIGRATION_URL = TEST_DATABASE_MIGRATION_URL;

/** A fresh, unique-per-call marker for tests to scope fixtures/assertions
 * by, so tests never depend on `audit_event` (or any other table) being
 * empty at the start of a test — see support/README in this directory for
 * why that table specifically can never be truncated between tests.
 *
 * F-45/F-54 (`docs/deferred-findings.md`) — fixed at the root, 2026-09-18:
 * `information-disclosure.spec.ts`'s `RAW_SESSION_TOKEN` sweep anchors on
 * a value that is EXACTLY 43 characters of `[A-Za-z0-9_-]` — a real opaque
 * session token's own shape. `${prefix}-${randomUUID()}` is
 * `prefix.length + 1 + 36` characters; whenever `prefix` is exactly 6
 * characters, the total lands on exactly 43 and a completely unrelated
 * fixture (an org unit code, in every case measured so far) collides with
 * the sweep by pure arithmetic coincidence. This was patched per-prefix
 * four separate times (`av-org`, `pi-org`, `au-org`, `cm-org`) before this
 * fix — each patch just relocated the same landmine to the next 6-character
 * prefix some other spec file would eventually choose, since nothing
 * stopped a caller from picking one. A single trailing character whenever
 * the total would be exactly 43 makes the collision impossible for EVERY
 * prefix length, forever, without asking every caller (872 call sites) to
 * avoid a length nobody was ever told to avoid. */
export function uniqueTestMarker(prefix: string): string {
  const marker = `${prefix}-${randomUUID()}`;
  return marker.length === 43 ? `${marker}-` : marker;
}
