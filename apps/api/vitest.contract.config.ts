/**
 * T050/T051 — dedicated Vitest project for the contract test suite
 * (`test/contract/**`), separate from `vitest.config.ts` (pure unit tests)
 * and `vitest.integration.config.ts` (service-level integration tests).
 *
 * Contract tests exercise the real HTTP surface (`supertest` against a
 * fully bootstrapped `AppModule`, exactly as `main.ts` configures it) to
 * verify behavior against `specs/001-grc-platform-foundation/contracts/*.yaml`
 * — they need the same real PostgreSQL test database and the same
 * migrate-then-run lifecycle as the integration suite, so this config
 * mirrors `vitest.integration.config.ts` closely (single-worker, sequential
 * execution against one shared `pharos_grc_test` database, migrated once
 * via the same `globalSetup`).
 *
 * `pnpm --filter @pharos/api run test:contract` uses this config
 * exclusively (see `package.json`).
 *
 * F-57 (`docs/deferred-findings.md`): `maxWorkers: 1` — see
 * `vitest.integration.config.ts`'s own header for why this replaces
 * `poolOptions.forks.singleFork` (removed outright in Vitest 4) without
 * also setting `isolate: false`.
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
    include: ['test/contract/**/*.spec.ts'],
    globalSetup: ['test/integration/support/global-setup.ts'],
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
