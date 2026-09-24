import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { SEEDED_ROOT_ORG_UNIT_NAME, selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection } from './support/risk-detail-sections';

import type { Page, TestInfo } from '@playwright/test';

test.describe('Asset and Process: cadastro -> inventário/catálogo -> edição -> desativação -> recusa de vínculo -> reativação (US1-US3)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real asset/process journey.',
  );

  interface DomainFixture {
    readonly kind: 'ativo' | 'processo';
    readonly registerPath: string;
    readonly newPath: string;
    readonly pageHeading: string;
    readonly createFormHeading: string;
    readonly submitCreateLabel: string;
    readonly saveLabel: string;
    readonly editAction: string;
    readonly searchLabel: string;
    readonly codePattern: RegExp;
    readonly createSuccessText: string;
    readonly updateSuccessText: string;
    readonly deactivateAction: string;
    readonly deactivateConfirmTitle: string;
    readonly deactivateSuccessText: string;
    readonly reactivateAction: string;
    readonly reactivateConfirmTitle: string;
    readonly reactivateSuccessText: string;
    readonly cardSelectLabel: (code: string, name: string) => string;
    readonly linkPickerLabel: string;
    readonly linkPickerSearchPlaceholder: string;
    readonly linkPickerAriaLabel: string;
    readonly linkGenericErrorText: string;
    readonly linkSuccessText: string;
    readonly linkEmptyText: string;
    readonly overviewNoDescription: string;
  }

  const ASSET: DomainFixture = {
    kind: 'ativo',
    registerPath: '/assets',
    newPath: '/assets/new',
    pageHeading: 'Ativos',
    createFormHeading: 'Novo ativo',
    submitCreateLabel: 'Cadastrar ativo',
    saveLabel: 'Salvar alterações',
    editAction: 'Editar',
    searchLabel: 'Buscar ativos',
    codePattern: /^AST-\d{4}-\d+$/,
    createSuccessText: 'Ativo cadastrado.',
    updateSuccessText: 'Ativo atualizado.',
    deactivateAction: 'Desativar',
    deactivateConfirmTitle: 'Desativar este ativo?',
    deactivateSuccessText: 'Ativo desativado.',
    reactivateAction: 'Reativar',
    reactivateConfirmTitle: 'Reativar este ativo?',
    reactivateSuccessText: 'Ativo reativado.',
    cardSelectLabel: (code, name) => `Abrir ativo ${code} — ${name}`,
    linkPickerLabel: 'Vincular ativo',
    linkPickerSearchPlaceholder: 'Buscar ativo por nome ou código',
    linkPickerAriaLabel: 'Selecionar ativo',
    linkGenericErrorText: 'Não foi possível vincular o ativo. Tente novamente.',
    linkSuccessText: 'Ativo vinculado.',
    linkEmptyText: 'Nenhum ativo vinculado a este risco.',
    overviewNoDescription: 'Sem descrição.',
  };

  const PROCESS: DomainFixture = {
    kind: 'processo',
    registerPath: '/processes',
    newPath: '/processes/new',
    pageHeading: 'Processos',
    createFormHeading: 'Novo processo',
    submitCreateLabel: 'Cadastrar processo',
    saveLabel: 'Salvar alterações',
    editAction: 'Editar',
    searchLabel: 'Buscar processos',
    codePattern: /^PRC-\d{4}-\d+$/,
    createSuccessText: 'Processo cadastrado.',
    updateSuccessText: 'Processo atualizado.',
    deactivateAction: 'Desativar',
    deactivateConfirmTitle: 'Desativar este processo?',
    deactivateSuccessText: 'Processo desativado.',
    reactivateAction: 'Reativar',
    reactivateConfirmTitle: 'Reativar este processo?',
    reactivateSuccessText: 'Processo reativado.',
    cardSelectLabel: (code, name) => `Abrir processo ${code} — ${name}`,
    linkPickerLabel: 'Vincular processo',
    linkPickerSearchPlaceholder: 'Buscar processo por nome ou código',
    linkPickerAriaLabel: 'Selecionar processo',
    linkGenericErrorText: 'Não foi possível vincular o processo. Tente novamente.',
    linkSuccessText: 'Processo vinculado.',
    linkEmptyText: 'Nenhum processo vinculado a este risco.',
    overviewNoDescription: 'Sem descrição.',
  };

  async function runFullJourney(
    page: Page,
    testInfo: TestInfo,
    domain: DomainFixture,
  ): Promise<void> {
    test.setTimeout(90_000);

    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const name = `${domain.kind === 'ativo' ? 'Ativo' : 'Processo'} E2E ${uniqueSuffix}`;
    const description = `Descrição inicial do ${domain.kind} E2E (T054), sufixo ${uniqueSuffix}.`;

    await page.goto(domain.newPath);
    await expect(page.getByRole('heading', { name: domain.createFormHeading })).toBeVisible();
    await page.getByLabel('Nome').fill(name);
    await page.getByLabel('Descrição').fill(description);
    await selectSeededRootOrgUnit(page);
    const orgUnitName = SEEDED_ROOT_ORG_UNIT_NAME;
    await page.getByRole('button', { name: domain.submitCreateLabel }).click();

    await expect(page.getByText(domain.createSuccessText)).toBeVisible();
    await page.waitForURL(new RegExp(`${domain.registerPath}/[0-9a-fA-F-]+$`), {
      timeout: 15_000,
    });
    const entityId = page.url().split('/').pop()!;
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

    const codeLocator = page.getByText(domain.codePattern).first();
    await expect(codeLocator).toBeVisible();
    const code = (await codeLocator.textContent())!.trim();
    expect(code).toMatch(domain.codePattern);

    await page.goto(domain.registerPath);
    await expect(page.getByRole('heading', { name: domain.pageHeading })).toBeVisible();

    await page.getByLabel(domain.searchLabel).fill(name);
    const cardLink = page.getByRole('link', { name: domain.cardSelectLabel(code, name) });
    await expect(cardLink).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(domain.searchLabel).fill('');
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: orgUnitName, exact: true }).click();

    await page.getByRole('combobox', { name: 'Ordenar por' }).click();
    await page.getByRole('option', { name: 'Última atualização — decrescente' }).click();

    await expect(page.getByRole('link', { name: domain.cardSelectLabel(code, name) })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel(domain.searchLabel)).toHaveValue('');

    await page.getByRole('link', { name: domain.cardSelectLabel(code, name) }).click();
    await page.waitForURL(new RegExp(`${domain.registerPath}/${entityId}$`));
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

    const updatedDescription = `${description} Editado pelo E2E.`;
    await page.getByRole('button', { name: domain.editAction }).click();
    await page.getByLabel('Descrição').fill(updatedDescription);
    await page.getByRole('button', { name: domain.saveLabel }).click();
    await expect(page.getByText(domain.updateSuccessText)).toBeVisible();
    await expect(page.getByText(updatedDescription)).toBeVisible();

    await page.getByRole('button', { name: domain.deactivateAction, exact: true }).click();
    const deactivateDialog = page.getByRole('dialog');
    await expect(
      deactivateDialog.getByRole('heading', { name: domain.deactivateConfirmTitle }),
    ).toBeVisible();
    await deactivateDialog
      .getByRole('button', { name: domain.deactivateAction, exact: true })
      .click();
    await expect(deactivateDialog).toBeHidden();
    await expect(page.getByText(domain.deactivateSuccessText)).toBeVisible();
    await expect(page.getByText('Inativo', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByText(updatedDescription)).toBeVisible();

    const riskTitle = `Risco para recusa de vínculo E2E ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill(`Risco criado para provar a recusa de vínculo com ${domain.kind} inativo (T054).`);
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: orgUnitName, exact: true }).click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const riskId = page.url().split('/').pop()!;
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();

    await openRiskDetailSection(page, 'processes-assets');
    await page.getByRole('combobox', { name: domain.linkPickerAriaLabel }).click();
    await page.getByPlaceholder(domain.linkPickerSearchPlaceholder).fill(code);
    const inactiveOption = page.getByRole('option').filter({ hasText: code });
    await expect(inactiveOption).toBeVisible({ timeout: 10_000 });
    await inactiveOption.click();
    await page.getByRole('button', { name: domain.linkPickerLabel }).click();
    await expect(page.getByText(domain.linkGenericErrorText)).toBeVisible();
    await expect(page.getByText(domain.linkEmptyText)).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0);

    await page.goto(`${domain.registerPath}/${entityId}`);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: domain.reactivateAction, exact: true }).click();
    const reactivateDialog = page.getByRole('dialog');
    await expect(
      reactivateDialog.getByRole('heading', { name: domain.reactivateConfirmTitle }),
    ).toBeVisible();
    await reactivateDialog
      .getByRole('button', { name: domain.reactivateAction, exact: true })
      .click();
    await expect(reactivateDialog).toBeHidden();
    await expect(page.getByText(domain.reactivateSuccessText)).toBeVisible();
    await expect(page.getByText('Ativo', { exact: true }).first()).toBeVisible();

    await page.goto(`/risks/${riskId}`);
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    await openRiskDetailSection(page, 'processes-assets');
    await page.getByRole('combobox', { name: domain.linkPickerAriaLabel }).click();
    await page.getByPlaceholder(domain.linkPickerSearchPlaceholder).fill(code);
    const activeOption = page.getByRole('option').filter({ hasText: code });
    await expect(activeOption).toBeVisible({ timeout: 10_000 });
    await activeOption.click();
    await page.getByRole('button', { name: domain.linkPickerLabel }).click();
    await expect(page.getByText(domain.linkSuccessText)).toBeVisible();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }

  test('asset: create -> find -> edit -> deactivate -> refused link -> reactivate', async ({
    page,
  }, testInfo) => {
    await runFullJourney(page, testInfo, ASSET);
  });

  test('process: create -> find -> edit -> deactivate -> refused link -> reactivate', async ({
    page,
  }, testInfo) => {
    await runFullJourney(page, testInfo, PROCESS);
  });
});
