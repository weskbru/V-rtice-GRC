import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  signInAsWorkerAdmin,
  workerAdminFullName,
} from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection } from './support/risk-detail-sections';

test.describe('Record treatment, add actions, link a control, observe overdue (US5)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real treatment journey.',
  );

  test('records a treatment decision, adds actions, links a control, and the overdue action is flagged', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    const adminFullName = workerAdminFullName(testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para tratamento E2E ${uniqueSuffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência criado pelo E2E de tratamento (T136).');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await openRiskDetailSection(page, 'treatment');
    await expect(
      page.getByText('Este risco ainda não possui uma decisão de tratamento'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Registrar nova decisão' }).click();
    await page.getByRole('combobox', { name: 'Estratégia' }).click();
    await page.getByRole('option', { name: 'Mitigar' }).click();
    await page.getByLabel('Descrição').fill('Mitigar por meio de controles adicionais.');
    await page.getByRole('button', { name: 'Registrar decisão' }).click();

    await expect(page.getByText('Mitigar por meio de controles adicionais.')).toBeVisible();
    await expect(page.getByText(`Decidido por ${adminFullName}`)).toBeVisible();

    await openRiskDetailSection(page, 'action-plans');

    const actionForm = page.locator('form').filter({ hasText: 'Nova ação de tratamento' });
    await page.getByRole('button', { name: 'Adicionar ação' }).click();
    await actionForm.getByLabel('Título').fill('Ação com prazo no passado (E2E)');
    await actionForm.getByRole('combobox', { name: 'Responsável' }).click();
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill(adminFullName);
    await page.getByRole('option', { name: new RegExp(`^${adminFullName} `) }).click();
    await actionForm.getByLabel('Prazo').fill('2020-01-01');
    await actionForm.getByRole('button', { name: 'Adicionar ação' }).click();

    await expect(page.getByText('Ação com prazo no passado (E2E)')).toBeVisible();
    await expect(page.getByText('Vencida', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Adicionar ação' }).click();
    await actionForm.getByLabel('Título').fill('Ação futura (E2E)');
    await actionForm.getByRole('combobox', { name: 'Responsável' }).click();
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill(adminFullName);
    await page.getByRole('option', { name: new RegExp(`^${adminFullName} `) }).click();
    await actionForm.getByLabel('Prazo').fill('2099-01-01');
    await actionForm.getByRole('button', { name: 'Adicionar ação' }).click();

    await expect(page.getByText('Ação futura (E2E)')).toBeVisible();
    const futureRow = page.getByRole('row').filter({ hasText: 'Ação futura (E2E)' });
    await expect(futureRow.getByText('Vencida', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Vencida', { exact: true })).toHaveCount(1);

    await openRiskDetailSection(page, 'controls');
    await expect(page.getByText('Nenhum controle vinculado a este risco.')).toBeVisible();

    await page.getByRole('button', { name: 'Vincular controle' }).click();
    await page.getByRole('combobox', { name: 'Selecionar controle' }).click();
    await page.getByPlaceholder('Buscar controle por nome ou código').fill('FIXTURE-CONTROL-1');
    const fixtureControlOption = page.getByRole('option', { name: /Controle de acesso lógico/ });
    await expect(fixtureControlOption).toBeVisible({ timeout: 10_000 });
    await fixtureControlOption.click();
    await page.getByRole('button', { name: 'Vincular controle' }).click();

    await expect(page.getByText('Controle de acesso lógico (fixture)')).toBeVisible();
    await expect(page.getByText('FIXTURE-CONTROL-1')).toBeVisible();

    await page.getByRole('button', { name: 'Desvincular' }).click();
    await expect(page.getByText('Desvincular controle?')).toBeVisible();
    await expect(
      page.getByText(/O vínculo não é apagado: ele continua registrado no histórico/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Desvincular' }).click();

    await expect(page.getByText('Nenhum controle vinculado a este risco.')).toBeVisible();
  });
});
