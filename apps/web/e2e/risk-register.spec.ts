import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';

import type { Browser, BrowserContext, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Filter, search, sort and paginate the risk register (US3)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real register journey.',
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

  async function expectRowOrder(suffix: string, expectedFirst: string): Promise<void> {
    await expect
      .poll(
        async () => {
          const rows = await page.locator('tbody tr', { hasText: suffix }).allTextContents();
          return rows.length === 2 ? rows[0] : null;
        },
        { timeout: 10_000 },
      )
      .toContain(expectedFirst);
  }

  async function switchToTableView(): Promise<void> {
    await page.getByRole('radio', { name: 'Ver os riscos em tabela' }).click();
    await expect(page).toHaveURL(/[?&]view=table/);
    await expect(page.getByRole('table', { name: 'Registro de riscos' })).toBeVisible({
      timeout: 15_000,
    });
  }

  async function createRisk(title: string): Promise<void> {
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência criado pelo E2E do registro (T103).');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }

  test('search narrows results and sort reorders them by title, both reflected in the URL', async () => {
    const suffix = Date.now().toString(36);
    const titleA = `Zebra corporativa ${suffix}`;
    const titleB = `Anta corporativa ${suffix}`;

    await createRisk(titleA);
    await createRisk(titleB);

    await page.goto('/risks');
    await expect(page.getByRole('heading', { name: 'Registro de riscos' })).toBeVisible();
    await switchToTableView();

    await page.getByLabel('Buscar por código, título ou descrição').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${suffix}`), { timeout: 5_000 });

    await expect(page.getByRole('link', { name: titleA })).toBeVisible();
    await expect(page.getByRole('link', { name: titleB })).toBeVisible();

    await expectRowOrder(suffix, 'Zebra');

    const titleHeaderButton = page.getByRole('button', { name: 'Título', exact: false });
    await titleHeaderButton.click();
    await expect(page).toHaveURL(/[?&]sort=title/);
    const titleHeaderCell = page.getByRole('columnheader', { name: /^Título/ });
    await expect(titleHeaderCell).toHaveAttribute('aria-sort', 'ascending');
    await expectRowOrder(suffix, 'Anta');

    await titleHeaderButton.click();
    await expect(page).toHaveURL(/[?&]direction=desc/);
    await expect(titleHeaderCell).toHaveAttribute('aria-sort', 'descending');
    await expectRowOrder(suffix, 'Zebra');
  });

  test('a search with no matches shows the "no results for these filters" state, distinct from "no risks yet"', async () => {
    await page.goto('/risks');
    await expect(page.getByRole('heading', { name: 'Registro de riscos' })).toBeVisible();

    const suffix = Date.now().toString(36);
    await page.getByLabel('Buscar por código, título ou descrição').fill(`inexistente-${suffix}`);

    await expect(page.getByText('Nenhum risco encontrado para os filtros aplicados')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText('Nenhum risco cadastrado ainda')).toHaveCount(0);

    await page.getByRole('button', { name: 'Limpar todos os filtros' }).click();
    await expect(page.getByLabel('Buscar por código, título ou descrição')).toHaveValue('');
    await expect(page.getByText('Nenhum risco encontrado para os filtros aplicados')).toHaveCount(
      0,
    );
  });

  test('the filter panel collapses without hiding which filters are applied', async () => {
    await page.goto('/risks');
    await expect(page.getByRole('heading', { name: 'Registro de riscos' })).toBeVisible();

    const toggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Status', exact: true })).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Status', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Identificado' }).click();
    await expect(page).toHaveURL(/[?&]status=IDENTIFIED/);

    await toggle.click();
    await expect(page.getByRole('button', { name: 'Status', exact: true })).toHaveCount(0);
    await expect(toggle).toHaveAccessibleName(/1/);
    const chip = page.getByRole('button', { name: /^Remover filtro: Status/ });
    await expect(chip).toBeVisible();
    await expect(page).toHaveURL(/[?&]status=IDENTIFIED/);

    await chip.click();
    await expect(page).not.toHaveURL(/[?&]status=/);
  });

  test('the risk-level basis is a display choice, untouched by clearing filters', async () => {
    await page.goto('/risks?riskLevelBasis=INHERENT&status=IDENTIFIED');
    await expect(page.getByRole('heading', { name: 'Registro de riscos' })).toBeVisible();

    const basis = page.getByRole('combobox', { name: 'Base do nível exibido' });
    await expect(basis).toHaveText('Inerente');

    await page.getByRole('button', { name: 'Limpar filtros' }).click();

    await expect(page).not.toHaveURL(/[?&]status=/);
    await expect(page).toHaveURL(/[?&]riskLevelBasis=INHERENT/);
    await expect(basis).toHaveText('Inerente');
  });

  test("navigating to a risk and back preserves the register's search and sort (FR-092)", async () => {
    const suffix = Date.now().toString(36);
    const title = `Risco de rastreabilidade de estado ${suffix}`;
    await createRisk(title);

    await page.goto('/risks');
    await switchToTableView();
    await page.getByLabel('Buscar por código, título ou descrição').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${suffix}`), { timeout: 5_000 });

    await page.getByRole('button', { name: 'Título', exact: false }).click();
    await expect(page).toHaveURL(/[?&]sort=title/);

    const registerUrl = page.url();
    const rowLink = page.getByRole('link', { name: title });
    await expect(rowLink).toBeVisible();
    await rowLink.click();

    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(registerUrl);
    await expect(page.getByLabel('Buscar por código, título ou descrição')).toHaveValue(suffix);
    await expect(page.getByRole('link', { name: title })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^Título/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  test('opens in the card view, where both the code and the title link straight to the record', async () => {
    const suffix = Date.now().toString(36);
    const title = `Risco em cartão ${suffix}`;
    await createRisk(title);

    await page.goto('/risks');
    await page.getByLabel('Buscar por código, título ou descrição').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${suffix}`), { timeout: 5_000 });

    await expect(page).not.toHaveURL(/[?&]view=/);
    await expect(page.getByRole('table', { name: 'Registro de riscos' })).toHaveCount(0);

    const codeLink = page.getByRole('link', { name: /^RSK-/ }).first();
    await expect(codeLink).toBeVisible();
    await expect(codeLink).toHaveAttribute('href', /\/risks\/[0-9a-fA-F-]+$/);

    const titleLink = page.getByRole('link', { name: new RegExp(`^Abrir o risco.*${title}$`) });
    await expect(titleLink).toBeVisible();
    await expect(titleLink).toHaveAttribute('href', /\/risks\/[0-9a-fA-F-]+$/);
  });

  test('switching Cards <-> Tabela keeps the search, the ordering and the page position', async () => {
    const suffix = Date.now().toString(36);
    await createRisk(`Alfa comutação ${suffix}`);
    await createRisk(`Beta comutação ${suffix}`);

    await page.goto('/risks');
    await page.getByLabel('Buscar por código, título ou descrição').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${suffix}`), { timeout: 5_000 });

    await page.getByRole('combobox', { name: 'Ordenar por' }).click();
    await page.getByRole('option', { name: 'Título (A–Z)' }).click();
    await expect(page).toHaveURL(/[?&]sort=title/);

    await switchToTableView();

    await expect(page).toHaveURL(new RegExp(`[?&]q=${suffix}`));
    await expect(page).toHaveURL(/[?&]sort=title/);
    await expect(page.getByLabel('Buscar por código, título ou descrição')).toHaveValue(suffix);
    await expect(page.getByRole('columnheader', { name: /^Título/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await page.getByRole('radio', { name: 'Ver os riscos em cards' }).click();
    await expect(page).not.toHaveURL(/[?&]view=table/);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${suffix}`));
    await expect(page).toHaveURL(/[?&]sort=title/);
    await expect(page.getByRole('table', { name: 'Registro de riscos' })).toHaveCount(0);
  });

  test('clicking a card opens the correct risk directly — no intermediate quick view', async () => {
    const suffix = Date.now().toString(36);
    const title = `Risco de consulta rápida ${suffix}`;
    await createRisk(title);

    await page.goto('/risks');
    await page.getByLabel('Buscar por código, título ou descrição').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${suffix}`), { timeout: 5_000 });

    const titleLink = page.getByRole('link', { name: new RegExp(`^Abrir o risco.*${title}$`) });
    await expect(titleLink).toBeVisible();
    await titleLink.click();

    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await expect(
      page.getByRole('complementary', { name: 'Detalhes rápidos do risco' }),
    ).toHaveCount(0);
  });

  test('a card opens its risk by keyboard alone (Tab to the title link, Enter)', async () => {
    const suffix = Date.now().toString(36);
    const title = `Risco de navegação por teclado ${suffix}`;
    await createRisk(title);

    await page.goto('/risks');
    await page.getByLabel('Buscar por código, título ou descrição').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${suffix}`), { timeout: 5_000 });

    const titleLink = page.getByRole('link', { name: new RegExp(`^Abrir o risco.*${title}$`) });
    await expect(titleLink).toBeVisible();
    await titleLink.focus();
    await expect(titleLink).toBeFocused();

    await page.keyboard.press('Enter');

    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  });
});
