import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection } from './support/risk-detail-sections';

test.describe('Ativo — detail: seções, overlay de edição, aside (022-asset-detail-experience)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real asset detail journey.',
  );

  test('creates an asset, deep-links every section, shows the aside’s own honest zero, edits it in an overlay (Escape and Cancelar both close it without leaving the page), and a real risk link turns the zero into a real count', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    await signInAsWorkerAdmin(page, testInfo);

    const suffix = Date.now().toString(36);
    const assetName = `Ativo E2E ${suffix}`;
    const description = 'Ativo criado pelo E2E de 022-asset-detail-experience.';

    await page.goto('/assets/new');
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    await page.getByLabel('Nome').fill(assetName);
    await page.getByLabel('Descrição').fill(description);
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Cadastrar ativo' }).click();
    await page.waitForURL(/\/assets\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: assetName, exact: true })).toBeVisible();

    const assetUrl = page.url();

    await page.goto(`${assetUrl}?section=controls`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: 'Controles', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Nenhum controle vinculado a este ativo.')).toBeVisible();

    await page.goto(`${assetUrl}?section=nao-existe`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: 'Visão geral', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Descrição', { exact: true }).first()).toBeVisible();

    await page.goto(assetUrl, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: 'Visão geral', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Descrição', { exact: true }).first()).toBeVisible();

    const aside = page.getByRole('complementary', { name: 'Contexto do ativo' });
    await expect(aside.getByRole('link', { name: 'Riscos (0)' })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Controles (0)' })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Incidentes Ver' })).toBeVisible();

    const editButton = page.getByRole('button', { name: 'Editar' });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Editar ativo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fechar' })).toHaveCount(0);
    await expect(page.getByText('Situação atual do ativo')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(editButton).toBeFocused();
    await expect(page).toHaveURL(assetUrl);

    await editButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(assetUrl);
    await expect(page.getByRole('heading', { name: assetName, exact: true })).toBeVisible();

    const updatedDescription = `${description} Editado pelo E2E.`;
    await editButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Descrição').fill(updatedDescription);
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(updatedDescription)).toBeVisible();

    const riskTitle = `Risco para aside E2E ${suffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco criado para provar a contagem real do aside do ativo (022).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: 'Vértice GRC', exact: true }).click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();

    await openRiskDetailSection(page, 'processes-assets');
    await page.getByRole('combobox', { name: 'Selecionar ativo' }).click();
    await page.getByPlaceholder('Buscar ativo por nome ou código').fill(assetName);
    const assetOption = page.getByRole('option').filter({ hasText: assetName });
    await expect(assetOption).toBeVisible({ timeout: 10_000 });
    await assetOption.click();
    await page.getByRole('button', { name: 'Vincular ativo', exact: true }).click();
    await expect(page.getByText('Ativo vinculado.')).toBeVisible();

    await page.goto(assetUrl, { waitUntil: 'networkidle' });
    await expect(aside.getByRole('link', { name: 'Riscos (1)' })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Controles (0)' })).toBeVisible();
  });
});
