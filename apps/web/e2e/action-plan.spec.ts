import { expect, test } from '@playwright/test';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signInAsWorkerAdmin,
  workerAdminFullName,
} from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection } from './support/risk-detail-sections';

import type { Locator, Page } from '@playwright/test';

/**
 * F-81 (`docs/deferred-findings.md`): `GET /actions` has no `sort` and no
 * free-text search (`use-actions-register-state.ts`'s own header comment
 * says so explicitly) — unlike `assets-processes.spec.ts`'s own "sort by
 * recency" fix for the identical CLASS of flake (F-29/F-70's own pattern:
 * a filtered register can outgrow one page as this worker's own actions
 * accumulate across runs), there is no sort control here to reach for.
 * Measured directly: "Tratamento de risco" + "Somente atrasadas" alone
 * returns 105 rows at page size 25 — the row this test just created is not
 * guaranteed to land on page one.
 *
 * Walks forward through the shared `DataTable`'s own "Próxima página"
 * control, page by page, until the row is found or the last page is
 * reached — deterministic on the record THIS TEST creates, never on
 * database order or accumulation, and never widening the assertion itself
 * (still exactly one match, never "at least one"). `pageSize` is
 * deliberately left untouched (raising it would not even be sufficient —
 * the count keeps ratcheting up across runs — and the coordinator's own
 * instruction for this fix forbids it, along with `.skip()` and
 * destructive environment cleanup).
 *
 * The results summary (`role="status"`, "1–25 de 105") is the settle
 * signal after clicking "Próxima página": the shared `PaginationFooter`
 * replaces the table body with a loading skeleton during the refetch
 * (`problems.spec.ts`'s own documented `DataTable` behaviour for the same
 * mechanism), so checking row content immediately after the click would
 * race that refetch; waiting for the summary text to actually change is
 * precise, unlike a fixed delay.
 */
async function findRowAcrossPages(page: Page, text: string): Promise<Locator> {
  const resultsSummary = page.getByRole('status').filter({ hasText: ' de ' });
  const nextPageButton = page.getByRole('button', { name: 'Próxima página' });
  const row = page.getByRole('row').filter({ hasText: text });

  const MAX_PAGES = 20; // 20 × 25 rows/page = 500 — generous, never expected to be reached
  for (let attempt = 0; attempt < MAX_PAGES; attempt += 1) {
    // A bounded WAIT, not an instant snapshot: a filter change just applied
    // right before this call (a combobox re-selection, a checkbox toggle)
    // can still be propagating to the query when this first runs — the
    // plain `expect(row).toHaveCount(1)` this helper replaces absorbed that
    // settling time for free via its own default polling; an instant
    // `row.count()` here would not, and would wrongly conclude "not on this
    // page" while the correct page was simply still catching up.
    try {
      await expect(row).toHaveCount(1, { timeout: 3_000 });
      return row;
    } catch {
      // Genuinely not on this page (or not yet, past this budget) — fall
      // through to checking whether another page exists.
    }
    if (await nextPageButton.isDisabled()) {
      break;
    }
    const before = await resultsSummary.textContent();
    await nextPageButton.click({ timeout: 10_000 });
    await expect(resultsSummary).not.toHaveText(before ?? '', { timeout: 10_000 });
  }
  throw new Error(
    `"${text}" was not found on any page of the current filter (checked up to ${MAX_PAGES} pages).`,
  );
}

/**
 * E2E for the Plano de Ação surface — the shared `Action` capability
 * (CLAUDE.md §17/§19.6) seen from the two ends that matter: the domain
 * screen an action is born in, and the central screen that aggregates every
 * origin.
 *
 * This spec exists because that capability spent four phases complete on the
 * server and unusable in the interface (`specs/010-action-plan-surface/
 * STATE.md` §1). The single most important thing it proves is the first
 * assertion block: **an action created inside a risk shows up in the central
 * list, identified by its origin**. That is the whole reason `Action` is one
 * shared aggregate instead of five per-domain task tables, and nothing in
 * the unit suites can prove it — they mock the API on both sides.
 *
 * ## Why the action is deliberately given a due date in the year 2000
 *
 * `GET /actions` orders by `dueOn` ascending (`prisma-action.repository.ts`)
 * and this worker's admin identity accumulates actions across runs, so "the
 * one I just created" is NOT reliably on page one of an unfiltered list. A
 * far-past due date puts it among the earliest rows, and it also makes the
 * server compute `overdue` for it (ADR-015 — never a client-side date
 * comparison), which lets the "somente atrasadas" filter narrow the list
 * further AND lets this spec assert the overdue badge on real server data.
 * Neither is a workaround for a defect: it is choosing fixture data that
 * makes the assertion deterministic instead of depending on how much debris
 * the database happens to hold.
 *
 * ## Locator notes
 *
 * - The risk's action-creation form and the table's own trigger both read
 *   "Adicionar ação", so the form is scoped by container — the same fix
 *   `risk-treatment.spec.ts` documents at length rather than tuning `exact`.
 * - `getByText(actionTitle)` would also match the edited title, which is the
 *   original plus a suffix. Every assertion that must tell them apart uses
 *   `{ exact: true }` deliberately.
 */
test.describe('Plano de Ação — an action created in a risk is managed centrally', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real Plano de Ação journey.',
  );

  test('creates an action inside a risk, finds it centrally, edits it, transitions it and reads its trail', async ({
    page,
  }, testInfo) => {
    // A long single-session journey: risk creation, action creation, three
    // navigations, an edit, a transition and two filtered list reads. Kept
    // as ONE test on purpose — splitting it would mean either repeating the
    // whole setup per test or sharing state between tests, and repeated
    // sign-ins are exactly what trips the auth throttle (F-43's own account
    // in `support/admin-session.ts`).
    test.setTimeout(120_000);

    await signInAsWorkerAdmin(page, testInfo);
    const adminFullName = workerAdminFullName(testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const riskTitle = `Risco para plano de acao E2E ${uniqueSuffix}`;
    const actionTitle = `Acao de plano E2E ${uniqueSuffix}`;
    const editedTitle = `${actionTitle} revisada`;

    // --- A risk to hang the action on ---------------------------------------
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page.getByLabel('Descrição').fill('Risco de evidência criado pelo E2E de Plano de Ação.');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();

    // --- The risk's own Plano de Ação tab ------------------------------------
    // This tab used to render a "not yet available" placeholder while the
    // working table sat one tab over under "Tratamento". The table moved
    // here; "Tratamento" keeps the treatment DECISION.
    // 016-risk-detail-experience: "Planos de Ação" is a level-2 leaf of the
    // "Resposta" group — `openRiskDetailSection` clicks both levels.
    await openRiskDetailSection(page, 'action-plans');

    const actionForm = page.locator('form').filter({ hasText: 'Nova ação de tratamento' });
    await page.getByRole('button', { name: 'Adicionar ação' }).click();
    await actionForm.getByLabel('Título').fill(actionTitle);
    await actionForm.getByRole('combobox', { name: 'Responsável' }).click();
    // S-10 — the responsible picker now searches the directory server-side
    // (`UserPicker`); this worker's own admin identity accumulates across
    // runs (this file's own header, same reasoning as the due-date choice
    // above) and is not reliably within the picker's own unsearched first
    // page, so this must search by name rather than assume it is. Each
    // option's accessible name is "fullName email" (`SearchablePicker`'s own
    // accname fix — the label and the description below it are concatenated
    // with no separator otherwise), so the exact match is now anchored at
    // the START of that string, not the whole thing.
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill(adminFullName);
    await page.getByRole('option', { name: new RegExp(`^${adminFullName} `) }).click();
    await actionForm.getByLabel('Prazo').fill('2000-01-01');
    await actionForm.getByRole('button', { name: 'Adicionar ação' }).click();

    await expect(page.getByText(actionTitle, { exact: true })).toBeVisible();
    // The server's own computed flag, conveyed by text and icon rather than
    // colour alone (SC-012).
    await expect(page.getByText('Vencida', { exact: true }).first()).toBeVisible();

    // --- THE point of the shared capability ----------------------------------
    // The action was created through the RISK's own route, under `risk:treat`.
    // It must nevertheless be the same row the platform-wide surface lists,
    // because there is one `Action` aggregate and not a per-domain copy.
    await page.goto('/actions');
    await expect(page.getByRole('heading', { name: 'Planos de Ação' })).toBeVisible();
    // This register now opens on Cards (CLAUDE.md §18.12, the shared
    // register family) and its filter controls live behind the "Filtros"
    // disclosure — switch to Tabela (the row-based assertions below need it)
    // and open the panel before touching any filter control.
    await page.getByRole('radio', { name: 'Ver as ações em tabela' }).click();
    await page.getByRole('button', { name: 'Filtros' }).click();

    await page.getByRole('combobox', { name: 'Origem' }).click();
    await page.getByRole('option', { name: 'Tratamento de risco' }).click();
    await page.getByRole('checkbox', { name: 'Somente atrasadas' }).click();

    const centralRow = await findRowAcrossPages(page, actionTitle);
    // The origin cell names the risk it came from — the link back, not a
    // copied label: `originLabel` is resolved server-side from the origin.
    await expect(centralRow).toContainText(riskTitle);
    await expect(centralRow.getByText('Atrasada', { exact: true })).toBeVisible();

    // --- The row's code opens the action's own detail ------------------------
    await centralRow.getByRole('link').first().click();
    await page.waitForURL(/\/actions\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: actionTitle, exact: true })).toBeVisible();
    const actionUrl = page.url();

    // --- Editing through the detail persists ---------------------------------
    await page.getByRole('button', { name: 'Editar' }).click();
    // Not scoped to a `<form>`: `ActionEditForm` renders its fields in a
    // plain container, so there is no form element to filter on — verified
    // against the component, after a first version of this spec assumed one
    // and timed out waiting for it. "Título" is unique on the overview tab
    // while the editor is open (the read view labels nothing "Título" — the
    // action's own title is the page heading).
    await page.getByLabel('Título').fill(editedTitle);
    await page.getByRole('button', { name: 'Salvar alterações' }).click();

    await expect(page.getByRole('heading', { name: editedTitle, exact: true })).toBeVisible();
    // Reloaded from the server, not read back from the component's own state
    // — the difference between "the screen updated" and "the edit was saved".
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: editedTitle, exact: true })).toBeVisible();

    // --- The audit trail carries both events ---------------------------------
    await page.getByRole('tab', { name: 'Auditoria' }).click();
    await expect(page.getByText('action.created')).toBeVisible();
    await expect(page.getByText('action.updated')).toBeVisible();
    // An empty or errored trail must never be mistaken for a passing
    // assertion: both alternatives are asserted absent explicitly.
    await expect(page.getByText('Nenhum evento de auditoria registrado ainda.')).toHaveCount(0);
    await expect(page.getByText('Não foi possível carregar a trilha de auditoria.')).toHaveCount(0);

    // --- The lifecycle obeys the server's own legality table -----------------
    await page.getByRole('tab', { name: 'Visão geral' }).click();
    // `COMPLETED` is not reachable directly from `OPEN`, and the UI must not
    // offer it. `status.ts` is advisory; this asserts the advice matches.
    await expect(page.getByRole('button', { name: 'Concluir' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Iniciar' }).click();
    await expect(page.getByText('Em andamento', { exact: true }).first()).toBeVisible();

    // --- Filters actually filter ---------------------------------------------
    await page.goto('/actions');
    await page.getByRole('radio', { name: 'Ver as ações em tabela' }).click();
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('combobox', { name: 'Origem' }).click();
    await page.getByRole('option', { name: 'Tratamento de risco' }).click();
    await page.getByRole('checkbox', { name: 'Somente atrasadas' }).click();
    await findRowAcrossPages(page, editedTitle);

    // Same action, a genuinely different origin filter: it must disappear.
    // Asserting the count goes to zero — not merely that "some other rows
    // showed up" — is what makes this a filter assertion rather than a
    // page-loaded assertion.
    await page.getByRole('combobox', { name: 'Origem' }).click();
    await page.getByRole('option', { name: 'Incidente' }).click();
    await expect(page.getByRole('row').filter({ hasText: editedTitle })).toHaveCount(0);

    // And a status filter that excludes it, from the same starting point.
    await page.getByRole('combobox', { name: 'Origem' }).click();
    await page.getByRole('option', { name: 'Tratamento de risco' }).click();
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Concluída' }).click();
    await expect(page.getByRole('row').filter({ hasText: editedTitle })).toHaveCount(0);

    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Em andamento' }).click();
    await findRowAcrossPages(page, editedTitle);

    // The detail URL is still the same resource after all of it — one
    // aggregate, one identity, reached from two different screens.
    await page.goto(actionUrl);
    await expect(page.getByRole('heading', { name: editedTitle, exact: true })).toBeVisible();
  });
});

/**
 * The permission half, as its own scenario with its own identity.
 *
 * The Risk Analyst fixture holds `risk:view` but NOT `risk:treat`
 * (`platform.seed.ts`'s own comment on that role says so explicitly), which
 * is exactly the pair the risk's Plano de Ação tab distinguishes: the whole
 * tab is behind one gate, so a caller who can see the risk still gets a
 * read-only plan.
 *
 * The analyst creates its OWN risk rather than opening the one above. That
 * is not convenience: `risk-approval.spec.ts` established — by reading
 * `seedDevFixtures` and `ScopeResolverService`, not by assuming — that this
 * fixture is scoped to `DIV-A-TEAM-1` alone and cannot see a risk created
 * under the seeded root unit at all. Reusing the first risk here would fail
 * for a scope reason that has nothing to do with what this scenario tests.
 */
test.describe('Plano de Ação — a caller who cannot treat the risk gets a read-only plan', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real permission gate.',
  );

  test('hides creation and row actions from a caller holding risk:view without risk:treat', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);

    const uniqueSuffix = Date.now().toString(36);
    const riskTitle = `Risco somente leitura E2E ${uniqueSuffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco do E2E que verifica o gate de escrita do plano de ação.');
    // This fixture's org-unit picker offers only its own unit, so `.first()`
    // is that unit — `selectSeededRootOrgUnit` would not find the root here.
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    await openRiskDetailSection(page, 'action-plans');

    // The tab renders — this caller can SEE the plan. What it must not offer
    // is any way to change it. Asserting the tab content is present first is
    // what keeps the two absences below from passing vacuously on a tab that
    // simply failed to load.
    await expect(page.getByText('Plano de ação', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar ação' })).toHaveCount(0);
    // `{ exact: true }` is load-bearing: Playwright's accessible-name match
    // is substring and case-insensitive by default, and the shell's own
    // notifications bell ("Notificações") CONTAINS "ações". Without it this
    // assertion fails against correct product code — measured, not feared.
    await expect(page.getByRole('button', { name: 'Ações', exact: true })).toHaveCount(0);
  });
});

/**
 * 020-action-detail-experience, Fase C — editing moved from an inline swap
 * of "Visão geral" to an overlay `Sheet`, and the "Ciclo de vida" card grew
 * a real track visual with the button row inside it. Nothing before this
 * phase proved the overlay itself, its `Escape` dismissal with focus
 * return, that an edit still persists through it, or that the trail still
 * advances all the way through `COMPLETED` and back via a reopen with a
 * required reason. Mirrors `problems.spec.ts`'s/`incidents.spec.ts`'s own
 * identical overlay test, extended with the reopen leg neither of those two
 * needed (`Problem`/`Incident` reopen through their OWN dialogs, not
 * `ReopenActionDialog`).
 *
 * A fresh risk + action, exactly like the main journey test above builds —
 * this scenario needs its OWN action (not a shared one) because it drives
 * the SAME action through OPEN -> IN_PROGRESS -> COMPLETED -> OPEN again,
 * which would conflict with the main journey's own status-filter
 * assertions if it shared that row.
 */
test.describe('Plano de Ação — detail: overlay editing, lifecycle trail, reopen dialog (Fase C)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the action detail overlay and lifecycle trail.',
  );

  test('Editar opens an overlay Sheet (Escape closes it, focus returns); the trail advances through COMPLETED and a reopen that requires a reason', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    await signInAsWorkerAdmin(page, testInfo);
    const adminFullName = workerAdminFullName(testInfo);

    const suffix = Date.now().toString(36);
    const riskTitle = `Risco para overlay E2E ${suffix}`;
    const actionTitle = `Acao de overlay E2E ${suffix}`;

    // --- Fixture: a risk, and an action hanging off its treatment tab -------
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco criado pelo E2E do overlay de edição de Plano de Ação.');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    await openRiskDetailSection(page, 'action-plans');
    const actionForm = page.locator('form').filter({ hasText: 'Nova ação de tratamento' });
    await page.getByRole('button', { name: 'Adicionar ação' }).click();
    await actionForm.getByLabel('Título').fill(actionTitle);
    await actionForm.getByRole('combobox', { name: 'Responsável' }).click();
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill(adminFullName);
    await page.getByRole('option', { name: new RegExp(`^${adminFullName} `) }).click();
    // A future due date — this scenario has nothing to do with "Atrasada".
    await actionForm.getByLabel('Prazo').fill('2030-01-01');
    await actionForm.getByRole('button', { name: 'Adicionar ação' }).click();
    await expect(page.getByText(actionTitle, { exact: true })).toBeVisible();

    // --- Open the action's own detail from the risk's own table -------------
    await page.getByRole('link', { name: actionTitle, exact: true }).click();
    await page.waitForURL(/\/actions\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: actionTitle, exact: true })).toBeVisible();

    // --- Overlay: opens; the page (Ciclo de vida included) stays readable
    //     behind it; Escape closes it and returns focus to "Editar" --------
    const editButton = page.getByRole('button', { name: 'Editar' });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    // `ActionEditPanel` carries TWO elements named "Editar ação" — the
    // sr-only `SheetTitle` (D-15) and `DetailPanel`'s own visible header
    // `<h2>` — so this asserts the panel's own description instead of the
    // ambiguous heading name, mirroring `problems.spec.ts`'s identical
    // choice.
    await expect(dialog.getByText('Altere os dados cadastrais da ação.')).toBeVisible();
    await expect(page.getByText('Ciclo de vida')).toBeVisible();

    // `showCloseButton={false}` (`action-edit-panel.tsx`) — there is no
    // separate icon-only "Fechar" to find here; "Cancelar" is the only
    // visible close affordance, alongside Escape/backdrop.
    await expect(page.getByRole('button', { name: 'Fechar' })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(editButton).toBeFocused();

    // --- The edit persists through the overlay -------------------------------
    await editButton.click();
    const editedTitle = `${actionTitle} (editado)`;
    await dialog.getByLabel('Título').fill(editedTitle);
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: editedTitle, exact: true })).toBeVisible();

    // --- The trail: OPEN -> IN_PROGRESS -> COMPLETED -------------------------
    await expect(page.getByRole('button', { name: 'Concluir' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Iniciar' }).click();
    await expect(page.getByText('Em andamento', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByText('Concluída em', { exact: true })).toBeVisible();
    // Only "Reabrir" is legal from COMPLETED — the two OPEN/IN_PROGRESS
    // buttons are gone, not merely disabled (FR-030's omission rule).
    await expect(page.getByRole('button', { name: 'Iniciar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);

    // --- Reopen: the reason is required, enforced and mirrored honestly -----
    await page.getByRole('button', { name: 'Reabrir' }).click();
    const reopenDialog = page.getByRole('dialog');
    await expect(reopenDialog.getByRole('heading', { name: 'Reabrir ação' })).toBeVisible();

    // Confirming empty is refused — the dialog's own gate, still intact
    // after this rodada's changes to the surrounding "Ciclo de vida" card.
    await reopenDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(reopenDialog.getByText('Informe o motivo da reabertura.')).toBeVisible();
    await expect(reopenDialog).toBeVisible();

    await reopenDialog
      .getByLabel('Motivo da reabertura')
      .fill('Reaberta pelo E2E para revalidar o trabalho.');
    await reopenDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(reopenDialog).toBeHidden();

    // The real, server-verified reopened state (corrected 2026-09-18 —
    // this assertion used to expect "Concluída em" to survive the reopen,
    // which THIS test itself disproved: `TransitionActionUseCase` clears
    // `completedAt` back to `null` on every transition away from
    // `COMPLETED`, including this one. "Reaberta em" is the only outcome
    // fact left — the completion fact now lives only in the audit trail's
    // own `previousValues` on this reopen event, "Auditoria", a different
    // section — never re-asserted on the live overview card).
    await expect(page.getByText('Reaberta em', { exact: true })).toBeVisible();
    await expect(page.getByText('Concluída em', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Aberta', { exact: true }).first()).toBeVisible();

    // The reopen is real, not merely a client-side guess: reload from the
    // server and confirm the action is genuinely back at OPEN, with the
    // same (corrected) outcome-fact shape surviving a fresh fetch.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('Aberta', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Reaberta em', { exact: true })).toBeVisible();
    await expect(page.getByText('Concluída em', { exact: true })).toHaveCount(0);

    // The prior completion is not lost — it is exactly where a historical
    // fact belongs, the audit trail, distinct from the live overview.
    await page.getByRole('tab', { name: 'Auditoria' }).click();
    await expect(page.getByText('action.reopened')).toBeVisible();
    await expect(page.getByText('action.completed')).toBeVisible();
  });
});
