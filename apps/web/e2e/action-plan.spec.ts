import { expect, test } from '@playwright/test';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signInAsWorkerAdmin,
  workerAdminFullName,
} from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection } from './support/risk-detail-sections';

import type { Locator, Page } from '@playwright/test';

async function findRowAcrossPages(page: Page, text: string): Promise<Locator> {
  const resultsSummary = page.getByRole('status').filter({ hasText: ' de ' });
  const nextPageButton = page.getByRole('button', { name: 'Próxima página' });
  const row = page.getByRole('row').filter({ hasText: text });

  const MAX_PAGES = 20;
  for (let attempt = 0; attempt < MAX_PAGES; attempt += 1) {
    try {
      await expect(row).toHaveCount(1, { timeout: 3_000 });
      return row;
    } catch {}
    if (await nextPageButton.isDisabled()) {
      break;
    }
    const before = await resultsSummary.textContent();
    await nextPageButton.click({ timeout: 10_000 });
    await expect(resultsSummary).not.toHaveText(before ?? '', { timeout: 10_000 });
  }
  throw new Error(
    `"${text}" was not found on any page of the current filter (checked up to ${MAX_PAGES} pages).`,
  );
}

test.describe('Plano de Ação — an action created in a risk is managed centrally', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real Plano de Ação journey.',
  );

  test('creates an action inside a risk, finds it centrally, edits it, transitions it and reads its trail', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    await signInAsWorkerAdmin(page, testInfo);
    const adminFullName = workerAdminFullName(testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const riskTitle = `Risco para plano de acao E2E ${uniqueSuffix}`;
    const actionTitle = `Acao de plano E2E ${uniqueSuffix}`;
    const editedTitle = `${actionTitle} revisada`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page.getByLabel('Descrição').fill('Risco de evidência criado pelo E2E de Plano de Ação.');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();

    await openRiskDetailSection(page, 'action-plans');

    const actionForm = page.locator('form').filter({ hasText: 'Nova ação de tratamento' });
    await page.getByRole('button', { name: 'Adicionar ação' }).click();
    await actionForm.getByLabel('Título').fill(actionTitle);
    await actionForm.getByRole('combobox', { name: 'Responsável' }).click();
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill(adminFullName);
    await page.getByRole('option', { name: new RegExp(`^${adminFullName} `) }).click();
    await actionForm.getByLabel('Prazo').fill('2000-01-01');
    await actionForm.getByRole('button', { name: 'Adicionar ação' }).click();

    await expect(page.getByText(actionTitle, { exact: true })).toBeVisible();
    await expect(page.getByText('Vencida', { exact: true }).first()).toBeVisible();

    await page.goto('/actions');
    await expect(page.getByRole('heading', { name: 'Planos de Ação' })).toBeVisible();
    await page.getByRole('radio', { name: 'Ver as ações em tabela' }).click();
    await page.getByRole('button', { name: 'Filtros' }).click();

    await page.getByRole('combobox', { name: 'Origem' }).click();
    await page.getByRole('option', { name: 'Tratamento de risco' }).click();
    await page.getByRole('checkbox', { name: 'Somente atrasadas' }).click();

    const centralRow = await findRowAcrossPages(page, actionTitle);
    await expect(centralRow).toContainText(riskTitle);
    await expect(centralRow.getByText('Atrasada', { exact: true })).toBeVisible();

    await centralRow.getByRole('link').first().click();
    await page.waitForURL(/\/actions\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: actionTitle, exact: true })).toBeVisible();
    const actionUrl = page.url();

    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Título').fill(editedTitle);
    await page.getByRole('button', { name: 'Salvar alterações' }).click();

    await expect(page.getByRole('heading', { name: editedTitle, exact: true })).toBeVisible();
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: editedTitle, exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Auditoria' }).click();
    await expect(page.getByText('action.created')).toBeVisible();
    await expect(page.getByText('action.updated')).toBeVisible();
    await expect(page.getByText('Nenhum evento de auditoria registrado ainda.')).toHaveCount(0);
    await expect(page.getByText('Não foi possível carregar a trilha de auditoria.')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Visão geral' }).click();
    await expect(page.getByRole('button', { name: 'Concluir' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Iniciar' }).click();
    await expect(page.getByText('Em andamento', { exact: true }).first()).toBeVisible();

    await page.goto('/actions');
    await page.getByRole('radio', { name: 'Ver as ações em tabela' }).click();
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('combobox', { name: 'Origem' }).click();
    await page.getByRole('option', { name: 'Tratamento de risco' }).click();
    await page.getByRole('checkbox', { name: 'Somente atrasadas' }).click();
    await findRowAcrossPages(page, editedTitle);

    await page.getByRole('combobox', { name: 'Origem' }).click();
    await page.getByRole('option', { name: 'Incidente' }).click();
    await expect(page.getByRole('row').filter({ hasText: editedTitle })).toHaveCount(0);

    await page.getByRole('combobox', { name: 'Origem' }).click();
    await page.getByRole('option', { name: 'Tratamento de risco' }).click();
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Concluída' }).click();
    await expect(page.getByRole('row').filter({ hasText: editedTitle })).toHaveCount(0);

    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Em andamento' }).click();
    await findRowAcrossPages(page, editedTitle);

    await page.goto(actionUrl);
    await expect(page.getByRole('heading', { name: editedTitle, exact: true })).toBeVisible();
  });
});

test.describe('Plano de Ação — a caller who cannot treat the risk gets a read-only plan', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real permission gate.',
  );

  test('hides creation and row actions from a caller holding risk:view without risk:treat', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);

    const uniqueSuffix = Date.now().toString(36);
    const riskTitle = `Risco somente leitura E2E ${uniqueSuffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco do E2E que verifica o gate de escrita do plano de ação.');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    await openRiskDetailSection(page, 'action-plans');

    await expect(page.getByText('Plano de ação', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar ação' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ações', exact: true })).toHaveCount(0);
  });
});

test.describe('Plano de Ação — detail: overlay editing, lifecycle trail, reopen dialog (Fase C)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the action detail overlay and lifecycle trail.',
  );

  test('Editar opens an overlay Sheet (Escape closes it, focus returns); the trail advances through COMPLETED and a reopen that requires a reason', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    await signInAsWorkerAdmin(page, testInfo);
    const adminFullName = workerAdminFullName(testInfo);

    const suffix = Date.now().toString(36);
    const riskTitle = `Risco para overlay E2E ${suffix}`;
    const actionTitle = `Acao de overlay E2E ${suffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco criado pelo E2E do overlay de edição de Plano de Ação.');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    await openRiskDetailSection(page, 'action-plans');
    const actionForm = page.locator('form').filter({ hasText: 'Nova ação de tratamento' });
    await page.getByRole('button', { name: 'Adicionar ação' }).click();
    await actionForm.getByLabel('Título').fill(actionTitle);
    await actionForm.getByRole('combobox', { name: 'Responsável' }).click();
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill(adminFullName);
    await page.getByRole('option', { name: new RegExp(`^${adminFullName} `) }).click();
    await actionForm.getByLabel('Prazo').fill('2030-01-01');
    await actionForm.getByRole('button', { name: 'Adicionar ação' }).click();
    await expect(page.getByText(actionTitle, { exact: true })).toBeVisible();

    await page.getByRole('link', { name: actionTitle, exact: true }).click();
    await page.waitForURL(/\/actions\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: actionTitle, exact: true })).toBeVisible();

    const editButton = page.getByRole('button', { name: 'Editar' });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Altere os dados cadastrais da ação.')).toBeVisible();
    await expect(page.getByText('Ciclo de vida')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Fechar' })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(editButton).toBeFocused();

    await editButton.click();
    const editedTitle = `${actionTitle} (editado)`;
    await dialog.getByLabel('Título').fill(editedTitle);
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: editedTitle, exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Concluir' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Iniciar' }).click();
    await expect(page.getByText('Em andamento', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByText('Concluída em', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Reabrir' }).click();
    const reopenDialog = page.getByRole('dialog');
    await expect(reopenDialog.getByRole('heading', { name: 'Reabrir ação' })).toBeVisible();

    await reopenDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(reopenDialog.getByText('Informe o motivo da reabertura.')).toBeVisible();
    await expect(reopenDialog).toBeVisible();

    await reopenDialog
      .getByLabel('Motivo da reabertura')
      .fill('Reaberta pelo E2E para revalidar o trabalho.');
    await reopenDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(reopenDialog).toBeHidden();

    await expect(page.getByText('Reaberta em', { exact: true })).toBeVisible();
    await expect(page.getByText('Concluída em', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Aberta', { exact: true }).first()).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('Aberta', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Reaberta em', { exact: true })).toBeVisible();
    await expect(page.getByText('Concluída em', { exact: true })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Auditoria' }).click();
    await expect(page.getByText('action.reopened')).toBeVisible();
    await expect(page.getByText('action.completed')).toBeVisible();
  });
});
