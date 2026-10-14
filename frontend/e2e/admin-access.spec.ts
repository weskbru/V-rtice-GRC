import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  seedPassword,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';

test.describe('An administrator creates a scoped user and its grants are enforced (US8)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real administration journey.',
  );

  let createdUserFullName: string | undefined;

  const RISK_ANALYST_LABEL = 'Analista de Riscos';

  test.afterEach(async ({ browser }, testInfo) => {
    if (!createdUserFullName) return;
    const cleanupContext = await browser.newContext();
    try {
      const cleanupPage = await cleanupContext.newPage();
      await signInAsWorkerAdmin(cleanupPage, testInfo);
      await cleanupPage.goto('/admin/users');
      await cleanupPage.getByLabel('Buscar usuários').fill(createdUserFullName);
      const row = cleanupPage.getByRole('row').filter({ hasText: createdUserFullName });
      await row.getByRole('button', { name: /Ações para/ }).click();
      await cleanupPage.getByRole('menuitem', { name: 'Desativar' }).click();
      const statusDialog = cleanupPage.getByRole('dialog');
      await statusDialog.getByRole('button', { name: 'Desativar', exact: true }).click();
      await expect(
        cleanupPage.getByText('Usuário desativado e suas sessões foram encerradas.'),
      ).toBeVisible();
    } finally {
      await cleanupContext.close();
      createdUserFullName = undefined;
    }
  });

  test('the new user can do what its role and scope grant allow, and nothing else', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const outOfScopeTitle = `Risco fora do escopo E2E ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(outOfScopeTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência fora do escopo concedido ao usuário do E2E (T175).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const outOfScopeRiskUrl = page.url();

    const email = `e2e-scoped-${uniqueSuffix}@verticegrc.local`;
    const fullName = `Usuário Escopo E2E ${uniqueSuffix}`;
    const initialPassword = `${seedPassword}-Scoped-1`;

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();
    await page.getByRole('button', { name: 'Novo usuário' }).click();
    await expect(page.getByRole('heading', { name: 'Novo usuário' })).toBeVisible();
    await page.getByLabel('Nome completo').fill(fullName);
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha inicial').fill(initialPassword);
    await page.getByRole('button', { name: 'Criar usuário' }).click();
    await expect(page.getByText('Usuário criado com sucesso.')).toBeVisible();
    createdUserFullName = fullName;

    await page.getByLabel('Buscar usuários').fill(email);
    await expect(page.getByText(email)).toBeVisible();

    const userRow = page.getByRole('row').filter({ hasText: fullName });
    await userRow.getByRole('button', { name: /Ações para/ }).click();
    await page.getByRole('menuitem', { name: 'Papéis' }).click();
    const rolesDialog = page.getByRole('dialog');
    await expect(rolesDialog.getByRole('heading', { name: `Papéis de ${fullName}` })).toBeVisible();
    await rolesDialog.getByText(RISK_ANALYST_LABEL, { exact: true }).click();
    await rolesDialog.getByRole('button', { name: 'Salvar papéis' }).click();
    await expect(page.getByText('Papéis atualizados com sucesso.')).toBeVisible();

    await page.goto('/admin/organization');
    await expect(page.getByRole('heading', { name: 'Estrutura organizacional' })).toBeVisible();
    await page.getByRole('button', { name: /^Division A \/ Team 1/ }).click();
    await page.getByLabel('Buscar usuário').fill(fullName);
    await page.getByRole('button', { name: new RegExp(fullName) }).click();
    await expect(page.getByRole('heading', { name: `Escopo de ${fullName}` })).toBeVisible();
    await page.getByRole('button', { name: 'Conceder escopo' }).click();
    await expect(page.getByText('Escopo concedido com sucesso.')).toBeVisible();

    await signOut(page);
    await signInAsFreshlyProvisionedUser(page, email, initialPassword);

    await expect(page.getByRole('link', { name: 'Usuários' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Papéis e permissões' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Estrutura organizacional' })).not.toBeVisible();
    await page.goto('/admin/users');
    await expect(page.getByRole('button', { name: 'Novo usuário' })).not.toBeVisible();

    await page.goto(outOfScopeRiskUrl);
    await expect(page.getByText('Risco não encontrado')).toBeVisible();

    const inScopeTitle = `Risco dentro do escopo E2E ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(inScopeTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência dentro do escopo concedido ao usuário do E2E (T175).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill('Platform Administrator');
    const ancestorOwnerOption = page.getByRole('option', {
      name: /^Platform Administrator \S+@\S+$/,
    });
    await expect(ancestorOwnerOption).toBeVisible({ timeout: 15_000 });
    await ancestorOwnerOption.click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: inScopeTitle })).toBeVisible();
  });
});
