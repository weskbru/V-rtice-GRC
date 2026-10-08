import { request } from '@playwright/test';

import { FIXTURE_USER_EMAIL } from './admin-session';

import type { APIRequestContext, FullConfig } from '@playwright/test';

async function reportBuildMode(context: APIRequestContext, appOrigin: string): Promise<void> {
  let development: boolean | null = null;
  try {
    const response = await context.get('/_next/static/development/_devPagesManifest.json', {
      failOnStatusCode: false,
    });
    development = response.status() === 200;
    if (!development) {
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
      'starts, so a timeout here means something else broke. Locally, this suite expects backend ' +
      "to already be running (see docs/local-environment.md) — playwright.config.ts's own " +
      '`webServer` block only starts frontend, never backend.',
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
  return 'rotated';
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const seedEmail = process.env.SEED_ADMIN_EMAIL;
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;

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
          throw new Error(`[global-setup] Could not settle ${target.label}: ${message}`);
        }
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
