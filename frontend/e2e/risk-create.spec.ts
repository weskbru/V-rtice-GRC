import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';

test.describe('Create, edit and verify persistence of a risk (US2)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real risk-creation journey.',
  );

  test('creates a draft risk, edits it, and the edit survives a reload from the register', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const originalTitle = `Falha no fornecedor crítico ${uniqueSuffix}`;
    const editedTitle = `Falha no fornecedor crítico ${uniqueSuffix} (revisado)`;
    const description = 'Dependência de um único fornecedor sem plano de contingência formal.';

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();

    await page.getByLabel('Título').fill(originalTitle);
    await page.getByLabel('Descrição').fill(description);

    await selectSeededRootOrgUnit(page);

    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: 'Criar risco' }).click();

    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    await expect(page.getByRole('heading', { name: originalTitle })).toBeVisible();
    await expect(page.getByText(/^RSK-/).first()).toBeVisible();
    await expect(page.locator('header').getByText('Rascunho', { exact: true })).toBeVisible();

    const riskUrl = page.url();

    await page.getByRole('button', { name: 'Editar' }).click();
    const titleField = page.getByLabel('Título');
    await titleField.fill('');
    await titleField.fill(editedTitle);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();

    await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();

    await page.goto('/dashboard');
    await page.goto(riskUrl);

    await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();
    await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
  });
});
