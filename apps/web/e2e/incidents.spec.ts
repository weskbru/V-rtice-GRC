import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { openIncidentDetailSection } from './support/incident-detail-sections';
import { SEEDED_ROOT_ORG_UNIT_NAME, selectSeededRootOrgUnit } from './support/org-units';

import type { Browser, BrowserContext, Page } from '@playwright/test';

/**
 * 008-incidents-problems — E2E: the Incident journey through the real,
 * rendered UI. Phase 008 shipped a backend, a contract and the
 * register/create/detail screens, all committed, but no end-to-end journey
 * — every prior phase in this repository shipped one, so this closes that
 * gap for the Incident module. `problems.spec.ts` is this file's sibling
 * for the Problem module.
 *
 * Mirrors `risk-register.spec.ts`/`assets-processes.spec.ts` exactly:
 * `requireSeedCredentials` guard, one shared signed-in page across the
 * whole file (`mode: 'serial'`, one `signInAsWorkerAdmin` call in
 * `beforeAll`) rather than a fresh sign-in per test — this project's login
 * throttle makes repeated sign-ins in one file expensive for no reason, and
 * `support/admin-session.ts`'s own header explains why.
 *
 * ## Cards is the primary view; the sort-header assertions still need the table
 *
 * This register joined the shared exploration frame (CLAUDE.md §18.12):
 * `IncidentCatalogView` now opens on Cards, like every other register in
 * this product, with a Cards/Tabela `ViewToggle` — no quick-view panel
 * either way (`IncidentCard`'s own header comment). A stretched-link card's
 * accessible name still contains the incident's title (`card.selectLabel`),
 * so the plain "appears in the register" assertions below work unchanged in
 * Cards view. The one test that clicks a sortable COLUMN HEADER and reads
 * `aria-sort`/`tbody` row order needs the actual table, so it calls
 * `switchToTableView()` first — mirroring `risk-register.spec.ts`'s own
 * helper of the same name. The URL's search parameter is `search`, not `q`
 * (`GET /incidents`'s own contract), and the default sort is `reportedOn`
 * descending — since two incidents created moments apart can tie on that
 * field (same calendar day), this spec asserts row order only AFTER an
 * explicit sort-by-title click, never relying on the untested default
 * tie-break order the way `risk-register.spec.ts` safely can with `code`
 * ascending.
 */
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

  /**
   * Same reasoning as `assets-processes.spec.ts`'s own header (Front H,
   * D-17): the picker is `SearchablePicker`, server-side search as the user
   * types — this types the exact, already-unique fixture title into the
   * picker's own search box rather than assuming it lands on whatever
   * unsearched first page the picker would otherwise show.
   *
   * 018-incident-detail-experience Fase 5 gated the picker behind an intent
   * button (`gateLinkBehindAction`) sharing the EXACT same accessible name
   * as the real submit button that replaces it once clicked
   * (`messages.pickerLabel`, e.g. "Vincular risco" — the trigger's own
   * visible text, and the submit button's `aria-label`). The two are never
   * on screen at the same time, so clicking the same role+name twice — once
   * to reveal the picker, once to submit — is unambiguous.
   */
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

    // --- Appears in the register (US1) --------------------------------------
    await page.goto('/incidents');
    await expect(page.getByRole('heading', { name: 'Incidentes' })).toBeVisible();
    await page.getByLabel('Buscar incidentes').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]search=${suffix}`), { timeout: 5_000 });
    const rowLink = page.getByRole('link', { name: title });
    await expect(rowLink).toBeVisible({ timeout: 15_000 });
    await rowLink.click();
    await page.waitForURL(incidentUrl);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // --- Lifecycle: OPEN -> IN_PROGRESS (immediate, no dialog) --------------
    await expect(page.getByText('Aberto', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar atendimento' }).click();
    await expect(page.getByText('Em andamento', { exact: true }).first()).toBeVisible();

    // --- IN_PROGRESS -> RESOLVED (requires "Resumo da resolução") -----------
    await page.getByRole('button', { name: 'Resolver' }).click();
    const resolveDialog = page.getByRole('dialog');
    await expect(
      resolveDialog.getByRole('heading', { name: 'Resolver este incidente?' }),
    ).toBeVisible();
    const resolutionSummary = `Resolvido pelo E2E ${suffix}.`;
    await resolveDialog.getByLabel('Resumo da resolução').fill(resolutionSummary);
    // Scoped to the dialog: the page behind it still has its own "Resolver"
    // trigger button, and both share the exact same accessible name here
    // (`IncidentTransitionDialog`'s confirm button renders `{option.label}`).
    await resolveDialog.getByRole('button', { name: 'Resolver' }).click();
    await expect(resolveDialog).toBeHidden();
    await expect(page.getByText('Resolvido', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(resolutionSummary)).toBeVisible();

    // --- Link to a risk, an asset and a process (US3) -----------------------
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

    // --- RESOLVED -> CLOSED (no required field) -----------------------------
    await openIncidentDetailSection(page, 'overview');
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    const closeDialog = page.getByRole('dialog');
    await expect(
      closeDialog.getByRole('heading', { name: 'Fechar este incidente?' }),
    ).toBeVisible();
    // `IncidentTransitionDialog`'s confirm button for THIS transition renders
    // the literal word "Fechar" — the exact same accessible name as the
    // dialog's own native "X" dismiss button (`common.dialog.closeLabel`).
    // `DialogContent` (`components/ui/dialog.tsx`) renders `{children}`
    // (header/body/footer) BEFORE the native close button, so the footer's
    // confirm button is always first in DOM/accessibility-tree order —
    // `.first()` is the confirm action, never the dismiss "X".
    await closeDialog.getByRole('button', { name: 'Fechar', exact: true }).first().click();
    await expect(closeDialog).toBeHidden();
    await expect(page.getByText('Fechado', { exact: true }).first()).toBeVisible();

    // A terminal status offers no further lifecycle actions at all — the
    // component renders nothing (`IncidentLifecycleActions`'s own header),
    // not a disabled button.
    await expect(page.getByRole('button', { name: 'Reabrir' })).toHaveCount(0);

    // --- Links survive a reload (and so does the closed status — this is
    //     the persisted server state, not merely client state) --------------
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
    // The header-click / aria-sort / tbody-order assertions below need the
    // actual table — see this file's own header comment.
    await switchToTableView();

    // --- Search --------------------------------------------------------------
    await page.getByLabel('Buscar incidentes').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]search=${suffix}`), { timeout: 5_000 });
    await expect(page.getByRole('link', { name: titleA })).toBeVisible();
    await expect(page.getByRole('link', { name: titleB })).toBeVisible();

    // --- Sort by title, ascending --------------------------------------------
    // `use-incident-register-state.ts`'s own default is `reportedOn` DESC
    // (unlike the risk register's `code` ASC) — so sorting by `title`
    // ascending is the axis that's non-default on BOTH fields, and is the
    // step that writes an explicit `direction=asc` (`setSort` never writes a
    // param that already matches its own default).
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

    // --- Toggle to descending -------------------------------------------------
    // `desc` IS this register's default direction, so `setSort` DELETES the
    // `direction` param here rather than writing a redundant `direction=desc`
    // — `state.direction` still resolves to `desc` on read
    // (`use-incident-register-state.ts`'s own fallback), so the sort is
    // real even though the param is absent; asserted below via `aria-sort`
    // and the actual row order, not a URL string that would never appear.
    await titleHeaderButton.click();
    await expect(page).not.toHaveURL(/[?&]direction=/);
    await expect(titleHeaderCell).toHaveAttribute('aria-sort', 'descending');
    await expect
      .poll(async () => {
        const rows = await page.locator('tbody tr', { hasText: suffix }).allTextContents();
        return rows.length === 2 ? rows[0] : null;
      })
      .toContain('Zebra');

    // --- Status filter, reflected in the URL ---------------------------------
    // Scoped to the toolbar's own `role="search"` landmark
    // (`FilterBar`'s `label` prop) because the register's "no results" empty
    // state can render a button with the exact SAME text ("Limpar filtros")
    // as this toolbar's own clear action — unlike `risk-register.spec.ts`'s
    // deliberately different wording, this module's two strings coincide.
    const toolbar = page.getByRole('search', { name: 'Filtros do registro de incidentes' });
    // The filter controls (Status, Severidade, Unidade) live behind the
    // "Filtros" disclosure now that this toolbar is collapsible (CLAUDE.md
    // §18.12) — the search box above stays visible either way, which is why
    // the search assertions above needed no change. Anchored `/^Filtros/`,
    // not a loose `{ name: 'Filtros' }`: Playwright's default string match
    // is a case-insensitive substring, and this same `role="search"` region
    // also renders a "Limpar filtros" button below — "filtros" is a
    // substring of that too, so an unanchored match is ambiguous between
    // the two and throws a strict-mode violation. The toggle's own
    // accessible name also carries its active-filter-count badge ("Filtros
    // 1") once a filter is applied, which `/^Filtros/` still matches.
    await toolbar.getByRole('button', { name: /^Filtros/ }).click();
    await toolbar.getByRole('button', { name: 'Status', exact: true }).click();
    // `.click()`, not `.check()`: this checkbox's `onChange` commits a
    // `router.replace` (a real client-side navigation, unlike
    // `risk-history.spec.ts`'s own local-only history-type filter) —
    // `.check()`'s own built-in post-action verification was observed
    // racing that navigation and reporting "did not change its state" even
    // though the checkbox WAS checked and the filter WAS applied
    // immediately after (confirmed via the page snapshot on that failure).
    // The `expect(...).toBeChecked()` below is the retrying assertion that
    // actually waits out the render, rather than the stricter one-shot
    // check baked into `.check()`.
    const openStatusCheckbox = page.getByRole('group', { name: 'Status' }).getByLabel('Aberto');
    await openStatusCheckbox.click();
    await expect(openStatusCheckbox).toBeChecked();
    await expect(page).toHaveURL(/[?&]status=OPEN/);
    // Close the disclosure panel (Escape — `use-disclosure-close.ts`) before
    // reaching for the toolbar's "Limpar filtros" below, which the panel
    // renders on top of while open.
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

  /**
   * 018-incident-detail-experience, Fase 6 — `?section=` deep-link
   * resolution: nothing proved this end to end before this phase (only
   * `incident-detail-view.test.tsx`'s own jsdom coverage did).
   */
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

  /**
   * 018-incident-detail-experience, Fase 4 — editing moved from an inline
   * swap of "Visão geral" to an overlay `Sheet`. Nothing proved the overlay
   * itself, its `Escape` dismissal with focus return, or that an edit still
   * persists through it, end to end.
   */
  test('Editar opens an overlay Sheet; Escape closes it and returns focus to the Editar button; edits persist', async () => {
    const suffix = Date.now().toString(36);
    const title = `Incidente E2E overlay ${suffix}`;
    await createIncident(title);

    const editButton = page.getByRole('button', { name: 'Editar' });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    // `IncidentEditPanel` carries TWO elements named "Editar incidente" —
    // the sr-only `SheetTitle` (D-15, so the Sheet itself is named for
    // assistive tech) and `DetailPanel`'s own visible header `<h2>` — so
    // this asserts the panel's own description instead of the ambiguous
    // heading name.
    await expect(dialog.getByText('Altere os dados cadastrais do incidente.')).toBeVisible();
    // The page behind the overlay stays readable — the old inline swap used
    // to replace this exact content with the form.
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
