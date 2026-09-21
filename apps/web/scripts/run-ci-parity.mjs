import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `pnpm --filter @pharos/web run test:e2e:ci-parity`
 *
 * Runs the E2E suite the way the three CI jobs do — against a PRODUCTION
 * build served by `next start`, with `PLAYWRIGHT_SKIP_WEB_SERVER=true` — and
 * refuses to start if doing so would break D-16.
 *
 * ## Why this exists at all (F-71)
 *
 * F-71 was reclassified after being measured both ways: the hanging
 * `aria-controls` that axe reports as a CRITICAL `aria-valid-attr-value`
 * violation on every collapsible `FilterBar` happens in ~3.3% of loads under
 * `next dev --turbopack` and **0 times in 165 loads** under `next build` +
 * `next start`. CI has always built and served the app, so CI never saw it.
 * The local default (`playwright.config.ts`'s `webServer: { command: 'pnpm
 * dev' }`) does, and two of the failures F-72 counted in its long run are that
 * artefact rather than a defect of the product.
 *
 * `playwright.config.ts` cannot fix this on its own: `reuseExistingServer` is
 * true off CI and is evaluated BEFORE the command runs, so a dev server
 * already listening is used whatever the config says. This script is the
 * explicit path instead of a configuration that would only appear to be one.
 *
 * ## The four things it does that a shell one-liner would not
 *
 * 1. **Refuses to build while something is already serving the origin.**
 *    D-16 (`docs/local-environment.md`) forbids running the web build with the
 *    dev server up — they share `.next`. A `next build && next start` written
 *    by hand does not check, and the failure it produces is confusing rather
 *    than explanatory.
 * 2. **Deletes `.next` before building**, which is the OTHER half of D-16 and
 *    the half that is easy to forget. Measured, not anticipated: the first run
 *    of this script stopped the dev server, left its Turbopack `.next` in
 *    place, and `next build` died in "Collecting page data" with
 *    `PageNotFoundError: Cannot find module for page: /_document` — a message
 *    that says nothing about the actual cause. F-71's own measurement protocol
 *    already records deleting `.next` before every mode switch; this encodes
 *    it rather than trusting the reader to remember. It runs only AFTER the
 *    port check, so the directory is never removed under a live server.
 * 3. **No new dependency.** No `concurrently`, no `wait-on`, no `cross-env` —
 *    CLAUDE.md §2 ("não introduzir dependências sem justificativa"), and three
 *    packages to run one command is not a justification.
 * 4. **Stops the server it started**, on every exit path, including a failing
 *    test run — so a second invocation does not hit the D-16 guard because of
 *    the first one.
 *
 * Every argument after the script name is forwarded to Playwright, so
 * `... run test:e2e:ci-parity -- --project=chromium accessibility.spec.ts`
 * works exactly as it would against `playwright test`.
 */

const APP_ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:3000';
const { hostname, port } = new URL(APP_ORIGIN);
const PORT = Number(port || '3000');
const READY_TIMEOUT_MS = 120_000;
const forwarded = process.argv.slice(2);

/** Resolves true when something is listening on the origin's port. */
function isPortBusy() {
  return new Promise((resolve) => {
    const socket = connect({ host: hostname, port: PORT });
    const done = (busy) => {
      socket.destroy();
      resolve(busy);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(2_000, () => done(false));
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true, ...options });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function waitForServer() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(APP_ORIGIN, { redirect: 'manual' });
      if (response.status > 0) {
        return;
      }
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${APP_ORIGIN} did not become reachable within ${String(READY_TIMEOUT_MS)}ms.`);
}

async function main() {
  if (await isPortBusy()) {
    console.error(
      `\n[ci-parity] Something is already listening on ${APP_ORIGIN}.\n` +
        '[ci-parity] This script builds the web application, and D-16 (docs/local-environment.md)\n' +
        '[ci-parity] forbids running that build with the development server up — they share\n' +
        '[ci-parity] apps/web/.next. Stop it first, then run this again.\n' +
        '[ci-parity] (If you only want the fast inner loop, `pnpm --filter @pharos/web test:e2e`\n' +
        '[ci-parity]  against the running dev server is the right command — but read F-71 before\n' +
        '[ci-parity]  reporting an accessibility violation found that way.)\n',
    );
    process.exit(1);
  }

  // D-16's other half. The port is confirmed free above, so nothing is
  // serving out of this directory while it is removed.
  const nextDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.next');
  console.log(
    `[ci-parity] Removing ${nextDir} so the build does not inherit a dev/Turbopack tree…`,
  );
  rmSync(nextDir, { recursive: true, force: true });

  /*
   * `NODE_ENV=production` for the build and the server, whatever the shell
   * inherited.
   *
   * Measured, again rather than anticipated: this repository's `.env` carries
   * `NODE_ENV=development`, and sourcing it (which D-22 Trap 4 tells every
   * local runner to do, for `SEED_ADMIN_*`) makes `next build` fail during
   * "Generating static pages" with `<Html> should not be imported outside of
   * pages/_document` while prerendering `/404` — a message about a file this
   * App Router project does not contain. CI does not hit it because its
   * `build` job sets no `NODE_ENV` at all, so Next picks `production` itself.
   * Forcing it here is what makes "parity" true rather than aspirational.
   */
  const productionEnv = { ...process.env, NODE_ENV: 'production' };

  console.log('[ci-parity] Building the web application (next build)…');
  const buildCode = await run('pnpm', ['exec', 'next', 'build'], { env: productionEnv });
  if (buildCode !== 0) {
    process.exit(buildCode);
  }

  console.log(`[ci-parity] Starting the production server on ${APP_ORIGIN} (next start)…`);
  const server = spawn('pnpm', ['exec', 'next', 'start', '--port', String(PORT)], {
    stdio: 'inherit',
    shell: true,
    env: productionEnv,
    // POSIX: its own process group, so `process.kill(-pid)` below reaches the
    // whole tree. Windows ignores this and uses `taskkill /T` instead.
    detached: process.platform !== 'win32',
  });

  let stopped = false;
  /*
   * Kills the whole TREE, not the handle.
   *
   * `spawn(..., { shell: true })` makes `server.pid` the shell/pnpm wrapper,
   * and `next start` is its grandchild — the process that actually holds the
   * port. `server.kill()` reaps the wrapper and orphans the listener, which on
   * the next invocation shows up as this script's own D-16 refusal complaining
   * about a server it left behind itself. Measured on this machine while
   * writing it: port 3000 still occupied by a `start-server.js` whose parent
   * was already gone.
   */
  const stopServer = () => {
    if (stopped || server.pid === undefined) {
      return;
    }
    stopped = true;
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        process.kill(-server.pid, 'SIGTERM');
      }
    } catch {
      server.kill();
    }
  };
  process.once('SIGINT', () => {
    stopServer();
    process.exit(130);
  });

  try {
    await waitForServer();
    console.log(
      '[ci-parity] Server is up. Running Playwright with PLAYWRIGHT_SKIP_WEB_SERVER=true.',
    );
    const testCode = await run('pnpm', ['exec', 'playwright', 'test', ...forwarded], {
      env: { ...process.env, PLAYWRIGHT_SKIP_WEB_SERVER: 'true' },
    });
    process.exitCode = testCode;
  } finally {
    stopServer();
  }
}

main().catch((error) => {
  console.error(`[ci-parity] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
