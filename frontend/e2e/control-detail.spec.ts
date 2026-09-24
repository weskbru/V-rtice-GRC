import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';

test.describe('Controle — detail: seções, overlay de edição, ciclo de vida (021-control-detail-experience)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real control detail journey.',
  );

  test('creates a control, deep-links every section, edits it in an overlay (Escape and Cancelar both close it without leaving the page — F-79), clears a lifecycle pendency and transitions to Ativo, registers a verification, and links/unlinks a process behind the gated picker', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    await signInAsWorkerAdmin(page, testInfo);

    const suffix = Date.now().toString(36);
    const controlName = `Controle E2E ${suffix}`;

    await page.goto('/controls/new');
    await expect(page.getByRole('heading', { name: 'Novo controle' })).toBeVisible();
    await page.getByLabel('Nome').fill(controlName);
    await page
      .getByLabel('Descrição')
      .fill('Controle criado pelo E2E de 021-control-detail-experience.');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Cadastrar controle' }).click();
    await page.waitForURL(/\/controls\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: controlName, exact: true })).toBeVisible();

    const controlUrl = page.url();

    await expect(page.getByText('Rascunho', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Não avaliado', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Nenhuma verificação atestada até o momento.')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Aplicar: Ativo' })).toBeDisabled();
    await expect(
      page.getByText('O controle precisa ter um dono definido para entrar em operação.'),
    ).toBeVisible();

    await page.goto(`${controlUrl}?section=assessments`, { waitUntil: 'networkidle' });
    await expect(page.getByText('Registrar verificação', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(
        'Este controle não está ativo — apenas controles ativos aceitam novas verificações.',
      ),
    ).toBeVisible();

    await page.goto(`${controlUrl}?section=nao-existe`, { waitUntil: 'networkidle' });
    await expect(page.getByText('Descrição', { exact: true }).first()).toBeVisible();

    await page.goto(controlUrl, { waitUntil: 'networkidle' });
    await expect(page.getByText('Descrição', { exact: true }).first()).toBeVisible();

    const editButton = page.getByRole('button', { name: 'Editar' });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Altere os dados cadastrais do controle.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fechar' })).toBeVisible();
    await expect(page.getByText('Ciclo de vida')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(editButton).toBeFocused();
    await expect(page).toHaveURL(controlUrl);

    await editButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(controlUrl);
    await expect(page.getByRole('heading', { name: controlName, exact: true })).toBeVisible();

    await editButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Responsável pelo controle' }).click();
    const firstOwnerOption = page.getByRole('option').first();
    await firstOwnerOption.waitFor({ state: 'visible', timeout: 10_000 });
    const ownerName = (await firstOwnerOption.innerText()).split('\n')[0]?.trim() ?? '';
    await firstOwnerOption.click();
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(dialog).toBeHidden();
    if (ownerName) {
      await expect(page.getByText(ownerName, { exact: false }).first()).toBeVisible();
    }

    const applyActive = page.getByRole('button', { name: 'Aplicar: Ativo' });
    await expect(applyActive).toBeEnabled();
    await expect(
      page.getByText('O controle precisa ter um dono definido para entrar em operação.'),
    ).toHaveCount(0);

    await applyActive.click();
    const transitionDialog = page.getByRole('dialog');
    await expect(
      transitionDialog.getByRole('heading', { name: 'Aplicar transição: Ativo' }),
    ).toBeVisible();
    await transitionDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(transitionDialog).toBeHidden();

    await expect(page.getByText('Ativo', { exact: true }).first()).toBeVisible();
    const visibleTrack = page.locator(
      'ol[aria-label="Posições do ciclo de vida do controle"]:visible',
    );
    await expect(visibleTrack.getByText('Concluído', { exact: true })).toBeVisible();
    await expect(visibleTrack.getByText('Atual', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Verificações' }).click();
    await expect(
      page.getByText(
        'Este controle não está ativo — apenas controles ativos aceitam novas verificações.',
      ),
    ).toHaveCount(0);

    await page.getByRole('combobox', { name: 'Resultado' }).click();
    await page.getByRole('option', { name: 'Efetivo', exact: true }).click();
    await page
      .getByLabel('Conclusão')
      .fill('Verificação registrada pelo E2E — acessos revisados sem inconsistências.');
    await page.getByRole('button', { name: 'Registrar verificação', exact: true }).click();
    await expect(
      page.getByText('Verificação registrada pelo E2E — acessos revisados sem inconsistências.'),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Vínculos' }).click();
    await expect(page.getByText('Nenhum processo vinculado a este controle.')).toBeVisible();
    const linkProcessTrigger = page.getByRole('button', { name: 'Vincular processo' });
    await expect(linkProcessTrigger).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Selecionar processo' })).toHaveCount(0);

    await linkProcessTrigger.click();
    const processCombo = page.getByRole('combobox', { name: 'Selecionar processo' });
    await expect(processCombo).toBeVisible();
    await processCombo.click();
    const firstProcessOption = page.getByRole('option').first();
    await firstProcessOption.waitFor({ state: 'visible', timeout: 10_000 });
    const linkedProcessName = (await firstProcessOption.innerText()).split('\n')[0]?.trim() ?? '';
    await firstProcessOption.click();
    await page.getByRole('button', { name: 'Vincular processo', exact: true }).click();
    await expect(page.getByText('Nenhum processo vinculado a este controle.')).toHaveCount(0);
    if (linkedProcessName) {
      await expect(page.getByText(linkedProcessName, { exact: false }).first()).toBeVisible();
    }

    await page.getByRole('button', { name: 'Desvincular' }).first().click();
    const unlinkDialog = page.getByRole('dialog');
    await expect(
      unlinkDialog.getByRole('heading', { name: 'Desvincular processo?' }),
    ).toBeVisible();
    await unlinkDialog.getByRole('button', { name: 'Desvincular' }).click();
    await expect(unlinkDialog).toBeHidden();
    await expect(page.getByText('Nenhum processo vinculado a este controle.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vincular processo' })).toBeVisible();

    await page.getByRole('tab', { name: 'Evidências' }).click();
    await expect(page.getByText('Evidência', { exact: true }).first()).toBeVisible();
  });
});
