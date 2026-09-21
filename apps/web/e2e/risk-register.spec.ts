import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';

import type { Browser, BrowserContext, Page } from '@playwright/test';

/**
 * T103 — E2E: filter, search, sort, paginate the risk register, and verify
 * that navigating to a risk and back preserves the register's state
 * (US3, FR-086 to FR-092).
 *
 * Runs against a real backend (`apps/api`), seeded per
 * `apps/api/prisma/seed/platform.seed.ts`, exactly like `auth.spec.ts` and
 * `risk-create.spec.ts` — see `support/admin-session.ts` for the shared
 * sign-in helper. Skips itself with a clear reason when
 * `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are not set.
 *
 * Every test below shares ONE signed-in page, created once in
 * `beforeAll` (`mode: 'serial'`) rather than each test calling
 * `signInAsWorkerAdmin` independently: that helper's first attempt is
 * expected to fail once this worker's pool account's password has already
 * been rotated by an earlier spec on the same worker (its own doc comment),
 * and this project's login throttle is "5 wrong attempts locks the account
 * for 15 minutes" (CLAUDE.md) — three independent sign-ins would burn three
 * of those five attempts on nothing but re-authenticating the same account
 * this whole file only needs once.
 *
 * Each test creates its own uniquely-titled fixture risk(s) rather than
 * depending on whatever else happens to already be in the register (which,
 * on a long-lived development database, can be an arbitrary and growing
 * number of rows) — the search box narrows every assertion down to exactly
 * the rows this spec itself created, so the test stays correct regardless
 * of how many other risks exist or how many pages that spans.
 *
 * ## Accessible-name collision note (see CLAUDE.md's warning)
 *
 * The register's sortable column headers ("Código", "Título", ...) are
 * `<button>` elements, and `RiskRegisterFilters` also renders filter
 * controls whose own visible text can overlap column names (e.g. the
 * risk-level column reads "Nível de risco (residual)" while the risk-level
 * *filter* button reads "Nível de risco" alone) — the two are deliberately
 * differently worded so `getByRole('button', { name: ... })` does not need
 * `exact: true` to disambiguate them; this spec calls out each such name
 * inline where it matters.
 */
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

  /**
   * Asserts the two fixture rows appear in the given order. Polls rather
   * than reading `allTextContents()` once: a sort/filter change first
   * re-renders the table body as `DataTable`'s loading placeholder before
   * the new page of rows arrives (by design — see `data-table.tsx`'s doc
   * comment, "a user can re-sort while a page is still loading"), so a
   * single synchronous read can race that placeholder and see zero
   * matching rows.
   */
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

  /**
   * The register opens in the CARD view (CLAUDE.md §18 — cards are the
   * primary view; the table remains for dense comparison). Sortable column
   * headers, `<tbody>` rows and `aria-sort` therefore only exist after
   * switching, so every assertion in this file that is *about the table*
   * switches to it first and says so.
   *
   * This is not a test weakened to accommodate a change: the table's own
   * behaviour is still asserted in full, on the table. What changed is that
   * the screen no longer opens on it.
   */
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
    const titleA = `Zebra corporativa ${suffix}`; // sorts after titleB
    const titleB = `Anta corporativa ${suffix}`; // sorts before titleA

    // titleA is created first, so by code (the register's default sort) its
    // row sits ABOVE titleB's — the opposite of alphabetical order. This is
    // what makes the sort-by-title assertions below meaningful rather than
    // coincidental.
    await createRisk(titleA);
    await createRisk(titleB);

    await page.goto('/risks');
    await expect(page.getByRole('heading', { name: 'Registro de riscos' })).toBeVisible();
    await switchToTableView();

    // --- Search (FR-089) ----------------------------------------------------
    await page.getByLabel('Buscar por código, título ou descrição').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${suffix}`), { timeout: 5_000 });

    await expect(page.getByRole('link', { name: titleA })).toBeVisible();
    await expect(page.getByRole('link', { name: titleB })).toBeVisible();

    // Default sort is by code ascending — titleA (created first, lower
    // code) renders above titleB.
    await expectRowOrder(suffix, 'Zebra');

    // --- Sort by title, ascending (FR-087) -----------------------------------
    const titleHeaderButton = page.getByRole('button', { name: 'Título', exact: false });
    await titleHeaderButton.click();
    await expect(page).toHaveURL(/[?&]sort=title/);
    const titleHeaderCell = page.getByRole('columnheader', { name: /^Título/ });
    await expect(titleHeaderCell).toHaveAttribute('aria-sort', 'ascending');
    await expectRowOrder(suffix, 'Anta');

    // --- Toggle to descending -------------------------------------------------
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

    // Two "clear filters" controls exist on this state at once — the
    // always-present toolbar action ("Limpar filtros") and this empty
    // state's own contextual action ("Limpar todos os filtros", worded
    // differently on purpose so the two never collide by accessible name,
    // see risks.ts's doc comment). This asserts the empty state's own one.
    await page.getByRole('button', { name: 'Limpar todos os filtros' }).click();
    await expect(page.getByLabel('Buscar por código, título ou descrição')).toHaveValue('');
    await expect(page.getByText('Nenhum risco encontrado para os filtros aplicados')).toHaveCount(
      0,
    );
  });

  /**
   * The filters rest behind a disclosure button, and the state they produce
   * rests in the chip row, which stays visible when the panel closes. The
   * point of the test is that closing the panel hides the CONTROLS and
   * nothing else: the filter is still applied, still named on screen, still
   * in the URL, and still removable — one field at a time.
   */
  test('the filter panel collapses without hiding which filters are applied', async () => {
    await page.goto('/risks');
    await expect(page.getByRole('heading', { name: 'Registro de riscos' })).toBeVisible();

    const toggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Collapsed: the status filter is not merely invisible, it is not rendered.
    await expect(page.getByRole('button', { name: 'Status', exact: true })).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Status', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Identificado' }).click();
    await expect(page).toHaveURL(/[?&]status=IDENTIFIED/);

    // Close the panel: the control goes, the applied filter stays — named,
    // counted on the button, and in the URL.
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Status', exact: true })).toHaveCount(0);
    await expect(toggle).toHaveAccessibleName(/1/);
    const chip = page.getByRole('button', { name: /^Remover filtro: Status/ });
    await expect(chip).toBeVisible();
    await expect(page).toHaveURL(/[?&]status=IDENTIFIED/);

    // And the chip drops that one field on its own.
    await chip.click();
    await expect(page).not.toHaveURL(/[?&]status=/);
  });

  /**
   * The residual/inherent basis decides how each risk's level is LABELLED,
   * never which risks match — so it lives with the ordering and the view
   * toggle, and "Limpar filtros" must leave it alone. It used to be counted
   * as a filter, which made clearing filters silently switch the column the
   * user was reading.
   */
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

    // The Back button — not a fresh navigation to /risks — is the actual
    // requirement (FR-092: "when the user navigates to a risk and returns").
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

    // Cards, not the table — and no `view` parameter, because cards is the
    // default and defaults are never written to the URL.
    await expect(page).not.toHaveURL(/[?&]view=/);
    await expect(page.getByRole('table', { name: 'Registro de riscos' })).toHaveCount(0);

    // Two independent links to the SAME record — no intermediate quick-view
    // step exists any more. Both must be reachable by accessible name, not
    // by position.
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

    // Order by title descending through the card view's own sort control —
    // the only ordering surface the card view has.
    await page.getByRole('combobox', { name: 'Ordenar por' }).click();
    await page.getByRole('option', { name: 'Título (A–Z)' }).click();
    await expect(page).toHaveURL(/[?&]sort=title/);

    await switchToTableView();

    // The whole point: the query the table now shows is the query the cards
    // were showing. Nothing was reset, re-applied or lost in the switch.
    await expect(page).toHaveURL(new RegExp(`[?&]q=${suffix}`));
    await expect(page).toHaveURL(/[?&]sort=title/);
    await expect(page.getByLabel('Buscar por código, título ou descrição')).toHaveValue(suffix);
    await expect(page.getByRole('columnheader', { name: /^Título/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    // ...and back again.
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

    // Direct navigation to the full record — the correct risk, not merely a
    // risk.
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // The quick view never existed in this flow: no complementary region, no
    // "Detalhes rápidos" panel, ever.
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
