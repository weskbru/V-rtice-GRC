import { randomUUID } from 'node:crypto';

import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';

export const seedEmail = process.env.SEED_ADMIN_EMAIL;
export const seedPassword = process.env.SEED_ADMIN_PASSWORD;

export function requireSeedCredentials(reason: string): void {
  if (seedEmail && seedPassword) {
    return;
  }
  if (process.env.CI) {
    throw new Error(
      `${reason} This is CI, where a missing SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must FAIL rather ` +
        'than skip (F-33, docs/deferred-findings.md) — otherwise a misconfigured pipeline can report ' +
        'success for a suite that never ran its authenticated scenarios.',
    );
  }
  test.skip(true, reason);
}

export function rotatedPasswordFor(password: string): string {
  return `${password}-E2E-1`;
}

type LoginAttemptOutcome =
  | { readonly kind: 'success' }
  | { readonly kind: 'invalid_credentials' }
  | { readonly kind: 'rate_limited'; readonly retryAfterSeconds: number }
  | { readonly kind: 'server_error'; readonly status: number; readonly body: string }
  | { readonly kind: 'misconfigured'; readonly status: number }
  | { readonly kind: 'network_error'; readonly detail: string }
  | { readonly kind: 'not_submitted'; readonly detail: string };

function describeLoginOutcome(outcome: LoginAttemptOutcome): string {
  switch (outcome.kind) {
    case 'invalid_credentials':
      return 'the credentials were genuinely refused (401)';
    case 'rate_limited':
      return `the login endpoint is rate-limited (429, Retry-After ${String(outcome.retryAfterSeconds)}s)`;
    case 'server_error':
      return (
        `the backend returned a server error (${String(outcome.status)}); response body: ` +
        `${outcome.body === '' ? '<empty>' : outcome.body}`
      );
    case 'misconfigured':
      return `the login endpoint returned an unexpected status (${String(outcome.status)}) — check APP_ORIGIN/proxy configuration`;
    case 'network_error':
      return `no response was ever received (backend unreachable): ${outcome.detail}`;
    case 'not_submitted':
      return (
        'the sign-in form never actually submitted — no POST /api/v1/auth/login request was ever ' +
        `sent by the browser (most likely client-side validation refused an empty/incorrect field, ` +
        `not a backend or network problem): ${outcome.detail}`
      );
    case 'success':
      return 'succeeded';
  }
}

export async function fillLoginCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const emailField = page.getByLabel('E-mail');
  const passwordField = page.getByRole('textbox', { name: 'Senha', exact: true });
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await emailField.fill(email);
    await passwordField.fill(password);
    await page.waitForTimeout(200);

    const [actualEmail, actualPassword] = await Promise.all([
      emailField.inputValue(),
      passwordField.inputValue(),
    ]);
    if (actualEmail === email && actualPassword === password) {
      return;
    }
  }

  throw new Error(
    "The sign-in form's E-mail/Senha fields would not hold their values across " +
      `${String(maxAttempts)} attempts — the form kept resetting them (most likely still ` +
      'hydrating). This is a form-interactivity defect, not a backend or credentials problem.',
  );
}

async function submitSignIn(
  page: Page,
  email: string,
  withPassword: string,
): Promise<LoginAttemptOutcome> {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await fillLoginCredentials(page, email, withPassword);

  let loginRequestSeen = false;
  const onRequest = (request: Request): void => {
    if (request.url().includes('/api/v1/auth/login') && request.method() === 'POST') {
      loginRequestSeen = true;
    }
  };
  page.on('request', onRequest);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST',
    { timeout: 15_000 },
  );

  await page.getByRole('button', { name: 'Entrar' }).click();

  let status: number;
  try {
    status = (await responsePromise).status();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!loginRequestSeen) {
      return { kind: 'not_submitted', detail };
    }
    return { kind: 'network_error', detail };
  } finally {
    page.off('request', onRequest);
  }

  if (status === 200) {
    return { kind: 'success' };
  }
  if (status === 401) {
    return { kind: 'invalid_credentials' };
  }
  if (status === 429) {
    const response = await responsePromise;
    const header = response.headers()['retry-after'];
    const parsed = header ? Number(header) : NaN;
    return { kind: 'rate_limited', retryAfterSeconds: Number.isFinite(parsed) ? parsed : 60 };
  }
  if (status >= 500) {
    let body = '';
    try {
      body = (await (await responsePromise).text()).replace(/\s+/g, ' ').trim().slice(0, 400);
    } catch {
      body = '<response body could not be read>';
    }
    return { kind: 'server_error', status, body };
  }
  return { kind: 'misconfigured', status };
}

async function attemptWithRateLimitBackoff(
  page: Page,
  email: string,
  withPassword: string,
): Promise<LoginAttemptOutcome> {
  const outcome = await submitSignIn(page, email, withPassword);
  if (outcome.kind !== 'rate_limited') {
    return outcome;
  }
  const waitMs = Math.min(outcome.retryAfterSeconds, 300) * 1000;
  const diagnostic =
    `F-78: login rate-limited (429, Retry-After ${String(outcome.retryAfterSeconds)}s) for ` +
    `${email} — waiting ${String(waitMs / 1000)}s before retrying once. If this test times out ` +
    `before that wait finishes, THIS is the real cause, not whatever step the report points at.`;
  console.log(diagnostic);
  try {
    test.info().annotations.push({ type: 'F-78 rate-limit backoff', description: diagnostic });
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return submitSignIn(page, email, withPassword);
}

async function attemptFullSignIn(
  page: Page,
  email: string,
  password: string,
  rotatedPassword: string,
): Promise<LoginAttemptOutcome> {
  const outcome = await attemptWithRateLimitBackoff(page, email, password);
  if (outcome.kind !== 'success') {
    return outcome;
  }

  await page.waitForURL(/\/(profile|dashboard)/, { timeout: 10_000 });

  if (page.url().includes('/profile')) {
    await page.getByLabel('Senha atual').fill(password);
    await page.getByLabel('Nova senha', { exact: true }).fill(rotatedPassword);
    await page.getByLabel('Confirmar nova senha').fill(rotatedPassword);
    await page.getByRole('button', { name: 'Alterar senha' }).click();
    await page.waitForURL('**/login');
    const changeOutcome = await attemptWithRateLimitBackoff(page, email, rotatedPassword);
    if (changeOutcome.kind !== 'success') {
      throw new Error(
        `Sign-in with the newly-rotated password for ${email} did not succeed: ` +
          `${describeLoginOutcome(changeOutcome)}.`,
      );
    }
    await page.waitForURL('**/dashboard');
  }

  await expect(page).toHaveURL(/\/dashboard$/);
  return { kind: 'success' };
}

export async function signInAsSeededUser(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const rotatedPassword = rotatedPasswordFor(password);

  let outcome = await attemptFullSignIn(page, email, rotatedPassword, rotatedPassword);
  if (outcome.kind === 'invalid_credentials') {
    outcome = await attemptFullSignIn(page, email, password, rotatedPassword);
  }

  if (outcome.kind !== 'success') {
    throw new Error(
      `Sign-in for ${email} did not succeed: ${describeLoginOutcome(outcome)} — is the backend ` +
        'seeded with matching credentials from this environment, and reachable?',
    );
  }
}

export async function signInAsFreshlyProvisionedUser(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const outcome = await attemptFullSignIn(page, email, password, rotatedPasswordFor(password));
  if (outcome.kind !== 'success') {
    throw new Error(
      `Sign-in for freshly-provisioned ${email} did not succeed with the password it was just ` +
        `given: ${describeLoginOutcome(outcome)}.`,
    );
  }
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Menu da conta/ }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await page.waitForURL('**/login');
}

export async function signInAsAdmin(page: Page): Promise<void> {
  if (!seedEmail || !seedPassword) {
    throw new Error(
      'signInAsAdmin() called without SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD set — guard the calling test with test.skip() first.',
    );
  }
  await signInAsSeededUser(page, seedEmail, seedPassword);
}

export const FIXTURE_USER_EMAIL = {
  riskAnalyst: 'fixture-risk-analyst@pharosgrc.local',
  riskApprover: 'fixture-risk-approver@pharosgrc.local',
} as const;

export async function signInAsFixtureUser(
  page: Page,
  email: (typeof FIXTURE_USER_EMAIL)[keyof typeof FIXTURE_USER_EMAIL],
): Promise<void> {
  if (!seedPassword) {
    throw new Error(
      'signInAsFixtureUser() called without SEED_ADMIN_PASSWORD set — guard the calling test with test.skip() first.',
    );
  }
  await signInAsSeededUser(page, email, seedPassword);
}

function workerAdminEmail(testInfo: TestInfo): string {
  return `e2e-worker-admin-${String(testInfo.workerIndex)}@pharosgrc.local`;
}

export function workerAdminFullName(testInfo: TestInfo): string {
  return `E2E Worker Admin ${String(testInfo.workerIndex)}`;
}

const PROVISIONED_WORKER_ADMIN_PASSWORD = 'Pharos-E2E-Provisioned-1!';

interface AdminRoleSummary {
  readonly id: string;
  readonly name: string;
}

interface InPageFetchResult {
  readonly status: number;
  readonly text: string;
}

async function findAdminRoleByName(page: Page, name: string): Promise<AdminRoleSummary> {
  const pageSize = 100;
  let pageNumber = 1;
  let totalPages = 1;

  do {
    const response = await fetchFromPage(
      page,
      `/api/v1/admin/roles?page=${String(pageNumber)}&pageSize=${String(pageSize)}`,
    );
    if (response.status !== 200) {
      throw new Error(
        `GET /admin/roles (page ${String(pageNumber)}) returned ${String(response.status)} while ` +
          `looking up the "${name}" role: ${response.text}`,
      );
    }

    const body = JSON.parse(response.text) as {
      readonly data: readonly AdminRoleSummary[];
      readonly meta: { readonly totalPages: number };
    };
    const match = body.data.find((role) => role.name === name);
    if (match) {
      return match;
    }

    totalPages = body.meta.totalPages;
    pageNumber += 1;
  } while (pageNumber <= totalPages);

  throw new Error(
    `No "${name}" role found across all ${String(totalPages)} page(s) of GET /admin/roles — is ` +
      'the platform seed applied?',
  );
}

async function fetchFromPage(
  page: Page,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<InPageFetchResult> {
  return page.evaluate(
    async ({ path: requestPath, method, body }) => {
      const response = await fetch(requestPath, {
        method: method ?? 'GET',
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, text: await response.text() };
    },
    { path, method: init?.method, body: init?.body },
  );
}

async function ensureWorkerAdminProvisioned(page: Page, testInfo: TestInfo): Promise<boolean> {
  if (!seedEmail || !seedPassword) {
    throw new Error(
      'ensureWorkerAdminProvisioned() called without SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD set — ' +
        'guard the calling test with test.skip() first.',
    );
  }

  const email = workerAdminEmail(testInfo);

  await signInAsSeededUser(page, seedEmail, seedPassword);

  const lookup = await fetchFromPage(
    page,
    `/api/v1/admin/users?page=1&pageSize=1&q=${encodeURIComponent(email)}`,
  );
  if (lookup.status !== 200) {
    throw new Error(
      `GET /admin/users returned ${String(lookup.status)} while checking for ${email} — ` +
        `cannot provision the worker-admin identity: ${lookup.text}`,
    );
  }
  const lookupBody = JSON.parse(lookup.text) as { data: readonly { email: string }[] };
  const alreadyExists = lookupBody.data.some((user) => user.email === email);

  if (!alreadyExists) {
    const platformAdminRole = await findAdminRoleByName(page, 'Platform Administrator');

    const createResponse = await fetchFromPage(page, '/api/v1/admin/users', {
      method: 'POST',
      body: {
        email,
        fullName: workerAdminFullName(testInfo),
        initialPassword: PROVISIONED_WORKER_ADMIN_PASSWORD,
        roleIds: [platformAdminRole.id],
        scopeGrants: [{ scopeType: 'GLOBAL' }],
      },
    });
    if (createResponse.status !== 201) {
      throw new Error(
        `POST /admin/users returned ${String(createResponse.status)} while provisioning ${email}: ` +
          createResponse.text,
      );
    }
  }

  await signOut(page);
  return !alreadyExists;
}

export async function provisionAuthJourneyAccount(
  page: Page,
): Promise<{ readonly email: string; readonly password: string }> {
  if (!seedEmail || !seedPassword) {
    throw new Error(
      'provisionAuthJourneyAccount() called without SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD set — ' +
        'guard the calling test with test.skip() first.',
    );
  }

  const email = `e2e-auth-journey-${randomUUID()}@pharosgrc.local`;
  const password = 'Pharos-E2E-AuthJourney-1!';

  await signInAsSeededUser(page, seedEmail, seedPassword);

  const readOnlyRole = await findAdminRoleByName(page, 'Read Only');

  const createResponse = await fetchFromPage(page, '/api/v1/admin/users', {
    method: 'POST',
    body: {
      email,
      fullName: 'E2E Auth Journey',
      initialPassword: password,
      roleIds: [readOnlyRole.id],
      scopeGrants: [{ scopeType: 'GLOBAL' }],
    },
  });
  if (createResponse.status !== 201) {
    throw new Error(
      `POST /admin/users returned ${String(createResponse.status)} while provisioning ${email}: ` +
        createResponse.text,
    );
  }

  await signOut(page);

  return { email, password };
}

type WorkerStorageState = Awaited<ReturnType<ReturnType<Page['context']>['storageState']>>;

const workerAdminStorageState = new Map<string, WorkerStorageState>();

export async function signInAsWorkerAdmin(page: Page, testInfo: TestInfo): Promise<void> {
  if (!seedPassword) {
    throw new Error(
      'signInAsWorkerAdmin() called without SEED_ADMIN_PASSWORD set — guard the calling test with test.skip() first.',
    );
  }

  const email = workerAdminEmail(testInfo);
  const cached = workerAdminStorageState.get(email);

  if (cached) {
    await page.context().addCookies(cached.cookies);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    if (!page.url().includes('/login')) {
      return;
    }
    workerAdminStorageState.delete(email);
  }

  const justCreated = await ensureWorkerAdminProvisioned(page, testInfo);
  if (justCreated) {
    await signInAsFreshlyProvisionedUser(page, email, PROVISIONED_WORKER_ADMIN_PASSWORD);
  } else {
    await signInAsSeededUser(page, email, PROVISIONED_WORKER_ADMIN_PASSWORD);
  }
  workerAdminStorageState.set(email, await page.context().storageState());
}
