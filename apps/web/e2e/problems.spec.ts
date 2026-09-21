import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
} from './support/admin-session';
import { SEEDED_ROOT_ORG_UNIT_NAME, selectSeededRootOrgUnit } from './support/org-units';
import { openProblemDetailSection } from './support/problem-detail-sections';

import type { Browser, BrowserContext, Page } from '@playwright/test';

/**
 * 008-incidents-problems — E2E: the Problem journey through the real,
 * rendered UI. `incidents.spec.ts` is this file's sibling for the Incident
 * module — see that file's own header for the reasoning shared between
 * both (`search` URL parameter, no default-order assumption). The register
 * was brought into the shared Cards/Tabela register family after this
 * spec's own foundation was written (CLAUDE.md §18.12) — it now opens on
 * Cards by default, with a collapsible "Filtros" panel; tests below that
 * need column headers or table rows switch to Tabela explicitly first.
 *
 * ## Closing a problem — data-model.md §4, Invariant P2/P3
 *
 * `status` may only become `CLOSED` when at least one `COMPLETED` `Action`
 * with `originType: PROBLEM`/`originId: <this problem>` exists (P2), AND
 * the user who closes it is a DIFFERENT user from whoever completed that
 * action (P3, segregation of duties — the same rule `Finding` already
 * applies). `problem-close-dialog.tsx`'s own header explains why this
 * dialog pre-checks only P2 (a single, cheap `GET /actions?...` read) and
 * leaves P3 to the server's own `403`: there is no reliable client-side
 * signal for "who completed it" before attempting.
 *
 * There is no UI anywhere in this codebase yet to CREATE a corrective
 * Action from the Problem screen — `features/problems/*` has no
 * `treatment-actions-table.tsx`/`finding-remediation-action.tsx` sibling,
 * and `CreateActionRequest`'s own doc comment (`features/actions/types.ts`)
 * says creation "happens contextually, from the domain screen it arises
 * from" (R-009) — a real gap this spec reports rather than works around
 * silently. The fixture Action's CREATION below therefore goes through a
 * same-origin `fetch()` from the already-authenticated closer's own page
 * (mirroring `support/admin-session.ts`'s own `fetchFromPage`, which is not
 * exported) rather than an invented UI path — this is fixture setup, not
 * the behaviour under test. Its COMPLETION, however, goes through the very
 * real "Minhas ações" screen (`/actions`), signed in as a second,
 * independently-provisioned Platform-Administrator-equivalent account —
 * that IS a genuine UI journey, and it is what makes the eventual close
 * attempt a genuine test of P3, not just P2: two different real accounts,
 * a real sign-in for each, a real transition click for the completion, and
 * a real close click for the closer.
 *
 * A second provisioned admin, not `FIXTURE_USER_EMAIL`, for the same
 * reason `risk-approval.spec.ts`'s header gives: the seeded fixture users
 * round-robin across SIBLING organizational units with disjoint scope, so
 * the fixture "Risk Approver" might not even see this problem's own org
 * unit. A second GLOBAL-scope admin sidesteps that scope mismatch entirely
 * and is a genuinely different user id from the closer either way.
 *
 * ## 019-problem-detail-experience (Fase E) updates
 *
 * The detail screen this spec drives was redesigned across Fases A-D:
 * two-level navigation (`openProblemDetailSection`, mirroring
 * `incident-detail-sections.ts`) replaces the old flat `role="tab"` strip;
 * the Riscos/Incidentes picker sits behind an intent button
 * (`gateLinkBehindAction`, Fase D) sharing the exact same accessible name
 * as the submit button it is replaced by — one extra click to reveal it,
 * never a second name to remember; and editing moved from an inline swap
 * of "Visão geral" to an overlay `Sheet` (Fase C), covered by its own new
 * test below. The terminal-status sentence this spec used to assert
 * ("Nenhuma transição disponível para o status atual.") was retired in
 * Fase B — the Ciclo de vida TRACK now shows the terminal position
 * directly, so the assertion below checks for the ABSENCE of any further
 * transition button instead of a sentence that no longer renders.
 */
test.describe.configure({ mode: 'serial' });

interface CreatedUser {
  readonly id: string;
}

/**
 * Same-origin `fetch()` from INSIDE the page's own JS context — required by
 * this product's single-origin CSRF check (ADR-002/ADR-014), exactly as
 * `support/admin-session.ts`'s own `fetchFromPage` documents (not exported
 * from that module, hence this local copy — a small, well-understood
 * utility, not worth a cross-file dependency for one spec).
 */
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

/**
 * Provisions a brand-new, GLOBAL-scope account holding ONE named role,
 * through the real administration API — called from the CLOSER's own
 * already-authenticated page (a Platform Administrator itself, per
 * `signInAsWorkerAdmin`), mirroring
 * `support/admin-session.ts#ensureWorkerAdminProvisioned`'s own technique,
 * simplified: this account is used exactly once per test run (a fresh,
 * globally-unique email), so no "already exists" branch is needed.
 *
 * `roleName` (F-70, `docs/deferred-findings.md`, "mitigação de baixo
 * custo"): this used to hard-code `Platform Administrator` regardless of
 * what the caller actually needed the account to DO — the disposable
 * completer account below only ever views `/actions` and transitions one
 * action it owns, never anything `role:administer`/`user:administer`/
 * `org_unit:administer` gates, yet it was provisioned with the platform's
 * single most privileged role and left in the database permanently (no
 * `DELETE /admin/users/{id}` exists, by design — CLAUDE.md §8/§18.9 forbid
 * destroying the audit trail a deletion would require). GLOBAL scope stays
 * unconditional: the seed's own `globalScope: false` on non-administrative
 * roles is metadata for how the SEED provisions default holders at
 * bootstrap, not a runtime constraint `POST /admin/users` enforces on an
 * arbitrary `scopeGrants` payload (confirmed: no reference to it anywhere
 * under `core/authorization`/`core/identity`) — and GLOBAL keeps this
 * helper correct regardless of which org unit a future caller's fixture
 * data happens to live under, without needing to thread that unit id
 * through.
 */
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

    // --- Appears in the register (US2) --------------------------------------
    await page.goto('/problems');
    await expect(page.getByRole('heading', { name: 'Problemas' })).toBeVisible();
    await page.getByLabel('Buscar problemas').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]search=${suffix}`), { timeout: 5_000 });
    // Cards is this register's default view now (CLAUDE.md §18.12) — the
    // card's own title is a link to the record, exactly like the table's own
    // code/title columns were.
    const rowLink = page.getByRole('link', { name: title });
    await expect(rowLink).toBeVisible({ timeout: 15_000 });
    await rowLink.click();
    await page.waitForURL(problemUrl);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // --- Lifecycle: OPEN -> IN_ANALYSIS (no required field) -----------------
    await expect(page.getByText('Aberto', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar análise' }).click();
    const startDialog = page.getByRole('dialog');
    await expect(
      startDialog.getByRole('heading', { name: 'Iniciar análise deste problema?' }),
    ).toBeVisible();
    await startDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(startDialog).toBeHidden();
    await expect(page.getByText('Em análise', { exact: true }).first()).toBeVisible();

    // --- IN_ANALYSIS -> RESOLVED (requires "Causa raiz") --------------------
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

    // --- Link to a risk and to an incident (US3) ----------------------------
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

    // Fase D gates the picker behind an intent button sharing the exact
    // accessible name of the real submit button it is replaced by — one
    // extra click to reveal it, before the same click submits.
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

    // Links survive a reload.
    await page.reload();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await openProblemDetailSection(page, 'risks');
    await expect(page.getByText(riskTitle)).toBeVisible();
    await openProblemDetailSection(page, 'incidents');
    await expect(page.getByText(incidentTitle)).toBeVisible();
    await openProblemDetailSection(page, 'overview');

    // --- Close attempt #1: correctly refused (P2 — no completed corrective
    //     action exists yet) ---------------------------------------------------
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    const closeDialog = page.getByRole('dialog');
    await expect(closeDialog.getByRole('heading', { name: 'Fechar este problema?' })).toBeVisible();
    await expect(closeDialog.getByText('Ação corretiva concluída necessária')).toBeVisible({
      timeout: 10_000,
    });
    // `ProblemCloseDialog`'s confirm button carries its OWN distinct
    // `aria-label` ("Fechar problema") specifically to disambiguate it from
    // the dialog's native "X" dismiss button, which shares the visible word
    // "Fechar" — no `.first()`/DOM-order reasoning needed here, unlike the
    // Incident close dialog in `incidents.spec.ts`.
    const confirmCloseButton = closeDialog.getByRole('button', { name: 'Fechar problema' });
    await expect(confirmCloseButton).toBeDisabled();
    await closeDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(closeDialog).toBeHidden();

    // The refusal was real, not merely a client-side guess: reload from the
    // server and confirm the problem never actually left RESOLVED.
    await page.reload();
    await expect(page.getByText('Resolvido', { exact: true }).first()).toBeVisible();

    // --- Satisfy P2 (a COMPLETED corrective Action) and P3 (completed by a
    //     DIFFERENT user than the closer) ------------------------------------
    const completerEmail = `e2e-problem-completer-${suffix}@pharosgrc.local`;
    const completerPassword = 'Pharos-E2E-Completer-1!';
    const completer = await provisionUserWithRole(
      page,
      completerEmail,
      `E2E Problem Completer ${suffix}`,
      completerPassword,
      // "Problem Manager" — the least privilege that still covers what this
      // account actually does (view `/actions`, transition one action it
      // owns: `action:view`/`action:edit`, both in its permission set) —
      // never "Platform Administrator" (F-70).
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

    // Completion happens through the REAL "Minhas ações" UI, signed in as
    // the completer — a second, independent browser context so the
    // closer's own session (`page`) is never touched.
    const completerContext = await browserContext.browser()!.newContext();
    const completerPage = await completerContext.newPage();
    await signInAsFreshlyProvisionedUser(completerPage, completerEmail, completerPassword);

    await completerPage.goto('/actions');
    await expect(completerPage.getByRole('heading', { name: 'Planos de Ação' })).toBeVisible();
    // This register now opens on Cards by default (CLAUDE.md §18.12) — the
    // row-based locators below need Tabela.
    await completerPage.getByRole('radio', { name: 'Ver as ações em tabela' }).click();
    // `.filter({ hasText })`, not `getByRole('row', { name })` — mirrors
    // `risk-treatment.spec.ts`/`assets-processes.spec.ts`'s own established
    // convention for locating a `DataTable` row by its content.
    const actionRow = completerPage.getByRole('row').filter({ hasText: actionTitle });
    await expect(actionRow).toBeVisible({ timeout: 15_000 });

    // Every transition here round-trips through a full `GET /actions`
    // refetch (`MyActionsView.applyTransition`'s own `setReloadToken`, no
    // optimistic update) — `DataTable` replaces the entire table body with
    // its loading skeleton for that round trip
    // (`isLoading={loading || transitioningId !== null}`), so the row
    // genuinely disappears and reappears. The generous timeouts below and
    // the fresh `toBeVisible` wait before each dropdown click accommodate
    // that real, observed behaviour rather than racing it.
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

    // --- Close attempt #2: succeeds now that both preconditions hold -------
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

    // Persisted, not merely client state. `CLOSED` is terminal
    // (`availableProblemTransitions('CLOSED')` is empty), so
    // `ProblemLifecycleActions` renders no button at all — the sentence
    // this assertion used to check for was retired in Fase B: the Ciclo de
    // vida TRACK shows "Fechado"/"Atual" directly instead of a sentence
    // saying no transition exists.
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

    // --- Search --------------------------------------------------------------
    await page.getByLabel('Buscar problemas').fill(suffix);
    await expect(page).toHaveURL(new RegExp(`[?&]search=${suffix}`), { timeout: 5_000 });
    await expect(page.getByRole('link', { name: titleA })).toBeVisible();
    await expect(page.getByRole('link', { name: titleB })).toBeVisible();

    // --- Sort by title, ascending --------------------------------------------
    // Sortable column headers exist only in Tabela — Cards is this
    // register's default (CLAUDE.md §18.12).
    await page.getByRole('radio', { name: 'Ver os problemas em tabela' }).click();
    // `use-problem-register-state.ts`'s own default is `identifiedOn` DESC
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
    // — `state.direction` still resolves to `desc` on read, so the sort is
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
    // Scoped to the toolbar's own `role="search"` landmark, same reasoning as
    // `incidents.spec.ts`: the register's "no results" empty state can render
    // a button with the exact same text ("Limpar filtros") as this toolbar's.
    const toolbar = page.getByRole('search', { name: 'Filtros de problemas' });
    // The filter controls live behind the "Filtros" disclosure now that this
    // toolbar is collapsible (CLAUDE.md §18.12) — the search box above stays
    // visible either way, which is why the search assertions above needed no
    // change.
    // Anchored regex, not a plain substring match: the toggle's own
    // accessible name carries its active-filter badge count ("Filtros 1"
    // once a filter is applied), and a loose "Filtros" also matches the
    // sibling "Limpar filtros" button below — `/^Filtros/` can only ever
    // match the disclosure toggle (mirrors `risk-register.spec.ts`'s own
    // `/^Filtros/` for the same control).
    await toolbar.getByRole('button', { name: /^Filtros/ }).click();
    await toolbar.getByRole('button', { name: 'Status', exact: true }).click();
    // `.click()`, not `.check()` — see `incidents.spec.ts`'s identical
    // comment: this checkbox's `onChange` commits a real `router.replace`
    // navigation, which raced `.check()`'s own built-in post-action
    // verification in practice even though the checkbox and filter both
    // ended up correct.
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

  /**
   * 019-problem-detail-experience, Fase A — `?section=` deep-link
   * resolution: nothing proved this end to end before this phase (only
   * `problem-detail-view.test.tsx`'s own jsdom coverage did). Mirrors
   * `incidents.spec.ts`'s identical test.
   */
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

  /**
   * 019-problem-detail-experience, Fase C — editing moved from an inline
   * swap of "Visão geral" to an overlay `Sheet`. Nothing proved the overlay
   * itself, its `Escape` dismissal with focus return, or that an edit still
   * persists through it, end to end. Mirrors `incidents.spec.ts`'s
   * identical test.
   */
  test('Editar opens an overlay Sheet; Escape closes it and returns focus to the Editar button; edits persist', async () => {
    const suffix = Date.now().toString(36);
    const title = `Problema E2E overlay ${suffix}`;
    await createProblem(title);

    const editButton = page.getByRole('button', { name: 'Editar' });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    // `ProblemEditPanel` carries TWO elements named "Editar problema" — the
    // sr-only `SheetTitle` (D-15, so the Sheet itself is named for
    // assistive tech) and `DetailPanel`'s own visible header `<h2>` — so
    // this asserts the panel's own description instead of the ambiguous
    // heading name.
    await expect(dialog.getByText('Altere os dados cadastrais do problema.')).toBeVisible();
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
