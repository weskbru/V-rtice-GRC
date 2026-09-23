import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';

test.describe('Compliance — biblioteca normativa: cadastro de framework (F-55)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real compliance journey.',
  );

  test('creates a framework from the register and reaches its detail page', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);

    const suffix = Date.now().toString(36);
    const frameworkName = `Framework E2E ${suffix}`;

    await page.goto('/compliance');
    await expect(page.getByRole('heading', { name: 'Biblioteca normativa' })).toBeVisible();

    await page.goto('/compliance/new');
    await expect(page.getByRole('heading', { name: 'Cadastrar framework' })).toBeVisible();

    await page.getByLabel('Nome').fill(frameworkName);
    await page
      .getByLabel('Descrição')
      .fill('Framework criado pelo E2E de cobertura do módulo de Compliance (F-55).');
    await page.getByRole('combobox', { name: /^Origem/ }).click();
    await page.getByRole('option', { name: 'Norma externa', exact: true }).click();
    await page.getByRole('button', { name: 'Cadastrar framework' }).click();

    await page.waitForURL(/\/compliance\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: frameworkName, exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Versões' }).click();
    await expect(page.getByText('Nenhuma versão cadastrada')).toBeVisible();

    await page.goto('/compliance');
    await page.getByRole('searchbox', { name: 'Buscar por nome ou código' }).fill(frameworkName);
    await expect(
      page.getByRole('link', { name: new RegExp(`^Abrir o framework .*: ${frameworkName}$`) }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
