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

      await fillLoginCredentials(page, email, withPassword);
      await page.getByRole('button', { name: 'Entrar' }).click();
    }

    await submitSignIn(password);

    await page.waitForURL(/\/profile/, { timeout: 10_000 });
    await expect(page.getByText('Você precisa alterar sua senha para continuar')).toBeVisible();

    await page.getByLabel('Senha atual').fill(password);
    await page.getByLabel('Nova senha', { exact: true }).fill(rotatedPassword);
    await page.getByLabel('Confirmar nova senha').fill(rotatedPassword);
    await page.getByRole('button', { name: 'Alterar senha' }).click();

    await page.waitForURL('**/login');

    await submitSignIn(rotatedPassword);
    await page.waitForURL('**/dashboard');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.goto('/profile');
    await expect(page.getByText(email)).toBeVisible();

    await page.getByRole('button', { name: /Menu da conta/ }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    await page.waitForURL('**/login');

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('the profile screen shows a role name translated to pt-BR, not the raw English seed value (F-75)', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);

    const email = `e2e-role-display-${randomUUID()}@verticegrc.local`;
    const password = 'Vertice-E2E-RoleDisplay-1!';
    await provisionUserWithRole(page, email, 'E2E Role Display', password, 'Compliance Manager');

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
