import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';

import type { Browser, BrowserContext, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Dialog focus restoration and height (S-03, S-04, S-05, S-06)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise dialog focus/size behavior.',
  );

  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }, testInfo) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await signInAsWorkerAdmin(page, testInfo);
  });

  test.afterAll(async () => {
    await browserContext.close();
  });

  test('(a) Incident "Resolver" dialog (autoFocus field) restores focus to the "Resolver" button via Escape and via Cancelar', async () => {
    test.setTimeout(60_000);

    const suffix = Date.now().toString(36);
    const title = `[FIX-F1] Incidente ${suffix}`;

    await page.goto('/incidents/new');
    await expect(page.getByRole('heading', { name: 'Novo incidente' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Incidente criado pelo agente de correção F1 para validar restauração de foco.');
    await page.getByRole('combobox', { name: 'Severidade' }).click();
    await page.getByRole('option', { name: 'Alta' }).click();
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Registrar incidente' }).click();
    await page.waitForURL(/\/incidents\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByRole('button', { name: 'Iniciar atendimento' }).click();
    await expect(page.getByText('Em andamento', { exact: true }).first()).toBeVisible();

    const resolveTrigger = page.getByRole('button', { name: 'Resolver' });

    await resolveTrigger.click();
    const dialog1 = page.getByRole('dialog');
    await expect(dialog1.getByRole('heading', { name: 'Resolver este incidente?' })).toBeVisible();
    const field1 = dialog1.getByLabel('Resumo da resolução');
    await expect(field1).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog1).toBeHidden();
    await expect(resolveTrigger).toBeFocused();

    await resolveTrigger.click();
    const dialog2 = page.getByRole('dialog');
    await expect(dialog2.getByRole('heading', { name: 'Resolver este incidente?' })).toBeVisible();
    await expect(dialog2.getByLabel('Resumo da resolução')).toBeFocused();

    await dialog2.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog2).toBeHidden();
    await expect(resolveTrigger).toBeFocused();

    await expect(page.getByText('Em andamento', { exact: true }).first()).toBeVisible();
  });

  test('(b) /admin/users row menu "Editar" restores focus to the row\'s menu trigger via Escape and via Cancelar', async () => {
    await page.goto('/admin/users', { waitUntil: 'networkidle' });
    const menuTrigger = page.getByRole('button', { name: /Ações para/ }).first();
    await expect(menuTrigger).toBeVisible();

    await menuTrigger.click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const dialog1 = page.getByRole('dialog');
    await expect(dialog1.getByRole('heading', { name: 'Editar usuário' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog1).toBeHidden();
    await expect(menuTrigger).toBeFocused();

    await menuTrigger.click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const dialog2 = page.getByRole('dialog');
    await expect(dialog2.getByRole('heading', { name: 'Editar usuário' })).toBeVisible();

    await dialog2.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog2).toBeHidden();
    await expect(menuTrigger).toBeFocused();
  });

  test('(c) /reports "Executar" restores focus to that row\'s own button after a columns rebuild, via Escape', async () => {
    const suffix = Date.now().toString(36);
    const reportName = `[FIX-F1] Relatório ${suffix}`;
    const origin = new URL(page.url()).origin;

    const createResponse = await page.request.post('/api/v1/reports', {
      headers: { Origin: origin },
      data: {
        name: reportName,
        description: 'Relatório criado pelo agente de correção F1 para validar S-05.',
        metricKeys: ['RISK_TOTAL_BY_LEVEL'],
      },
    });
    expect(createResponse.ok(), await createResponse.text()).toBeTruthy();

    const pageSize = 100;
    const listResponse = await page.request.get(
      `/api/v1/reports?page=1&pageSize=${String(pageSize)}`,
      { headers: { Origin: origin } },
    );
    expect(listResponse.ok(), await listResponse.text()).toBeTruthy();
    const listBody = (await listResponse.json()) as { meta: { totalPages: number } };
    const lastPage = Math.max(1, listBody.meta.totalPages);

    await page.goto(`/reports?pageSize=${String(pageSize)}&page=${String(lastPage)}`, {
      waitUntil: 'networkidle',
    });
    const row = page.getByRole('row').filter({ hasText: reportName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    const runButton = row.getByRole('button', { name: 'Executar' });

    await runButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: reportName })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(row.getByRole('button', { name: 'Executar' })).toBeFocused();
  });

  test('(d1) Asset "Desativar" (plain-button ConfirmDialog) restores focus to its trigger via Escape and via Cancelar', async () => {
    const suffix = Date.now().toString(36);
    const name = `[FIX-F1] Ativo ${suffix}`;

    await page.goto('/assets/new');
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    await page.getByLabel('Nome').fill(name);
    await page
      .getByLabel('Descrição')
      .fill('Ativo criado pelo agente de correção F1 para validar S-04 isoladamente.');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Cadastrar ativo' }).click();
    await expect(page.getByText('Ativo cadastrado.')).toBeVisible();
    await page.waitForURL(/\/assets\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

    const deactivateTrigger = page.getByRole('button', { name: 'Desativar', exact: true });

    await deactivateTrigger.click();
    const dialog1 = page.getByRole('dialog');
    await expect(dialog1.getByRole('heading', { name: 'Desativar este ativo?' })).toBeVisible();
    const confirmButton1 = dialog1.getByRole('button', { name: 'Desativar', exact: true });
    await expect(confirmButton1).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog1).toBeHidden();
    await expect(deactivateTrigger).toBeFocused();

    await deactivateTrigger.click();
    const dialog2 = page.getByRole('dialog');
    await expect(dialog2.getByRole('heading', { name: 'Desativar este ativo?' })).toBeVisible();
    await expect(dialog2.getByRole('button', { name: 'Desativar', exact: true })).toBeFocused();

    await dialog2.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog2).toBeHidden();
    await expect(deactivateTrigger).toBeFocused();

    await expect(page.getByRole('button', { name: 'Desativar', exact: true })).toBeVisible();
  });

  test('(d2) /admin/users row menu "Encerrar sessões" restores focus to the row\'s menu trigger via Escape, without confirming', async () => {
    await page.goto('/admin/users', { waitUntil: 'networkidle' });
    const menuTrigger = page.getByRole('button', { name: /Ações para/ }).first();
    await expect(menuTrigger).toBeVisible();

    await menuTrigger.click();
    await page.getByRole('menuitem', { name: 'Encerrar sessões' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Encerrar sessões de/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(menuTrigger).toBeFocused();
  });

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ] as const) {
    test(`(e) DialogContent bounds itself to the viewport and keeps its primary action reachable at ${String(viewport.width)}x${String(viewport.height)}`, async () => {
      await page.setViewportSize(viewport);
      await page.goto('/admin/organization', { waitUntil: 'networkidle' });

      await page.getByRole('button', { name: 'Nova unidade raiz' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Nova unidade raiz' })).toBeVisible();

      const maxHeight = await dialog.evaluate((el) => window.getComputedStyle(el).maxHeight);
      const overflowY = await dialog.evaluate((el) => window.getComputedStyle(el).overflowY);
      expect(maxHeight).not.toBe('none');
      const maxHeightPx = Number.parseFloat(maxHeight);
      expect(maxHeightPx).toBeGreaterThan(0);
      expect(maxHeightPx).toBeLessThanOrEqual(viewport.height);
      expect(['auto', 'scroll']).toContain(overflowY);

      const submitButton = dialog.getByRole('button', { name: 'Criar unidade' });
      await expect(submitButton).toBeVisible();
      const box = await submitButton.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  }
});
