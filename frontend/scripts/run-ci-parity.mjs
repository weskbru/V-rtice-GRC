import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:3000';
const { hostname, port } = new URL(APP_ORIGIN);
const PORT = Number(port || '3000');
const READY_TIMEOUT_MS = 120_000;
const forwarded = process.argv.slice(2);

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
    } catch {}
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
        '[ci-parity] frontend/.next. Stop it first, then run this again.\n' +
        '[ci-parity] (If you only want the fast inner loop, `pnpm --filter @vertice/web test:e2e`\n' +
        '[ci-parity]  against the running dev server is the right command — but read F-71 before\n' +
        '[ci-parity]  reporting an accessibility violation found that way.)\n',
    );
    process.exit(1);
  }

  const nextDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.next');
  console.log(
    `[ci-parity] Removing ${nextDir} so the build does not inherit a dev/Turbopack tree…`,
  );
  rmSync(nextDir, { recursive: true, force: true });

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
    detached: process.platform !== 'win32',
  });

  let stopped = false;
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
