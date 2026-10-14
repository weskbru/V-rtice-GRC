import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { openIncidentDetailSection } from './support/incident-detail-sections';
import { SEEDED_ROOT_ORG_UNIT_NAME, selectSeededRootOrgUnit } from './support/org-units';

import type { Browser, BrowserContext, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Incident: create -> register -> detail -> lifecycle -> links (US1, US3)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real incident journey.',
  );

  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }, testInfo) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
    await signInAsWorkerAdmin(page, testInfo);
  });

  test.afterAll(async () => {
    await browserContext.close();
  });

  async function switchToTableView(): Promise<void> {
    await page.getByRole('radio', { name: 'Visualização em tabela' }).click();
    await expect(page).toHaveURL(/[?&]view=table/);
    await expect(page.getByRole('table', { name: 'Lista de incidentes registrados' })).toBeVisible({
      timeout: 15_000,
    });
  }

  async function createIncident(title: string): Promise<string> {
    await page.goto('/incidents/new');
    await expect(page.getByRole('heading', { name: 'Novo incidente' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Incidente criado pelo E2E (008-incidents-problems) para validar a jornada completa.');
    await page.getByRole('combobox', { name: 'Severidade' }).click();
    await page.getByRole('option', { name: 'Alta' }).click();
    await selectSeededRootOrgUnit(page);
    const orgUnitName = SEEDED_ROOT_ORG_UNIT_NAME;
    await page.getByRole('button', { name: 'Registrar incidente' }).click();
    await page.waitForURL(/\/incidents\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    return orgUnitName;
  }

  async function linkViaPicker(options: {
    sectionId: 'risks' | 'assets' | 'processes';
    pickerAriaLabel: string;
    searchPlaceholder: string;
    query: string;
    linkButtonLabel: string;
    linkSuccessText: string;
  }): Promise<void> {
    await openIncidentDetailSection(page, options.sectionId);
    await page.getByRole('button', { name: options.linkButtonLabel }).click();
    await page.getByRole('combobox', { name: options.pickerAriaLabel }).click();
    await page.getByPlaceholder(options.searchPlaceholder).fill(options.query);
    const match = page.getByRole('option').filter({ hasText: options.query });
    await expect(match).toBeVisible({ timeout: 10_000 });
    await match.click();
    await page.getByRole('button', { name: options.linkButtonLabel }).click();
    await expect(page.getByText(options.linkSuccessText)).toBeVisible();
  }

  test('create -> appears in register -> detail -> lifecycle -> link risk/asset/process -> links survive reload', async () => {
    test.setTimeout(120_000);

    const suffix = Date.now().toString(36);
    const title = `Incidente E2E ${suffix}`;
    const orgUnitName = await createIncident(title);
    const incidentUrl = page.url();

    await page.goto('/incidents');
    await expect(page.getByRole('heading', { name: 'Incidentes' })).toBeVisible();
    await page.getByLabel('Buscar incidentes').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]search=${suffix}`), { timeout: 5_000 });
    const rowLink = page.getByRole('link', { name: title });
    await expect(rowLink).toBeVisible({ timeout: 15_000 });
    await rowLink.click();
    await page.waitForURL(incidentUrl);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await expect(page.getByText('Aberto', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar atendimento' }).click();
    await expect(page.getByText('Em andamento', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Resolver' }).click();
    const resolveDialog = page.getByRole('dialog');
    await expect(
      resolveDialog.getByRole('heading', { name: 'Resolver este incidente?' }),
    ).toBeVisible();
    const resolutionSummary = `Resolvido pelo E2E ${suffix}.`;
    await resolveDialog.getByLabel('Resumo da resolução').fill(resolutionSummary);
    await resolveDialog.getByRole('button', { name: 'Resolver' }).click();
    await expect(resolveDialog).toBeHidden();
    await expect(page.getByText('Resolvido', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(resolutionSummary)).toBeVisible();

    const riskTitle = `Risco para incidente E2E ${suffix}`;
    await page.goto('/risks/new');
    await page.getByLabel('Título').fill(riskTitle);
    await page.getByLabel('Descrição').fill('Risco criado pelo E2E de incidentes (008).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: orgUnitName, exact: true }).click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    const assetName = `Ativo para incidente E2E ${suffix}`;
    await page.goto('/assets/new');
    await page.getByLabel('Nome').fill(assetName);
    await page.getByLabel('Descrição').fill('Ativo criado pelo E2E de incidentes (008).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: orgUnitName, exact: true }).click();
    await page.getByRole('button', { name: 'Cadastrar ativo' }).click();
    await page.waitForURL(/\/assets\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    const processName = `Processo para incidente E2E ${suffix}`;
    await page.goto('/processes/new');
    await page.getByLabel('Nome').fill(processName);
    await page.getByLabel('Descrição').fill('Processo criado pelo E2E de incidentes (008).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: orgUnitName, exact: true }).click();
    await page.getByRole('button', { name: 'Cadastrar processo' }).click();
    await page.waitForURL(/\/processes\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    await page.goto(incidentUrl);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await linkViaPicker({
      sectionId: 'risks',
      pickerAriaLabel: 'Selecionar risco',
      searchPlaceholder: 'Buscar risco por título ou código',
      query: riskTitle,
      linkButtonLabel: 'Vincular risco',
      linkSuccessText: 'Risco vinculado.',
    });
    await linkViaPicker({
      sectionId: 'assets',
      pickerAriaLabel: 'Selecionar ativo',
      searchPlaceholder: 'Buscar ativo por nome ou código',
      query: assetName,
      linkButtonLabel: 'Vincular ativo',
      linkSuccessText: 'Ativo vinculado.',
    });
    await linkViaPicker({
      sectionId: 'processes',
      pickerAriaLabel: 'Selecionar processo',
      searchPlaceholder: 'Buscar processo por nome ou código',
      query: processName,
      linkButtonLabel: 'Vincular processo',
      linkSuccessText: 'Processo vinculado.',
    });

    await openIncidentDetailSection(page, 'overview');
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    const closeDialog = page.getByRole('dialog');
    await expect(
      closeDialog.getByRole('heading', { name: 'Fechar este incidente?' }),
    ).toBeVisible();
    await closeDialog.getByRole('button', { name: 'Fechar', exact: true }).first().click();
    await expect(closeDialog).toBeHidden();
    await expect(page.getByText('Fechado', { exact: true }).first()).toBeVisible();

    await expect(page.getByRole('button', { name: 'Reabrir' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Fechado', { exact: true }).first()).toBeVisible();
    await openIncidentDetailSection(page, 'risks');
    await expect(page.getByText(riskTitle)).toBeVisible();
    await openIncidentDetailSection(page, 'assets');
    await expect(page.getByText(assetName)).toBeVisible();
    await openIncidentDetailSection(page, 'processes');
    await expect(page.getByText(processName)).toBeVisible();
  });

  test('register: search, sort by title (both directions) and status filter are reflected in the URL', async () => {
    const suffix = Date.now().toString(36);
    const titleA = `Zebra incidente ${suffix}`;
    const titleB = `Anta incidente ${suffix}`;
    await createIncident(titleA);
    await createIncident(titleB);

    await page.goto('/incidents');
    await expect(page.getByRole('heading', { name: 'Incidentes' })).toBeVisible();
    await switchToTableView();

    await page.getByLabel('Buscar incidentes').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]search=${suffix}`), { timeout: 5_000 });
    await expect(page.getByRole('link', { name: titleA })).toBeVisible();
    await expect(page.getByRole('link', { name: titleB })).toBeVisible();

    const titleHeaderButton = page.getByRole('button', { name: 'Título', exact: false });
    await titleHeaderButton.click();
    await expect(page).toHaveURL(/[?&]sort=title/);
    await expect(page).toHaveURL(/[?&]direction=asc/);
    const titleHeaderCell = page.getByRole('columnheader', { name: /^Título/ });
    await expect(titleHeaderCell).toHaveAttribute('aria-sort', 'ascending');
    await expect
      .poll(async () => {
        const rows = await page.locator('tbody tr', { hasText: suffix }).allTextContents();
        return rows.length === 2 ? rows[0] : null;
      })
      .toContain('Anta');

    await titleHeaderButton.click();
    await expect(page).not.toHaveURL(/[?&]direction=/);
    await expect(titleHeaderCell).toHaveAttribute('aria-sort', 'descending');
    await expect
      .poll(async () => {
        const rows = await page.locator('tbody tr', { hasText: suffix }).allTextContents();
        return rows.length === 2 ? rows[0] : null;
      })
      .toContain('Zebra');

    const toolbar = page.getByRole('search', { name: 'Filtros do registro de incidentes' });
    await toolbar.getByRole('button', { name: /^Filtros/ }).click();
    await toolbar.getByRole('button', { name: 'Status', exact: true }).click();
    const openStatusCheckbox = page.getByRole('group', { name: 'Status' }).getByLabel('Aberto');
    await openStatusCheckbox.click();
    await expect(openStatusCheckbox).toBeChecked();
    await expect(page).toHaveURL(/[?&]status=OPEN/);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: titleA })).toBeVisible();
    await expect(page.getByRole('link', { name: titleB })).toBeVisible();

    await toolbar.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page).not.toHaveURL(/[?&]status=/);
    await expect(page).not.toHaveURL(/[?&]search=/);
  });

  test('a search with no matches shows the "no results for these filters" state', async () => {
    await page.goto('/incidents');
    await expect(page.getByRole('heading', { name: 'Incidentes' })).toBeVisible();

    const suffix = Date.now().toString(36);
    await page.getByLabel('Buscar incidentes').fill(`inexistente-${suffix}`);

    await expect(page.getByText('Nenhum incidente encontrado')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Nenhum incidente registrado')).toHaveCount(0);
  });

  test('?section= deep link: a valid id lands directly on its group, an unknown one falls back silently to Visão geral', async () => {
    const suffix = Date.now().toString(36);
    const title = `Incidente E2E secao ${suffix}`;
    await createIncident(title);
    const incidentUrl = page.url();

    await page.goto(`${incidentUrl}?section=corrective-actions`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Resposta', selected: true })).toBeVisible();
    await expect(page.getByText('Nenhuma ação corretiva registrada ainda.')).toBeVisible();

    await page.goto(`${incidentUrl}?section=nao-existe`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Visão geral', selected: true })).toBeVisible();
    await expect(page.getByText('Detalhes do incidente')).toBeVisible();

    await page.goto(incidentUrl);
    await expect(page.getByRole('tab', { name: 'Visão geral', selected: true })).toBeVisible();
  });

  test('Editar opens an overlay Sheet; Escape closes it and returns focus to the Editar button; edits persist', async () => {
    const suffix = Date.now().toString(36);
    const title = `Incidente E2E overlay ${suffix}`;
    await createIncident(title);

    const editButton = page.getByRole('button', { name: 'Editar' });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Altere os dados cadastrais do incidente.')).toBeVisible();
    await expect(page.getByText('Ciclo de vida')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(editButton).toBeFocused();

    await editButton.click();
    const editedTitle = `${title} (editado)`;
    await dialog.getByLabel('Título').fill(editedTitle);
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();
  });
});
