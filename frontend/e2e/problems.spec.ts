import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
} from './support/admin-session';
import { SEEDED_ROOT_ORG_UNIT_NAME, selectSeededRootOrgUnit } from './support/org-units';
import { openProblemDetailSection } from './support/problem-detail-sections';

import type { Browser, BrowserContext, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

interface CreatedUser {
  readonly id: string;
}

async function fetchJson<T>(
  page: Page,
  path: string,
  init: { method: string; body?: unknown },
): Promise<{ status: number; body: T | null; text: string }> {
  const result = await page.evaluate(
    async ({ path: requestPath, method, body }) => {
      const response = await fetch(requestPath, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, text };
    },
    { path, method: init.method, body: init.body },
  );
  let parsed: T | null = null;
  try {
    parsed = result.text ? (JSON.parse(result.text) as T) : null;
  } catch {
    parsed = null;
  }
  return { status: result.status, body: parsed, text: result.text };
}

async function provisionUserWithRole(
  closerPage: Page,
  email: string,
  fullName: string,
  initialPassword: string,
  roleName: string,
): Promise<CreatedUser> {
  const rolesResult = await fetchJson<{ data: readonly { id: string; name: string }[] }>(
    closerPage,
    '/api/v1/admin/roles?page=1&pageSize=100',
    { method: 'GET' },
  );
  if (rolesResult.status !== 200 || !rolesResult.body) {
    throw new Error(`GET /admin/roles returned ${String(rolesResult.status)}: ${rolesResult.text}`);
  }
  const role = rolesResult.body.data.find((candidate) => candidate.name === roleName);
  if (!role) {
    throw new Error(`No "${roleName}" role found via GET /admin/roles.`);
  }

  const createResult = await fetchJson<{ id: string }>(closerPage, '/api/v1/admin/users', {
    method: 'POST',
    body: {
      email,
      fullName,
      initialPassword,
      roleIds: [role.id],
      scopeGrants: [{ scopeType: 'GLOBAL' }],
    },
  });
  if (createResult.status !== 201 || !createResult.body) {
    throw new Error(
      `POST /admin/users returned ${String(createResult.status)}: ${createResult.text}`,
    );
  }
  return createResult.body;
}

function isoDateDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test.describe('Problem: create -> register -> detail -> lifecycle -> links -> closure precondition (US2, US3)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real problem journey.',
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

  async function createProblem(title: string): Promise<string> {
    await page.goto('/problems/new');
    await expect(page.getByRole('heading', { name: 'Novo problema' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Problema criado pelo E2E (008-incidents-problems) para validar a jornada completa.');
    await page.getByRole('combobox', { name: 'Severidade' }).click();
    await page.getByRole('option', { name: 'Alta' }).click();
    await selectSeededRootOrgUnit(page);
    const orgUnitName = SEEDED_ROOT_ORG_UNIT_NAME;
    await page.getByRole('button', { name: 'Registrar problema' }).click();
    await page.waitForURL(/\/problems\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    return orgUnitName;
  }

  async function createIncidentFixture(title: string, orgUnitName: string): Promise<void> {
    await page.goto('/incidents/new');
    await expect(page.getByRole('heading', { name: 'Novo incidente' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Descrição').fill('Incidente criado pelo E2E de problemas (008).');
    await page.getByRole('combobox', { name: 'Severidade' }).click();
    await page.getByRole('option', { name: 'Alta' }).click();
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: orgUnitName, exact: true }).click();
    await page.getByRole('button', { name: 'Registrar incidente' }).click();
    await page.waitForURL(/\/incidents\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
  }

  test('create -> appears in register -> detail -> lifecycle -> link risk/incident -> close refused, then closed once the corrective action is completed by a different user', async () => {
    test.setTimeout(150_000);

    const suffix = Date.now().toString(36);
    const title = `Problema E2E ${suffix}`;
    const orgUnitName = await createProblem(title);
    const problemUrl = page.url();
    const problemId = problemUrl.split('/').pop()!;

    await page.goto('/problems');
    await expect(page.getByRole('heading', { name: 'Problemas' })).toBeVisible();
    await page.getByLabel('Buscar problemas').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]search=${suffix}`), { timeout: 5_000 });
    const rowLink = page.getByRole('link', { name: title });
    await expect(rowLink).toBeVisible({ timeout: 15_000 });
    await rowLink.click();
    await page.waitForURL(problemUrl);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await expect(page.getByText('Aberto', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar análise' }).click();
    const startDialog = page.getByRole('dialog');
    await expect(
      startDialog.getByRole('heading', { name: 'Iniciar análise deste problema?' }),
    ).toBeVisible();
    await startDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(startDialog).toBeHidden();
    await expect(page.getByText('Em análise', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Resolver' }).click();
    const resolveDialog = page.getByRole('dialog');
    await expect(
      resolveDialog.getByRole('heading', { name: 'Resolver este problema?' }),
    ).toBeVisible();
    const rootCause = `Causa raiz identificada pelo E2E ${suffix}.`;
    await resolveDialog.getByLabel('Causa raiz').fill(rootCause);
    await resolveDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(resolveDialog).toBeHidden();
    await expect(page.getByText('Resolvido', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(rootCause)).toBeVisible();

    const riskTitle = `Risco para problema E2E ${suffix}`;
    await page.goto('/risks/new');
    await page.getByLabel('Título').fill(riskTitle);
    await page.getByLabel('Descrição').fill('Risco criado pelo E2E de problemas (008).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: orgUnitName, exact: true }).click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    const incidentTitle = `Incidente para problema E2E ${suffix}`;
    await createIncidentFixture(incidentTitle, orgUnitName);

    await page.goto(problemUrl);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await openProblemDetailSection(page, 'risks');
    await page.getByRole('button', { name: 'Vincular risco' }).click();
    await page.getByRole('combobox', { name: 'Selecionar risco' }).click();
    await page.getByPlaceholder('Buscar risco por título ou código').fill(riskTitle);
    const riskOption = page.getByRole('option').filter({ hasText: riskTitle });
    await expect(riskOption).toBeVisible({ timeout: 10_000 });
    await riskOption.click();
    await page.getByRole('button', { name: 'Vincular risco' }).click();
    await expect(page.getByText('Risco vinculado.')).toBeVisible();

    await openProblemDetailSection(page, 'incidents');
    await page.getByRole('button', { name: 'Vincular incidente' }).click();
    await page.getByRole('combobox', { name: 'Selecionar incidente' }).click();
    await page.getByPlaceholder('Buscar incidente por código ou título').fill(incidentTitle);
    const incidentOption = page.getByRole('option').filter({ hasText: incidentTitle });
    await expect(incidentOption).toBeVisible({ timeout: 10_000 });
    await incidentOption.click();
    await page.getByRole('button', { name: 'Vincular incidente' }).click();
    await expect(page.getByText('Incidente vinculado.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await openProblemDetailSection(page, 'risks');
    await expect(page.getByText(riskTitle)).toBeVisible();
    await openProblemDetailSection(page, 'incidents');
    await expect(page.getByText(incidentTitle)).toBeVisible();
    await openProblemDetailSection(page, 'overview');

    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    const closeDialog = page.getByRole('dialog');
    await expect(closeDialog.getByRole('heading', { name: 'Fechar este problema?' })).toBeVisible();
    await expect(closeDialog.getByText('Ação corretiva concluída necessária')).toBeVisible({
      timeout: 10_000,
    });
    const confirmCloseButton = closeDialog.getByRole('button', { name: 'Fechar problema' });
    await expect(confirmCloseButton).toBeDisabled();
    await closeDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(closeDialog).toBeHidden();

    await page.reload();
    await expect(page.getByText('Resolvido', { exact: true }).first()).toBeVisible();

    const completerEmail = `e2e-problem-completer-${suffix}@pharosgrc.local`;
    const completerPassword = 'Pharos-E2E-Completer-1!';
    const completer = await provisionUserWithRole(
      page,
      completerEmail,
      `E2E Problem Completer ${suffix}`,
      completerPassword,
      'Problem Manager',
    );

    const actionTitle = `Ação corretiva E2E ${suffix}`;
    const createActionResult = await fetchJson<{ id: string }>(page, '/api/v1/actions', {
      method: 'POST',
      body: {
        originType: 'PROBLEM',
        originId: problemId,
        title: actionTitle,
        responsibleUserId: completer.id,
        dueOn: isoDateDaysFromNow(7),
      },
    });
    expect(createActionResult.status, createActionResult.text).toBe(201);

    const completerContext = await browserContext.browser()!.newContext();
    const completerPage = await completerContext.newPage();
    await signInAsFreshlyProvisionedUser(completerPage, completerEmail, completerPassword);

    await completerPage.goto('/actions');
    await expect(completerPage.getByRole('heading', { name: 'Planos de Ação' })).toBeVisible();
    await completerPage.getByRole('radio', { name: 'Ver as ações em tabela' }).click();
    const actionRow = completerPage.getByRole('row').filter({ hasText: actionTitle });
    await expect(actionRow).toBeVisible({ timeout: 15_000 });

    await actionRow.getByRole('button', { name: 'Ações' }).click();
    await completerPage.getByRole('menuitem', { name: 'Iniciar' }).click();
    await expect(actionRow.getByText('Em andamento', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await actionRow.getByRole('button', { name: 'Ações' }).click();
    await completerPage.getByRole('menuitem', { name: 'Concluir' }).click();
    await expect(actionRow.getByText('Concluída', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await completerContext.close();

    await page.goto(problemUrl);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    const secondCloseDialog = page.getByRole('dialog');
    await expect(secondCloseDialog.getByText('Ação corretiva concluída necessária')).toHaveCount(
      0,
      { timeout: 10_000 },
    );
    const secondConfirmCloseButton = secondCloseDialog.getByRole('button', {
      name: 'Fechar problema',
    });
    await expect(secondConfirmCloseButton).toBeEnabled();
    await secondConfirmCloseButton.click();
    await expect(secondCloseDialog).toBeHidden();
    await expect(page.getByText('Fechado', { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText('Fechado', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reabrir' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Fechar', exact: true })).toHaveCount(0);
  });

  test('register: search, sort by title (both directions) and status filter are reflected in the URL', async () => {
    const suffix = Date.now().toString(36);
    const titleA = `Zebra problema ${suffix}`;
    const titleB = `Anta problema ${suffix}`;
    await createProblem(titleA);
    await createProblem(titleB);

    await page.goto('/problems');
    await expect(page.getByRole('heading', { name: 'Problemas' })).toBeVisible();

    await page.getByLabel('Buscar problemas').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]search=${suffix}`), { timeout: 5_000 });
    await expect(page.getByRole('link', { name: titleA })).toBeVisible();
    await expect(page.getByRole('link', { name: titleB })).toBeVisible();

    await page.getByRole('radio', { name: 'Ver os problemas em tabela' }).click();
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

    const toolbar = page.getByRole('search', { name: 'Filtros de problemas' });
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
    await page.goto('/problems');
    await expect(page.getByRole('heading', { name: 'Problemas' })).toBeVisible();

    const suffix = Date.now().toString(36);
    await page.getByLabel('Buscar problemas').fill(`inexistente-${suffix}`);

    await expect(page.getByText('Nenhum problema encontrado')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Nenhum problema registrado')).toHaveCount(0);
  });

  test('?section= deep link: a valid id lands directly on its group, an unknown one falls back silently to Visão geral', async () => {
    const suffix = Date.now().toString(36);
    const title = `Problema E2E secao ${suffix}`;
    await createProblem(title);
    const problemUrl = page.url();

    await page.goto(`${problemUrl}?section=corrective-actions`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Resposta', selected: true })).toBeVisible();
    await expect(page.getByText('Nenhuma ação corretiva registrada ainda.')).toBeVisible();

    await page.goto(`${problemUrl}?section=nao-existe`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Visão geral', selected: true })).toBeVisible();
    await expect(page.getByText('Detalhes do problema')).toBeVisible();

    await page.goto(problemUrl);
    await expect(page.getByRole('tab', { name: 'Visão geral', selected: true })).toBeVisible();
  });

  test('Editar opens an overlay Sheet; Escape closes it and returns focus to the Editar button; edits persist', async () => {
    const suffix = Date.now().toString(36);
    const title = `Problema E2E overlay ${suffix}`;
    await createProblem(title);

    const editButton = page.getByRole('button', { name: 'Editar' });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Altere os dados cadastrais do problema.')).toBeVisible();
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
