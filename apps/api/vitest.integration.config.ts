/**
 * Dedicated Vitest project for integration tests (T031/T032 harness),
 * separate from `vitest.config.ts` (unit tests — pure domain, no I/O, no
 * database). `pnpm --filter @pharos/api run test:integration` uses this
 * config exclusively.
 *
 * `fileParallelism: false` + `pool: 'forks'` with `maxWorkers: 1`: these
 * tests share one real PostgreSQL database (`pharos_grc_test`). Running
 * spec files sequentially in one process removes any need to reason about
 * connection-pool exhaustion or cross-file ordering races, at the cost of
 * some wall-clock time this suite does not yet need to optimize for.
 * `globalSetup` (support/global-setup.ts) runs once before every file:
 * applies pending migrations and resets mutable tables.
 *
 * F-57 (`docs/deferred-findings.md`): `maxWorkers: 1` replaces the pre-v4
 * `poolOptions.forks.singleFork: true`, which Vitest 4 removed outright
 * (`test.poolOptions` no longer exists — see
 * https://v4.vitest.dev/guide/migration, "pool rework": `maxThreads`/
 * `maxForks` became the single top-level `maxWorkers`). Deliberately NOT
 * paired with `isolate: false` (the literal old-`singleFork` equivalent
 * per that guide) — this suite's isolation requirement was always "one
 * process, one database connection at a time" (the comment above), never
 * "share a JS module registry across spec files", and `isolate: false`
 * would relax an unrelated guarantee this config never asked for. Default
 * `isolate` (`true`) plus `fileParallelism: false` plus `maxWorkers: 1`
 * reproduces the exact single-process, sequential-file behavior verified
 * against a real Postgres run before this change.
 */
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    root: './',
    environment: 'node',
    globals: false,
    passWithNoTests: false,
    include: ['test/integration/**/*.spec.ts'],
    globalSetup: ['test/integration/support/global-setup.ts'],
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
    // Migrations + real Postgres round-trips are slower than unit tests.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
