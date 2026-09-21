import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import {
  fillLoginCredentials,
  provisionAuthJourneyAccount,
  requireSeedCredentials,
  rotatedPasswordFor,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
} from './support/admin-session';

import type { Page } from '@playwright/test';

/**
 * T056 — full auth journey: sign in, reach the dashboard, sign out.
 *
 * Runs against a real backend (`apps/api`, e.g. via `docker-compose.yml` or
 * `docker-compose.test.yml`) seeded per
 * `apps/api/prisma/seed/platform.seed.ts`. Every seeded account is created
 * with `mustChangePassword = true` — there is no seeded account that lands
 * on the dashboard on its very first sign-in. This spec exercises that real
 * journey rather than assuming a shortcut that does not exist in the seed
 * data:
 *
 *   1. sign in with the freshly-provisioned credentials
 *   2. land on the mandatory change-password screen (FR-011 / mustChangePassword)
 *   3. set a new password (this revokes the session — FR-017 — landing back on /login)
 *   4. sign in again with the new password and reach the dashboard
 *   5. confirm the profile screen shows the signed-in identity
 *   6. sign out
 *   7. confirm the session is rejected afterwards (revisiting a protected
 *      route redirects to /login)
 *
 * Requires `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in the environment
 * (never hard-coded here — see root `.env.example`), matching the values the
 * API under test was actually seeded with. The suite skips itself with a
 * clear reason when they are not set, rather than failing in a way that
 * looks like a real regression.
 *
 * ## Why this signs into a freshly-provisioned account, not the bootstrap administrator
 *
 * This spec's premise is an account that has NEVER signed in — that is the
 * only way to genuinely reach the mandatory-change screen. Earlier
 * versions of this spec signed in as the bootstrap administrator
 * (`SEED_ADMIN_EMAIL`) directly and reasoned about "the seeded password, or
 * the rotated one if some earlier run already got there first". That
 * reasoning was sound for a SINGLE, serial run against a persistent
 * database, but it silently assumed nothing else touches that account
 * between when this spec starts and when it submits the change — an
 * assumption concurrent Playwright workers do not satisfy. Diagnosed
 * directly against CI run `34594939253`: another worker's own
 * administrator-provisioning routine rotated the bootstrap account's
 * password eleven minutes before this spec ran, so by the time it ran, the
 * account was no longer in the state this spec's old fallback logic
 * expected, and the shared account itself was found to have raced two
 * concurrent rotation attempts (see `global-setup.ts`'s header for the full
 * mechanism and the log evidence).
 *
 * `provisionAuthJourneyAccount` (`admin-session.ts`) removes the shared
 * state instead of reasoning around it: it creates a BRAND NEW account,
 * unique to this one test invocation, that only this spec ever touches. The
 * account is always known to be in the fresh, never-signed-in state, so the
 * "maybe it was already rotated" branch this spec used to need no longer
 * exists — every run exercises the real mandatory-change screen, not just
 * the first one.
 */

test.describe('Sign in, reach the dashboard, sign out', () => {
  requireSeedCredentials(
    "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real auth journey (see this file's header comment).",
  );

  test('signs in, completes a mandatory password change if prompted, reaches the dashboard, and signs out', async ({
    page,
  }) => {
    const { email, password } = await provisionAuthJourneyAccount(page);
    const rotatedPassword = rotatedPasswordFor(password);

    async function submitSignIn(withPassword: string): Promise<void> {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

      // D-21: shares `admin-session.ts`'s verify-and-retry fill rather than
      // raw `.fill()` calls — this spec hit the exact same WebKit
      // hydration race that helper was hardened against (see its own
      // header comment), just via a different, un-hardened call site.
      await fillLoginCredentials(page, email, withPassword);
      await page.getByRole('button', { name: 'Entrar' }).click();
    }

    await submitSignIn(password);

    // A freshly-provisioned account is always known to be in the
    // never-signed-in state — this spec owns it exclusively (see the header
    // comment), so there is no "maybe a previous run already rotated it"
    // branch to reason about; the mandatory-change screen is the only
    // possible outcome of a successful sign-in here. A failure to even
    // reach it (e.g. the generic invalid-credentials text) is a real defect
    // and should fail loudly rather than be silently reinterpreted as "must
    // already be rotated".
    await page.waitForURL(/\/profile/, { timeout: 10_000 });
    await expect(page.getByText('Você precisa alterar sua senha para continuar')).toBeVisible();

    await page.getByLabel('Senha atual').fill(password);
    await page.getByLabel('Nova senha', { exact: true }).fill(rotatedPassword);
    await page.getByLabel('Confirmar nova senha').fill(rotatedPassword);
    await page.getByRole('button', { name: 'Alterar senha' }).click();

    // FR-017: every session for the user is revoked, including this one.
    await page.waitForURL('**/login');

    await submitSignIn(rotatedPassword);
    await page.waitForURL('**/dashboard');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // The profile screen shows the signed-in identity (FR-009).
    await page.goto('/profile');
    await expect(page.getByText(email)).toBeVisible();

    // Sign out via the user menu (FR-016, FR-040).
    await page.getByRole('button', { name: /Menu da conta/ }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    await page.waitForURL('**/login');

    // The revoked session is refused afterwards (FR-015): revisiting a
    // protected route redirects straight back to /login.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  /**
   * F-75 (`docs/deferred-findings.md`): the profile screen's "Papéis" line
   * (`profile-view.tsx`) resolves each role name through `roleDisplayName`
   * (`@/lib/role-display-name`, ADR-022) — six of the twelve seeded roles
   * used to render their raw English seed value here until `09d9e50` added
   * the shared translator. That fix has real unit-test proof
   * (`profile-view.test.tsx`, simulated DOM) but had never been exercised in
   * a real browser. "Compliance Manager" -> "Gestor de Compliance" is one of
   * the six `09d9e50` actually changed (`common.ts`'s own
   * `roleDisplayNames` map) — asserting it here, rendered, is what a
   * simulated-DOM test cannot be proof of on its own (F-28/F-71's own
   * class of gap: a defect visible only in real DOM).
   */
  test('the profile screen shows a role name translated to pt-BR, not the raw English seed value (F-75)', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);

    const email = `e2e-role-display-${randomUUID()}@pharosgrc.local`;
    const password = 'Pharos-E2E-RoleDisplay-1!';
    await provisionUserWithRole(page, email, 'E2E Role Display', password, 'Compliance Manager');

    // A fresh, unauthenticated context — the worker administrator's own
    // session (`page`) must not be touched, mirroring `problems.spec.ts`'s
    // identical "act as a second, independent identity" shape.
    // `signInAsFreshlyProvisionedUser` drives the same real
    // never-signed-in -> mandatory-change -> dashboard journey the test
    // above exercises directly, without repeating those steps by hand.
    const freshContext = await page.context().browser()!.newContext();
    const freshPage = await freshContext.newPage();
    await signInAsFreshlyProvisionedUser(freshPage, email, password);

    await freshPage.goto('/profile');
    const rolesRow = freshPage.getByText('Papéis').locator('..');
    await expect(rolesRow.getByText('Gestor de Compliance')).toBeVisible();
    await expect(rolesRow.getByText('Compliance Manager')).toHaveCount(0);

    await freshContext.close();
  });
});

interface CreatedRoleAccount {
  readonly id: string;
}

/**
 * Provisions a brand-new, GLOBAL-scope account holding ONE named role —
 * same shape as `problems.spec.ts`'s identically-named helper (not shared
 * across files: a small, well-understood utility, matching this codebase's
 * own established convention of a local copy per spec rather than a
 * cross-file dependency for one call site — see `problems.spec.ts`'s
 * `fetchJson`'s own doc comment for the same reasoning about
 * `admin-session.ts`'s un-exported `fetchFromPage`).
 */
async function provisionUserWithRole(
  closerPage: Page,
  email: string,
  fullName: string,
  initialPassword: string,
  roleName: string,
): Promise<CreatedRoleAccount> {
  const rolesResult = await closerPage.evaluate(async () => {
    const response = await fetch('/api/v1/admin/roles?page=1&pageSize=100', {
      credentials: 'same-origin',
    });
    return { status: response.status, text: await response.text() };
  });
  const rolesBody = rolesResult.text
    ? (JSON.parse(rolesResult.text) as { data: readonly { id: string; name: string }[] })
    : null;
  if (rolesResult.status !== 200 || !rolesBody) {
    throw new Error(`GET /admin/roles returned ${String(rolesResult.status)}: ${rolesResult.text}`);
  }
  const role = rolesBody.data.find((candidate) => candidate.name === roleName);
  if (!role) {
    throw new Error(`No "${roleName}" role found via GET /admin/roles.`);
  }

  const createResult = await closerPage.evaluate(
    async ({ email: userEmail, fullName: userFullName, initialPassword: password, roleId }) => {
      const response = await fetch('/api/v1/admin/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          fullName: userFullName,
          initialPassword: password,
          roleIds: [roleId],
          scopeGrants: [{ scopeType: 'GLOBAL' }],
        }),
      });
      return { status: response.status, text: await response.text() };
    },
    { email, fullName, initialPassword, roleId: role.id },
  );
  if (createResult.status !== 201) {
    throw new Error(
      `POST /admin/users returned ${String(createResult.status)}: ${createResult.text}`,
    );
  }
  return JSON.parse(createResult.text) as CreatedRoleAccount;
}
