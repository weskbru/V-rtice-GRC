import { request } from '@playwright/test';

import { FIXTURE_USER_EMAIL } from './admin-session';

import type { APIRequestContext, FullConfig } from '@playwright/test';

/**
 * Playwright `globalSetup` — closes the shared-mutable-credential race
 * diagnosed against CI run `34594939253` (`test:e2e (firefox + webkit)`,
 * commit `e99d978`).
 *
 * ## The mechanism this removes
 *
 * Every seeded account this suite signs into is created with
 * `mustChangePassword = true` (`platform.seed.ts`'s own header comment: "no
 * seeded account that lands on the dashboard on its very first sign-in").
 * `admin-session.ts`'s `signInAsSeededUser` handles that by trying the
 * ROTATED password first (the common case: some earlier run already
 * completed the change) and falling back to the plain seeded password only
 * on a genuine 401 (the fresh-database case).
 *
 * For an account more than one Playwright WORKER can reach — the bootstrap
 * administrator (`SEED_ADMIN_EMAIL`, read by every worker's own
 * `ensureWorkerAdminProvisioned` to provision that worker's identity) and
 * every fixture account in `FIXTURE_USER_EMAIL` (signed into directly by
 * several spec files) — that fallback is a race, proven directly against
 * the run above:
 *
 *   Worker A tries the rotated password (401 — the account is still on the
 *   plain one), falls back to plain, succeeds, and completes the mandatory
 *   change, rotating the password and (FR-017) revoking every session for
 *   that account. Worker B, doing the same thing concurrently, also gets a
 *   401 on the rotated password and falls back to plain — but by the time
 *   ITS fallback reaches the server, A has already rotated it. B's fallback
 *   now fails too: `AuthOrchestrator.login` throws `UnauthorizedDomainError`
 *   ("E-mail ou senha incorretos."), which is exactly the
 *   `the credentials were genuinely refused (401)` outcome
 *   `admin-session.ts`'s `signInAsSeededUser` surfaces once BOTH branches are
 *   exhausted.
 *
 * The run's own `api.log` contains the decisive proof this is a real
 * collision and not two independent failures: at `11:46:41.338Z`,
 * `AuthOrchestrator.changeOwnPassword` rejected a password change with
 * "A senha atual informada está incorreta." — the current-password check
 * failing. No spec ever submits a deliberately wrong current password (the
 * only spec that reaches that field, `auth.spec.ts`, always submits
 * whichever password its OWN sign-in attempt just succeeded with), so this
 * can only mean a second worker's change-password call landed after a
 * first worker had already rotated the same account's password out from
 * under it — sitting inside a five-event storm of login 401s between
 * `11:46:29Z` and `11:46:41.981Z`, exactly when every worker's first
 * provisioning call lands on the shared bootstrap account at once.
 *
 * A second, distinct symptom of the SAME defect: every successful
 * `changeOwnPassword` revokes every session for that account (FR-017,
 * `AuthOrchestrator.changeOwnPassword`) — so any OTHER worker mid-test,
 * already signed in as that same shared account, has its session yanked out
 * from under it the instant some unrelated worker rotates the password.
 * That produced the run's `SessionGuard`-rejected "Autenticação
 * necessária." bursts and is the more likely explanation for the early,
 * UI-assertion-shaped Firefox failures (session invalidated mid-test reads
 * as a broken assertion, not a network timeout).
 *
 * ## The fix
 *
 * Locking the provisioning step would only serialize the collision, not
 * remove it — a rotation would still eventually happen while some other
 * worker holds a session as that account, so the revocation half of the
 * defect would remain. Instead: perform the ONE rotation each shared
 * account will ever need HERE, deterministically, before any worker exists.
 * By the time the first worker starts, every shared account already holds
 * its rotated password and `mustChangePassword = false` — every worker's
 * own `signInAsSeededUser` call therefore succeeds on its FIRST (rotated)
 * attempt, unconditionally. No worker ever falls back to the plain
 * password, no worker ever calls `POST /auth/me/password` against one of
 * these accounts, and therefore nothing ever revokes another worker's
 * session on one. The race is not made less likely; the code path that
 * could produce it is never reached at all.
 *
 * `auth.spec.ts`'s own dedicated identity (`provisionAuthJourneyAccount` in
 * `admin-session.ts`) is deliberately NOT rotated here, or listed here at
 * all — that spec's entire premise is signing into an account that has
 * NEVER authenticated, and it provisions a brand-new one for itself on
 * every invocation. Rotating it here would defeat the test it exists to
 * run.
 *
 * ## Ordering: this runs after `webServer`, never before it
 *
 * Checked directly against the pinned `playwright`/`@playwright/test`
 * `1.63.0` (`lib/runner/index.js`): `createGlobalSetupTasks` builds its task
 * list as `[clear output, ...pluginSetupTasks, ...globalTeardowns,
 * ...globalSetups]`, and `webServer` is registered as a plugin
 * (`webServerPluginsForConfig`), so its setup task runs — and is fully
 * awaited — strictly BEFORE this file's `globalSetup` export. That plugin's
 * own `setup()` (`WebServerPlugin._waitForProcess`) blocks until
 * `config.webServer.url` responds or `config.webServer.timeout` elapses, so
 * this function is guaranteed to start only once `playwright.config.ts`'s
 * `webServer` block (when active — i.e. `PLAYWRIGHT_SKIP_WEB_SERVER` unset)
 * has confirmed `APP_ORIGIN` reachable. This is a fact about this pinned
 * version's own source, not an assumption.
 *
 * That guarantee covers only `apps/web` (`webServer.command: 'pnpm dev'`) —
 * the SAME gap this file's own `playwright.config.ts` comment already
 * names for the `webServer` block itself: "it has no way to also start
 * apps/api". In CI, `PLAYWRIGHT_SKIP_WEB_SERVER=true` disables that block
 * entirely, and the workflow's own shell loop already confirms both
 * `apps/api` and `apps/web` are answering before `playwright test` is
 * invoked at all — this function starts with both already up. Locally,
 * nothing plays that role: `docs/local-environment.md` expects a developer
 * to have started `apps/api` themselves (Docker Compose) before running
 * this suite, and every OTHER spec in this suite already depends on that
 * silently. `waitForApiReady` below makes that dependency explicit and
 * gives it a bounded, legible wait instead of letting the first rotation
 * call fail with a network error that does not say what it was waiting for.
 */
/**
 * F-71 — says, before any test runs, whether the application answering
 * `APP_ORIGIN` is a DEVELOPMENT server or a PRODUCTION build.
 *
 * ## Why a run has to declare this about itself
 *
 * F-71 was measured both ways and reclassified: a `useId` mismatch between the
 * streamed server HTML and the client hydration leaves every collapsible
 * `FilterBar`'s disclosure button pointing `aria-controls` at an element that
 * does not exist, which axe reports as `aria-valid-attr-value`,
 * `impact: critical`. It happened in ~3.3% of loads under
 * `next dev --turbopack` (8 in ~244) and **0 times in 165 loads** under
 * `next build` + `next start`, including under CPU and network throttling.
 *
 * The three CI E2E jobs build and serve with `next start`; the local default
 * in `playwright.config.ts` is `pnpm dev`, which is `next dev --turbopack`. So
 * the same suite, run two ways, measures two different applications for
 * accessibility purposes — and nothing in the output said which one had just
 * been measured. Two phases of investigation were spent on that ambiguity, and
 * F-72's long run counted two of its failures from it.
 *
 * ## The signal, and why it is this one
 *
 * A production Next.js build serves its client chunks from
 * `/_next/static/<buildId>/…` and writes a `BUILD_ID`; the development server
 * serves them from `/_next/static/chunks/…` with a cache-busting `?v=`
 * timestamp and exposes `/_next/static/development/`. Fetching that last path
 * is a single request with an unambiguous answer — 200 in development, 404 in
 * production — and it needs no cooperation from the application's own code,
 * so it cannot drift with a refactor of the shell.
 *
 * This never fails the run. It is a statement of fact about the subject under
 * measurement, printed where the person reading the results will see it.
 */
async function reportBuildMode(context: APIRequestContext, appOrigin: string): Promise<void> {
  let development: boolean | null = null;
  try {
    const response = await context.get('/_next/static/development/_devPagesManifest.json', {
      failOnStatusCode: false,
    });
    development = response.status() === 200;
    if (!development) {
      // Second signal, because the manifest file's name is a Next.js internal
      // that a minor upgrade could rename: any `?v=` cache-buster on a script
      // URL is a development server's own doing.
      const html = await (await context.get('/login', { failOnStatusCode: false })).text();
      if (/\/_next\/static\/chunks\/[^"']*\?v=\d+/.test(html)) {
        development = true;
      }
    }
  } catch {
    development = null;
  }

  if (development === null) {
    console.log(
      `[global-setup] Could not determine whether ${appOrigin} is a development server or a ` +
        'production build. Read F-71 before treating any accessibility violation from this run as ' +
        'a product defect.',
    );
    return;
  }

  if (development) {
    console.log(
      `[global-setup] BUILD MODE: DEVELOPMENT SERVER at ${appOrigin}. This is NOT what CI ` +
        'measures. F-71: a hydration `useId` mismatch makes every collapsible FilterBar report a ' +
        'CRITICAL axe violation (`aria-valid-attr-value`) in ~3.3% of loads here, and in 0 of 165 ' +
        'loads against a production build. For a run that mirrors CI, use ' +
        '`pnpm --filter @pharos/web run test:e2e:ci-parity`.',
    );
    return;
  }

  console.log(
    `[global-setup] BUILD MODE: PRODUCTION BUILD at ${appOrigin} — the same shape CI measures ` +
      '(next build + next start).',
  );
}

async function waitForApiReady(context: APIRequestContext, appOrigin: string): Promise<void> {
  const timeoutMs = 60_000;
  const pollIntervalMs = 1000;
  const deadline = Date.now() + timeoutMs;
  let lastStatus: number | 'unreachable' = 'unreachable';

  while (Date.now() < deadline) {
    try {
      const response = await context.get('/api/v1/health/ready');
      if (response.status() === 200) {
        return;
      }
      lastStatus = response.status();
    } catch {
      lastStatus = 'unreachable';
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `[global-setup] Waited ${String(timeoutMs / 1000)}s for the API to report ready at ` +
      `${appOrigin}/api/v1/health/ready (last outcome: ${String(lastStatus)}) before rotating any ` +
      'shared seeded account. In CI this endpoint is already confirmed reachable before Playwright ' +
      'starts, so a timeout here means something else broke. Locally, this suite expects apps/api ' +
      "to already be running (see docs/local-environment.md) — playwright.config.ts's own " +
      '`webServer` block only starts apps/web, never apps/api.',
  );
}

async function rotateIfNeeded(
  context: APIRequestContext,
  label: string,
  email: string,
  plainPassword: string,
): Promise<'rotated' | 'already-rotated' | 'no-change-needed'> {
  const rotatedPassword = `${plainPassword}-E2E-1`;

  const firstAttempt = await context.post('/api/v1/auth/login', {
    data: { email, password: plainPassword },
  });

  if (firstAttempt.status() === 401) {
    // Not a fresh account from this backend's point of view — most likely
    // a persistent local database an earlier suite invocation already
    // rotated this account against. Confirm the rotated password now
    // works and stop; there is nothing left to do.
    const confirmation = await context.post('/api/v1/auth/login', {
      data: { email, password: rotatedPassword },
    });
    if (confirmation.status() !== 200) {
      throw new Error(
        `[global-setup] Neither the seeded nor the rotated password authenticated ${label} ` +
          `<${email}> (login returned ${String(firstAttempt.status())}, then ` +
          `${String(confirmation.status())} for the rotated password). Is the backend reachable ` +
          'and seeded with matching credentials from this environment?',
      );
    }
    await context.post('/api/v1/auth/logout').catch(() => undefined);
    return 'already-rotated';
  }

  if (firstAttempt.status() !== 200) {
    throw new Error(
      `[global-setup] POST /auth/login for ${label} <${email}> returned ` +
        `${String(firstAttempt.status())}, expected 200 or 401. Is the backend reachable and ` +
        'seeded correctly?',
    );
  }

  const loginBody = (await firstAttempt.json()) as { readonly mustChangePassword: boolean };
  if (!loginBody.mustChangePassword) {
    // Already past the mandatory-change gate somehow — nothing to rotate.
    await context.post('/api/v1/auth/logout').catch(() => undefined);
    return 'no-change-needed';
  }

  const changeResponse = await context.post('/api/v1/auth/me/password', {
    data: { currentPassword: plainPassword, newPassword: rotatedPassword },
  });
  if (changeResponse.status() !== 204) {
    throw new Error(
      `[global-setup] POST /auth/me/password for ${label} <${email}> returned ` +
        `${String(changeResponse.status())}, expected 204.`,
    );
  }
  // `changeOwnPassword` clears the session cookie server-side already
  // (FR-017 revokes every session for this user, including this one) — no
  // separate logout call needed.
  return 'rotated';
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const seedEmail = process.env.SEED_ADMIN_EMAIL;
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;

  // F-71 — declared FIRST, and before the credential check below returns
  // early, because "which application did this run actually measure?" is a
  // question every run has to answer, including one that skips everything.
  const originForProbe = config.projects[0]?.use.baseURL ?? process.env.APP_ORIGIN;
  if (originForProbe) {
    const probeContext = await request.newContext({ baseURL: originForProbe });
    try {
      await reportBuildMode(probeContext, originForProbe);
    } finally {
      await probeContext.dispose();
    }
  }

  if (!seedEmail || !seedPassword) {
    // Mirrors `requireSeedCredentials`'s own local-dev leniency (F-33): a
    // run against no seeded backend has nothing to rotate here, and every
    // spec that needs one of these identities already fails/skips itself
    // via that guard.
    console.log(
      '[global-setup] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD are not set — skipping the one-time ' +
        'account-rotation step.',
    );
    return;
  }

  const appOrigin = config.projects[0]?.use.baseURL ?? process.env.APP_ORIGIN;
  if (!appOrigin) {
    throw new Error(
      '[global-setup] Could not determine APP_ORIGIN/baseURL to rotate shared seeded accounts ' +
        'against.',
    );
  }

  // Every state-changing request needs a matching `Origin` header
  // (`CsrfMiddleware`, ADR-002) — a real browser sends this automatically;
  // Playwright's `request` context does not, so it is set once here for
  // every request this context makes.
  const context = await request.newContext({
    baseURL: appOrigin,
    extraHTTPHeaders: { origin: appOrigin },
  });

  try {
    await waitForApiReady(context, appOrigin);

    const fixturesSeeded = process.env.SEED_DEV_FIXTURES === 'true';
    const fixtureTargets = Object.entries(FIXTURE_USER_EMAIL).map(([key, email]) => ({
      label: `fixture account (${key})`,
      email,
    }));

    if (!fixturesSeeded) {
      // Plain and calm, not a warning: a local run without
      // `SEED_DEV_FIXTURES=true` never seeds these rows at all, so there is
      // nothing here to rotate — the specs that need one of them
      // (`grc-foundation`, `problems`, `risk-approval`, `risk-history`)
      // already guard/fail themselves on that same flag. Skipped WITHOUT
      // attempting a login this account was never going to have, so nobody
      // reading the log mistakes a doomed credential probe for a real
      // problem.
      for (const target of fixtureTargets) {
        console.log(
          `[global-setup] SEED_DEV_FIXTURES is not 'true' — skipping ${target.label} <${target.email}> ` +
            '(not seeded for this run).',
        );
      }
    }

    const targets: readonly { readonly label: string; readonly email: string }[] = [
      { label: 'bootstrap administrator', email: seedEmail },
      ...(fixturesSeeded ? fixtureTargets : []),
    ];

    for (const target of targets) {
      try {
        const outcome = await rotateIfNeeded(context, target.label, target.email, seedPassword);
        console.log(`[global-setup] ${target.label} <${target.email}>: ${outcome}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (target.email === seedEmail) {
          // Load-bearing for every worker's own provisioning
          // (`ensureWorkerAdminProvisioned`) — fail the whole run now,
          // loudly and once, rather than let every worker independently
          // rediscover the same broken precondition.
          throw new Error(`[global-setup] Could not settle ${target.label}: ${message}`);
        }
        // Reached only when `SEED_DEV_FIXTURES=true` (the "not seeded at
        // all" case is filtered out above) — this account was SUPPOSED to
        // exist and did not settle. Genuinely worth a warning, not the
        // calm skip above; the spec that needs it will still fail on its
        // own with a clearer, spec-specific message.
        console.warn(
          `[global-setup] SEED_DEV_FIXTURES is 'true' but could not pre-rotate ${target.label} ` +
            `<${target.email}> — leaving it to that spec's own guard: ${message}`,
        );
      }
    }
  } finally {
    await context.dispose();
  }
}
