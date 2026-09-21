import { randomUUID } from 'node:crypto';

import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';

/**
 * Shared sign-in helpers for E2E specs that need an authenticated session
 * with a specific, real seeded identity, rather than exercising the auth
 * journey itself (that is `e2e/auth.spec.ts`'s job).
 *
 * `signInAsSeededUser` is the one mechanism every specific helper below
 * builds on. It mirrors `auth.spec.ts`'s own re-runnability handling
 * verbatim rather than assuming a shortcut that does not exist in the seed
 * data: every seeded account (`apps/api/prisma/seed/platform.seed.ts`,
 * bootstrap administrator AND `SEED_DEV_FIXTURES` fixture users alike) is
 * created with `mustChangePassword = true`, and once this helper has run
 * once against a given account in a given database, that account's
 * password has already been permanently rotated to `${password}-E2E-1` —
 * see that file's header comment for the full rationale. This helper
 * converges to, and stays at, the rotated password across repeated runs,
 * exactly like `auth.spec.ts`.
 */
export const seedEmail = process.env.SEED_ADMIN_EMAIL;
export const seedPassword = process.env.SEED_ADMIN_PASSWORD;

/**
 * F-33 (`docs/deferred-findings.md`): the shared guard every credentialed
 * spec calls in place of a bare `test.skip(!seedEmail || !seedPassword,
 * reason)`. Locally, without a seeded backend configured, this still
 * skips — that is a reasonable default for a developer running a subset of
 * the suite. In CI (`process.env.CI`), the same missing configuration
 * instead FAILS the suite.
 *
 * Why the distinction matters: a `test.skip` here is a trapdoor in CI
 * specifically, because CI's job either sets `SEED_ADMIN_EMAIL`/
 * `SEED_ADMIN_PASSWORD` correctly or it does not — there is no legitimate
 * "developer without a seeded backend yet" case in a pipeline that just
 * ran its own migrate-and-seed step. A misconfigured CI job (a renamed
 * secret, a step reordered ahead of the seed, an env block copied
 * incompletely) would otherwise report the suite GREEN while silently
 * running zero of its authenticated scenarios — exactly what happened with
 * `accessibility.spec.ts` reporting "3 passed, 19 skipped" as a passing
 * exit code. Call this at the top of a `test.describe` body (or before a
 * `test.beforeAll`) exactly where the old `test.skip(...)` call used to
 * sit — it runs at collection time either way, so throwing here surfaces
 * as a suite-level failure rather than a silently-skipped block.
 */
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

/**
 * Exported (rather than kept as a private implementation detail of this
 * file) so `auth.spec.ts` — the one spec that submits a real password
 * through the mandatory-change UI rather than calling `signInAsSeededUser`
 * — computes the exact same rotated value this file's own helpers converge
 * accounts to, instead of maintaining a second, independently-drifting
 * copy of the suffix.
 */
export function rotatedPasswordFor(password: string): string {
  return `${password}-E2E-1`;
}

/**
 * D-17/research.md, step 2 (F-43): the four HTTP outcomes a login POST can
 * produce, distinguished by the ACTUAL response — never inferred from page
 * text, which collapses all four into one fixed assertion today. Status
 * codes are the authoritative signal (`apps/api/src/infrastructure/http/
 * problem-details.filter.ts`): `401` is genuinely wrong credentials, `429`
 * is `RateLimitedDomainError` (account lockout and origin-throttle share
 * this SAME code deliberately — `auth-orchestrator.ts`'s own comment: "an
 * attacker must not be able to infer whether a specific account exists
 * from which 429 variant" — so this helper does not try to tell them
 * apart either), `5xx` is the backend up but erroring (a real defect, not
 * a credential problem), and no response at all (a rejected/timed-out
 * `waitForResponse`) is the backend down. Any other status (e.g. `403` from
 * the CSRF Origin/Referer check, `404` from a misrouted proxy) is bucketed
 * as `misconfigured` — for THIS route, an unexpected status is exactly
 * that: the deployment's wiring, not the account's credentials.
 */
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

/**
 * D-21 (diagnosed against CI run `34610189725`, WebKit-isolated job):
 * `login-form.tsx` is a React Hook Form–controlled input, rendered
 * non-disabled from first paint (SSR) but not actually wired to React's
 * state until hydration commits. A `.fill()` landing before that commit
 * sets the DOM value directly; hydration's own first controlled render
 * then overwrites it with the form's still-default (empty) internal
 * state, silently discarding whatever was just typed. `waitUntil:
 * 'networkidle'` on the preceding navigation (below) is a PROXY for
 * "hydrated", not the fact itself — network settling and JS hydration
 * finishing are only loosely correlated, and under this pipeline's CPU
 * contention the gap between them is wide enough to lose the race
 * outright. Confirmed directly: four separate WebKit failure screenshots
 * from that run show the identical result — Senha correctly filled,
 * E-mail silently empty, the form's OWN client-side validation correctly
 * refusing to submit ("Informe seu e-mail.").
 *
 * Waiting longer is not a fix, only a wider window for the same race.
 * There is no hydration-complete signal exposed by `login-form.tsx` today
 * (no data attribute, no readiness flag) that a test-only file could wait
 * on instead without an application change — the most direct REAL signal
 * available here is the field's own value: read it back after filling,
 * and if it did not stick, fill it again. Refills BOTH fields together
 * (rather than only the one that looks wrong) because the failure mode is
 * "a hydration commit landed and reset the form", which clobbers whatever
 * was there regardless of which field this call is nominally checking;
 * the short `waitForTimeout` exists to give an in-flight commit — already
 * scheduled, not yet painted — a chance to land BEFORE trusting what
 * `inputValue()` reports, since hydration is a one-time event and a
 * value that survives one settle window will not be clobbered again on
 * the same page.
 */
export async function fillLoginCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const emailField = page.getByLabel('E-mail');
  const passwordField = page.getByLabel('Senha');
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await emailField.fill(email);
    await passwordField.fill(password);
    // Deliberate, bounded exception to "don't use waitForTimeout": this is
    // not waiting for something to become eventually true (Playwright's
    // auto-retrying assertions already do that well) — it is waiting to
    // see whether an already-true value gets clobbered by a pending
    // render, which requires letting time pass before re-reading it.
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

/**
 * Submits the sign-in form once and diagnoses the REAL response, rather
 * than asserting a fixed error string (F-43). Captures the `POST /api/v1/
 * auth/login` response Playwright's own network layer sees, independent of
 * whatever the UI renders from it — so a misconfigured deployment that
 * fails to render the expected error text is still correctly diagnosed,
 * not misreported as a credential problem.
 */
async function submitSignIn(
  page: Page,
  email: string,
  withPassword: string,
): Promise<LoginAttemptOutcome> {
  // `waitUntil: 'networkidle'` — CLAUDE.md §18.13's own documented trap,
  // applied here rather than only in `ui-capture.mjs`. Left in place as a
  // reasonable precondition (it usually means hydration is at least
  // underway, which keeps `fillLoginCredentials` below to its fast path
  // of one attempt) — but it is NOT what makes this correct any more;
  // `fillLoginCredentials`'s own read-back loop is (see its header
  // comment for why this wait alone was proven insufficient).
  await page.goto('/login', { waitUntil: 'networkidle' });
  await fillLoginCredentials(page, email, withPassword);

  // D-21: distinguishes "the request was sent and never answered" from
  // "the request was never sent at all" — the second is a client-side
  // submission failure (e.g. the form's own validation refusing an
  // empty field), and reporting it as "backend unreachable" is exactly
  // the misdiagnosis F-43 rewrote this helper to stop making, just one
  // layer further up than F-43 itself covered. Listening on `page.on
  // ('request', ...)` rather than trusting `fillLoginCredentials` to have
  // succeeded keeps this check honest against ANY reason the click might
  // not submit, not only the hydration race that motivated it.
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
    // `waitForResponse` rejected. Two genuinely different causes produce
    // the exact same rejection here, and only the request-seen flag tells
    // them apart: a request that WAS sent and never answered (backend/
    // network down) versus a request that was NEVER sent (the click did
    // not result in a submission at all).
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
    /*
     * F-72 — capture WHAT the server said, not merely that it said 5xx.
     *
     * A full Chromium run produced two of these, and the message the suite
     * printed was "the backend returned a server error (500)" and nothing
     * else: no problem body, no correlation id, no way to tell an API fault
     * from a Next.js route-handler fault, and no audit event on the server
     * side either (a failed transaction writes none). Diagnosing it meant
     * re-running a twelve-minute suite and hoping.
     *
     * The API answers errors as RFC 9457 (`application/problem+json`, with
     * `type`/`title`/`detail` and a correlation id); the Next dev server
     * answers its own crashes as HTML. Either one, truncated, tells the next
     * reader which of the two they are looking at, on the first occurrence.
     * Truncated because an HTML error page is enormous and an assertion
     * message is not a log file.
     */
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

/**
 * Retries a `rate_limited` outcome by waiting out the server's OWN
 * `Retry-After` value and trying again — never by raising
 * `AUTH_RATE_LIMIT_*`, disabling the throttle, or forging a different
 * origin/IP (AGENTS.md: never weaken a security control to make a test
 * pass). Capped at `AUTH_RATE_LIMIT_WINDOW_SECONDS`'s default (300s) so a
 * misbehaving server cannot hang a whole suite on one absurd header value;
 * a single retry — this is a fixed window, so waiting it out once is
 * always enough, and a second refusal after a full window means something
 * else is wrong, which the caller should see rather than loop on.
 *
 * F-78 (`docs/deferred-findings.md`): this function used to wait out
 * `Retry-After` in total silence. When that wait alone exceeded the
 * calling test's OWN timeout, Playwright killed the test first — the
 * report showed a mute "Test timeout of 30000ms exceeded" pointing at
 * whatever click happened to be pending, never this function's own,
 * already-correct diagnosis ("the login endpoint is rate-limited"). The
 * fix does not touch retry timing or semantics at all (a behavioural
 * change here would need its own verification across the whole suite,
 * which uses this helper) — it only makes the diagnosis observable BEFORE
 * the wait starts, via both an annotation (shows in the HTML report even
 * after a timeout) and a console line (shows in the terminal/trace), so a
 * reader facing a timed-out test sees "rate-limited, waiting Ns" instead
 * of a silent gap where the actual cause used to be swallowed.
 */
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
  } catch {
    // `test.info()` throws outside a running test (e.g. a bare script) —
    // the console.log above already carries the diagnostic either way.
  }
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return submitSignIn(page, email, withPassword);
}

/**
 * Attempts sign-in with EXACTLY `password` — no retry with any other
 * password. On success, completes the mandatory password-change screen if
 * prompted (rotating to `rotatedPassword`) and asserts landing on
 * `/dashboard`. On any other outcome, returns it unchanged so the CALLER
 * decides whether trying a different password even makes sense — this
 * function never guesses.
 */
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

/**
 * Signs in as `email`/`password` when the account's PASSWORD STATE IS
 * GENUINELY UNKNOWN — it may have been touched (and therefore permanently
 * rotated to `${password}-E2E-1`, see this file's header) by an earlier
 * run against this same database, or it may never have been touched at
 * all. This is the bootstrap administrator's case, and it is ALSO the
 * case for a worker-admin identity `ensureWorkerAdminProvisioned` found
 * ALREADY EXISTING rather than just created — same unknown state, same
 * reasoning, not a special case of "the bootstrap account" specifically.
 *
 * D-17/research.md, step 1 (F-48 corrected): tries the ROTATED password
 * FIRST, falling back to the plain seeded password only on a genuine
 * `invalid_credentials` refusal — trying the plain form first, as this
 * helper used to, cost one guaranteed failed attempt per account on
 * exactly the normal case (a database a previous run already touched).
 * On a genuinely fresh database the cost is the same one failed attempt,
 * just on the other password — nothing is weakened, no budget is raised,
 * no control is disabled.
 *
 * A `rate_limited` or `server_error`/`network_error`/`misconfigured`
 * outcome is NEVER treated as "try the other password" — that would burn
 * more of the account's own failure budget for a cause that has nothing
 * to do with which password was sent, and would mask a real backend
 * problem as a credential one.
 *
 * Call `signOut(page)` first if `page` already holds a DIFFERENT
 * authenticated session — `/login` redirects an already-authenticated
 * session straight to `/dashboard` rather than rendering the sign-in form
 * this helper needs (verified directly while writing `risk-approval.spec.ts`,
 * T152), so this helper cannot switch identities on its own.
 */
export async function signInAsSeededUser(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const rotatedPassword = rotatedPasswordFor(password);

  let outcome = await attemptFullSignIn(page, email, rotatedPassword, rotatedPassword);
  if (outcome.kind === 'invalid_credentials') {
    // Expected on a genuinely fresh database this helper has never
    // touched: fall back to the plain seeded password.
    outcome = await attemptFullSignIn(page, email, password, rotatedPassword);
  }

  if (outcome.kind !== 'success') {
    throw new Error(
      `Sign-in for ${email} did not succeed: ${describeLoginOutcome(outcome)} — is the backend ` +
        'seeded with matching credentials from this environment, and reachable?',
    );
  }
}

/**
 * Signs in as `email`/`password` when the caller KNOWS this is exactly the
 * password the account currently has — because the caller itself just set
 * it, this same run, moments ago (e.g. just created the user through the
 * real administration API). Tries `password` ONCE — no rotated-first
 * probe, no fallback, zero guessing. Guessing here was the actual defect:
 * measured directly, trying the rotated form first against BRAND-NEW
 * accounts cost one guaranteed failed attempt per account. The generalized
 * lesson (AGENTS.md: a fix extends to every call site sharing the
 * vulnerable pattern, not only the reported instance) — `admin-access
 * .spec.ts`, `assets-processes-scope.spec.ts` and `audit-engagement-scope
 * .spec.ts` each provision their own fixture user inline via the admin API
 * and then used to call `signInAsSeededUser` (built for UNKNOWN state) on
 * an account they themselves had just created seconds earlier. This is the
 * one function every such call site — present and future — should call
 * instead: exported, not a private implementation detail of
 * `ensureWorkerAdminProvisioned`.
 */
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

/**
 * Signs out the currently signed-in user via the account menu (FR-016,
 * FR-040), leaving `page` on `/login`. Call this BEFORE a second
 * `signInAs*` call in the same test: `/login` redirects an already
 * authenticated session straight to `/dashboard` rather than rendering the
 * sign-in form, so a bare `page.goto('/login')` (what every `signInAs*`
 * helper does internally) cannot switch identities on its own — verified
 * directly, not assumed, while writing `risk-approval.spec.ts` (T152).
 *
 * ## The account-menu trigger is opened via the keyboard (T165 finding)
 *
 * The account menu trigger sits in the SAME top-right corner
 * (`FeedbackProvider`'s `position="top-right"`) as this app's one
 * `sonner` toast region. A caller that just did something that shows a
 * success toast (routine right before a sign-out — e.g. requesting or
 * deciding an approval) can reach this helper while that toast is still
 * up, and it was directly observed — under this suite's own concurrent
 * (2-worker) run, not merely assumed — to block every coordinate-based way
 * of opening this menu. Three escalations were tried and rejected before
 * this one:
 *
 *   - A plain `click()`: blocked outright (`subtree intercepts pointer
 *     events`) for the full test timeout.
 *   - Actively dismissing the toast first: under load, toasts churn (new
 *     ones appear, old ones animate out, the stack shifts) fast enough
 *     that a `Close toast` button can go from visible to detached between
 *     Playwright's actionability check and the click itself — flakier,
 *     not more reliable.
 *   - `click({ force: true })` and a direct `HTMLElement.click()` via
 *     `locator.evaluate`: both dispatch (or simulate) a bare `click`
 *     event, but Radix's `DropdownMenuTrigger` opens on POINTER events
 *     (`onPointerDown`, per its own WAI-ARIA menu-button implementation),
 *     not on `click` — so neither actually opened the menu, confirmed
 *     directly (the next locator, `menuitem "Sair"`, never appeared).
 *
 * Opening it via the KEYBOARD instead — programmatically focusing the
 * trigger, then pressing `Enter` — sidesteps the whole problem: neither
 * step involves a screen coordinate for any overlay to intercept, and a
 * real `<button>`
 * with `aria-haspopup="menu"` is required by the WAI-ARIA menu-button
 * pattern (and Radix implements it) to open on `Enter`/`Space` when
 * focused, which is exactly the accessible interaction a keyboard-only
 * user already depends on — this is not a workaround unique to testing.
 * This is an environmental hazard reproduced against BOTH
 * `risk-approval.spec.ts` (pre-existing, unmodified by T165) and
 * `risk-history.spec.ts` under concurrent E2E runs — never a strict-mode
 * locator collision (this project's own E2E playbook already names that
 * as a separate, distinct hazard).
 */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Menu da conta/ }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await page.waitForURL('**/login');
}

/**
 * Signs in as the literal seeded bootstrap administrator (`SEED_ADMIN_EMAIL`
 * — the account `signInAsSeededUser` was originally written for).
 *
 * F-16 (`docs/deferred-findings.md`): every other spec that used to call
 * this purely to get "a fully-privileged, arbitrary identity" now calls
 * `signInAsWorkerAdmin` instead, because this one shared account is exactly
 * what made concurrent workers race over its password. Prefer
 * `signInAsWorkerAdmin` for any new spec unless it specifically needs the
 * bootstrap administrator's own identity (as `auth.spec.ts` does, to
 * exercise that account's first-sign-in journey).
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  if (!seedEmail || !seedPassword) {
    throw new Error(
      'signInAsAdmin() called without SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD set — guard the calling test with test.skip() first.',
    );
  }
  await signInAsSeededUser(page, seedEmail, seedPassword);
}

/**
 * The dev-fixture users `SEED_DEV_FIXTURES=true` seeds — one per system
 * role, at `fixture-<slugified-role-name>@pharosgrc.local`, sharing
 * `SEED_ADMIN_PASSWORD` as their initial password
 * (`apps/api/prisma/seed/platform.seed.ts`'s `seedDevFixtures`, whose own
 * comment states this explicitly: "reuse the SAME configured password
 * rather than a second, invented one"). Only the two this project's E2E
 * specs currently need are named here — add more as a future spec needs
 * them, following the same `fixture-<slug>@pharosgrc.local` shape.
 */
export const FIXTURE_USER_EMAIL = {
  riskAnalyst: 'fixture-risk-analyst@pharosgrc.local',
  riskApprover: 'fixture-risk-approver@pharosgrc.local',
} as const;

/**
 * Signs in as one of the dev-fixture users above — the SECOND, genuinely
 * different signed-in identity `risk-approval.spec.ts` (T152) needs to
 * exercise segregation of duties through the real UI, without duplicating
 * `signInAsAdmin`'s own sign-in/password-rotation logic.
 */
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

/**
 * D-17/research.md, step 3 (retiring F-16's own fix): the twelve-account
 * static pool `platform.seed.ts` used to pre-seed is GONE. `testInfo
 * .workerIndex` (unlike `parallelIndex`, verified insufficient — see the
 * git history of this file for the exact collision this caused) is
 * documented by Playwright as unique for the lifetime of a single `test`
 * run, across every project combined, never reused while workers restart
 * — exactly the guarantee a fixed-size pool needed `parallelIndex` +
 * project partitioning to approximate. With a per-worker identity
 * PROVISIONED on demand instead of pre-allocated from a fixed array,
 * that guarantee is all that's needed: no pool size to keep in sync with
 * anything, no per-project block, no collision to reason about.
 *
 * `workerAdminEmail`/`workerAdminFullName` stay pure functions of
 * `testInfo` (no network call) so specs that assert attribution text
 * ("Decidido por …") can call `workerAdminFullName(testInfo)` synchronously
 * at any point after `signInAsWorkerAdmin` — unchanged call sites in
 * `risk-assessment.spec.ts`/`risk-collaboration.spec.ts`/
 * `risk-treatment.spec.ts`.
 */
function workerAdminEmail(testInfo: TestInfo): string {
  return `e2e-worker-admin-${String(testInfo.workerIndex)}@pharosgrc.local`;
}

export function workerAdminFullName(testInfo: TestInfo): string {
  return `E2E Worker Admin ${String(testInfo.workerIndex)}`;
}

/**
 * Every provisioned worker-admin identity starts with this password
 * (policy-compliant: length >= 12, mixed classes). It never stays this
 * value in practice: `CreateUserUseCase` unconditionally sets
 * `mustChangePassword = true` for every user it creates, so
 * `signInAsSeededUser` immediately drives the same mandatory rotation
 * dance it already handles for every other seeded account, converging to
 * `${this}-E2E-1` on first use — there is no separate password-handling
 * path for a provisioned identity versus a pre-seeded one.
 */
const PROVISIONED_WORKER_ADMIN_PASSWORD = 'Pharos-E2E-Provisioned-1!';

interface AdminRoleSummary {
  readonly id: string;
  readonly name: string;
}

interface InPageFetchResult {
  readonly status: number;
  readonly text: string;
}

/**
 * Found by the journey agent (D-20): both provisioning call sites used to
 * fetch exactly ONE page (`page=1&pageSize=100`) of `GET /admin/roles` and
 * `.find()` the role they wanted within it — silently correct only for as
 * long as the role happened to sort within the first 100 rows. `admin
 * .openapi.yaml` gives this endpoint no name/search filter (only
 * `page`/`pageSize` — `ListRolesQueryDto`), so "ask for the role it wants"
 * is not an option this contract supports; paging until found (or genuinely
 * exhausted) is. Against a database carrying enough accumulated roles —
 * this platform seeds twelve system roles today and grows by more with
 * every module — the target role sorting past page one makes this throw
 * "no such role", which reads as a missing/misapplied seed rather than what
 * it actually is: a lookup that gave up one page too early.
 */
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

/**
 * Issues the request from INSIDE the page's own JavaScript context — a
 * real, same-origin `fetch()` the browser itself makes — rather than
 * through Playwright's separate `page.request` API-testing context.
 *
 * This product is deliberately single-origin (ADR-014): the web app
 * proxies `/api/*` to the API under its own host, and `CsrfMiddleware`
 * (ADR-002, FR-019) requires every state-changing request's `Origin` to
 * match `APP_ORIGIN`. `page.request`, despite sharing the page's cookies,
 * is NOT the browser — it does not automatically carry the `Origin` header
 * a genuine in-page `fetch()` does, and a first version of this helper
 * built on it was refused `403` ("cross-origin request rejected") on
 * every single spec that reached it. Running inside `page.evaluate` is not
 * a workaround for that refusal; it is what makes this call an actual
 * same-origin request, exactly the path the production frontend's own
 * `fetch` calls already take, rather than a route no real client uses.
 */
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

/**
 * D-17/research.md, step 3: the identity `signInAsWorkerAdmin` uses is
 * PROVISIONED per run through the real administration API — never a row
 * `platform.seed.ts` pre-creates — with the bootstrap login
 * (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) as the ONE seed of trust every
 * other identity in this suite is created through. Idempotent against a
 * database an earlier run already touched (a local dev database persists
 * across suite invocations, unlike the disposable integration/contract
 * test database): looks the account up first via the real `GET
 * /admin/users` search, and only calls `POST /admin/users` when it
 * genuinely does not exist yet.
 *
 * `page` must be UNAUTHENTICATED when this is called (a fresh context, or
 * right after `signOut`) — it signs in as the bootstrap administrator to
 * do the provisioning, then signs back out, leaving `page` unauthenticated
 * for the caller to sign in as the newly (or previously) provisioned
 * identity.
 *
 * Returns whether the account was CREATED by this call (`true`) versus
 * already existing from an earlier run (`false`) — the caller uses this to
 * decide how to sign in: a freshly-created identity's password is exactly
 * known (no rotated-first probe needed, no failed attempt spent); a
 * pre-existing one's state is unknown, same as the bootstrap administrator.
 */
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

/**
 * D-19 (shared-mutable-credential race, diagnosed against CI run
 * `34594939253` — see `global-setup.ts`'s own header for the full
 * mechanism): `auth.spec.ts` exercises the mandatory first-password-change
 * journey, whose entire premise is an account that has NEVER signed in.
 * Sharing ANY other account for that — the bootstrap administrator, a
 * static fixture row — makes the test's premise depend on nothing else
 * having touched that account first, which is exactly what broke it: a
 * concurrent worker's own provisioning rotated the bootstrap administrator
 * eleven minutes before `auth.spec.ts` ran in the run above, so by the time
 * it ran, the account was no longer in the state the test assumed.
 *
 * The fix is a BRAND NEW account, created fresh for THIS ONE test
 * invocation via `randomUUID()` — deliberately not `testInfo.workerIndex`
 * (the key `workerAdminEmail` above uses): `test-e2e-cross-browser` runs
 * TWO Playwright projects (firefox, webkit) in the SAME job against the
 * SAME backend, so this one spec executes twice per run, and nothing
 * prevents both executions from being scheduled concurrently. A
 * worker-indexed email would not rule that out; a random one removes the
 * possibility by construction rather than by reasoning about scheduling.
 * Provisioned through the bootstrap administrator exactly like
 * `ensureWorkerAdminProvisioned` provisions a worker's own identity — safe
 * to do because `global-setup.ts` has already rotated that account before
 * any worker exists, so this call never touches ITS password.
 *
 * Deliberately NOT a `platform.seed.ts` fixture: a static row would be
 * exactly the same kind of shared, mutable account this whole fix removes
 * — both of `test-e2e-cross-browser`'s projects would still be able to sign
 * into the SAME seeded row concurrently. Provisioning fresh, here, is what
 * makes "nothing else touches it" true by construction instead of by
 * naming convention. `Read Only` — the least-privileged system role — is
 * enough: the journey this account exists for never exercises a
 * permission-gated action.
 *
 * Returns the caller a `page` already signed OUT (unauthenticated), exactly
 * like `ensureWorkerAdminProvisioned` leaves it, so the caller's own
 * UI-driven sign-in journey starts from a clean `/login`.
 *
 * ## Expected debris
 *
 * Every invocation creates a NEW `User` row that nothing ever deletes —
 * that is the whole point (see above), not an oversight. Against CI's
 * always-fresh `pharos_grc_e2e` database this costs nothing. Against a
 * long-lived LOCAL database, repeated runs of this spec leave behind one
 * `e2e-auth-journey-<uuid>@pharosgrc.local` account each time; finding a
 * pile of them is expected, not a leak to chase down.
 */
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

/**
 * This worker's authenticated cookies, captured after its FIRST real
 * sign-in and reused by every later call in the same worker.
 *
 * Playwright runs each worker in its own process, so a module-level cache
 * is exactly worker-scoped — the same granularity as the provisioned
 * identity itself (`workerAdminEmail`), never shared across workers.
 *
 * ## Why this exists
 *
 * `accessibility.spec.ts`'s own header states that every authenticated
 * scenario "shares ONE signed-in account for this worker, signed in once
 * in `beforeAll` ... so that single sign-in is reused rather than
 * repeated". Its code did the opposite: a `test.beforeEach` calling
 * `signInAsWorkerAdmin` on EVERY test. Playwright hands each test a fresh
 * context, so the cookie from a previous test genuinely was gone — the
 * `beforeEach` was necessary, and the header's claim was simply not true
 * of the code beneath it.
 *
 * The consequence was not cosmetic. That file performs one real login per
 * test, and `apps/api/.env`'s `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS=20` over
 * `AUTH_RATE_LIMIT_WINDOW_SECONDS=300` means a serial local run trips the
 * ORIGIN throttle partway through and the remaining tests fail with F-43's
 * misleading "Neither the seeded nor the rotated password authenticated"
 * — which reads as a credential problem and is not one. 005-audit-findings
 * added six scans to that file and pushed it past the threshold; the
 * defect was latent before, at 19 tests, and CI's `retries: 2` had been
 * masking it.
 *
 * Restoring the cached cookies makes the header's claim TRUE rather than
 * relaxing the rate limit, which would be disabling a security control to
 * make tests pass (AGENTS.md forbids exactly that). One real login per
 * worker, not one per test.
 */
type WorkerStorageState = Awaited<ReturnType<ReturnType<Page['context']>['storageState']>>;

const workerAdminStorageState = new Map<string, WorkerStorageState>();

/**
 * Signs in as THIS worker's own dedicated Platform-Administrator-equivalent
 * account (F-16, retired to per-run provisioning by D-17/research.md step
 * 3) instead of the single shared bootstrap administrator that
 * `signInAsAdmin` uses. Behaviourally identical to `signInAsAdmin` for
 * every spec that only ever needed "a fully-privileged, arbitrary
 * identity" — which is every spec calling this rather than `signInAsAdmin`
 * directly. `auth.spec.ts` is the one spec that must keep using the real
 * bootstrap account, because it exercises that account's own first-sign-in
 * journey specifically.
 *
 * The first call in a worker provisions the identity if needed (through
 * the bootstrap login and the real administration API — never a
 * pre-seeded row), performs a real sign-in, and caches the resulting
 * cookies; later calls restore them instead of provisioning or logging in
 * again (see `workerAdminStorageState`). Restoration is VERIFIED, and
 * falls back to a real sign-in whenever it does not land authenticated —
 * an expired or revoked session can never turn into a silently
 * unauthenticated test.
 */
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
    // Landing anywhere other than `/login` means the restored session is
    // live. If it is not, fall through to a real sign-in below rather than
    // letting the test proceed unauthenticated.
    if (!page.url().includes('/login')) {
      return;
    }
    workerAdminStorageState.delete(email);
  }

  const justCreated = await ensureWorkerAdminProvisioned(page, testInfo);
  // Known password, no guessing, when this call itself just set it (zero
  // failed attempts); genuinely unknown state — same as the bootstrap
  // administrator — when the account survived from an earlier run.
  if (justCreated) {
    await signInAsFreshlyProvisionedUser(page, email, PROVISIONED_WORKER_ADMIN_PASSWORD);
  } else {
    await signInAsSeededUser(page, email, PROVISIONED_WORKER_ADMIN_PASSWORD);
  }
  workerAdminStorageState.set(email, await page.context().storageState());
}
