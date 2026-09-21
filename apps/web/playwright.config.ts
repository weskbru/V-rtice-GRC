import { defineConfig, devices } from '@playwright/test';

import { loadWebEnv } from './src/lib/env';

/**
 * Playwright configuration (T049).
 *
 * `baseURL` comes from `APP_ORIGIN` (validated, ADR-014's single origin —
 * every journey navigates through the Next.js app, never the API directly).
 * `webServer` starts the app itself against that same origin so `pnpm
 * --filter @pharos/web test:e2e` is runnable on its own; set
 * `PLAYWRIGHT_SKIP_WEB_SERVER=true` to point the suite at an already-running
 * stack (e.g. the full Docker Compose stack in CI) instead.
 *
 * `workers` is no longer pinned to a pool-size constant (F-16's original
 * fix, RETIRED by D-17/research.md step 3): that pin existed only because
 * `signInAsWorkerAdmin` used to index into a FIXED-SIZE, pre-seeded pool of
 * twelve accounts, partitioned per project — running more workers than the
 * pool had slots reintroduced the exact password-rotation race F-16 fixed.
 * `admin-session.ts` now PROVISIONS each worker's identity on demand,
 * keyed by `testInfo.workerIndex` (globally unique for the run, across
 * every project, by Playwright's own guarantee) — there is no fixed array
 * to overflow, so no cap is required for correctness. Left at a plain
 * literal rather than Playwright's own CPU-based default so local runs and
 * CI stay predictable; raise or lower freely, it is a throughput choice
 * now, not a safety requirement.
 */
const { APP_ORIGIN } = loadWebEnv();

export default defineConfig({
  testDir: './e2e',
  // Rotates the bootstrap administrator and every named fixture account
  // (`FIXTURE_USER_EMAIL`) exactly once, before any worker exists — see
  // `./e2e/support/global-setup.ts`'s own header for the race this closes.
  globalSetup: './e2e/support/global-setup',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 4,
  /**
   * `execution-ledger-reporter` is not decoration on top of the summary
   * Playwright already prints — it is the gate (F-72). The built-in reporters
   * count "did not run" as one yellow token below "failed", and a run can exit
   * 0 with discovered tests that never executed; the ledger prints the full
   * decomposition (DISCOVERED / EXECUTED / PASSED / FAILED / FLAKY / SKIPPED /
   * NOT RUN / INTERRUPTED), names every test in the last two buckets, and
   * refuses to let such a run be classified green. Its own header carries the
   * measurement that motivated it.
   *
   * Last in the list on purpose: it writes its verdict after the other
   * reporters have printed theirs, so the decomposition is the final thing on
   * the terminal rather than the thing scrolled past.
   */
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['./e2e/support/execution-ledger-reporter.ts']]
    : [['list'], ['html', { open: 'never' }], ['./e2e/support/execution-ledger-reporter.ts']],
  use: {
    baseURL: APP_ORIGIN,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  /**
   * ## The default stays `pnpm dev`, and F-71 is the reason it is worth saying why
   *
   * F-71 was reclassified on 2026-09-14: the hanging `aria-controls` that
   * axe reports as a CRITICAL `aria-valid-attr-value` violation on every
   * collapsible `FilterBar` is an artefact of the DEVELOPMENT server. Measured:
   * ~3.3% of loads under `next dev --turbopack` (8 in ~244), **0 in 165** under
   * `next build` + `next start`, including under deliberate CPU and network
   * throttling. The three CI E2E jobs build the app and serve it with
   * `next start`, passing `PLAYWRIGHT_SKIP_WEB_SERVER=true` — CI was never
   * exposed. The local default below is.
   *
   * Two of the failures F-72 counted in its long run (the risk-register and
   * control-catalog filter-panel scans) are that artefact, and they cost two
   * phases of investigation before anyone knew it.
   *
   * ### Why this is NOT fixed by changing the command here
   *
   * `reuseExistingServer` is `true` off CI, and it is checked BEFORE the
   * command runs: if anything already answers on `APP_ORIGIN` — and on a
   * developer machine that is almost always `pnpm dev`, started by hand — this
   * command is never executed at all. Swapping it for a production build would
   * therefore change nothing in the common case, and in the uncommon case it
   * would silently insert a multi-minute `next build` into the first
   * `playwright test` somebody runs. Worse, it would be built with a dev server
   * possibly still up, which D-16 forbids outright.
   *
   * So the configuration cannot GUARANTEE parity, and pretending otherwise is
   * the real hazard. What it can do is make the ambiguity impossible, and that
   * is what was built instead:
   *
   * - `e2e/support/global-setup.ts` probes the application actually answering
   *   on `APP_ORIGIN` and prints, before any test runs, whether it is a
   *   development or a production build — so a dev-server-only axe violation
   *   can never again be read as a product defect, and a "local run mirrors
   *   CI" claim is checkable rather than assumed;
   * - `pnpm --filter @pharos/web run test:e2e:ci-parity` is the one-command
   *   form of F-71's own recommendation (build, `next start`,
   *   `PLAYWRIGHT_SKIP_WEB_SERVER=true`), for whoever wants the parity rather
   *   than the fast inner loop.
   */
  ...(process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: APP_ORIGIN,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
