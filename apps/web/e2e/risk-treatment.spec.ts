import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  signInAsWorkerAdmin,
  workerAdminFullName,
} from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection } from './support/risk-detail-sections';

/**
 * T136 — E2E: record a treatment decision, add treatment actions, link a
 * control, and observe the server-computed overdue indicator (US5, FR-071
 * to FR-078, FR-102, ADR-015).
 *
 * Runs against a real backend (`apps/api`), seeded per
 * `apps/api/prisma/seed/platform.seed.ts` — including the `FIXTURE-CONTROL-1`
 * dev fixture that seed file's `seedDevFixtures` now creates specifically so
 * this journey has a real, DB-backed control to link (`GET /controls` has
 * no create endpoint of its own; see that file's own comment). Skips itself
 * with a clear reason when `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are not
 * set, exactly like every other spec in this directory.
 *
 * ## Accessible-name collision notes (see CLAUDE.md's warning)
 *
 * Several distinct locator hazards were found and resolved while writing
 * this spec — one a REAL accessibility defect (fixed in the component), the
 * rest under-specified locators (fixed here, never in the component):
 *
 * 1. **Real defect, fixed in `risk-controls-section.tsx`**: the three
 *    relationship subsections (controls, processes, assets) each render a
 *    button whose visible text is the bare "Vincular", with no shared
 *    table/row context to disambiguate them the way per-row "Desvincular"
 *    buttons have — three genuinely different actions with the exact same
 *    accessible name on the same screen. Fixed by giving each an
 *    `aria-label` naming its own kind ("Vincular controle" etc.), so this
 *    spec targets `getByRole('button', { name: 'Vincular controle' })`
 *    deliberately, not a plain "Vincular" that would now correctly refuse
 *    to resolve to a single element.
 * 2. **Under-specified locator, fixed HERE, not the component**: the
 *    Treatment tab renders the treatment-decision form's "Prazo" field
 *    (optional, FR-073) and the treatment-ACTION form's "Prazo" field
 *    (required) at the same time once both forms are visible — two
 *    DIFFERENT fields that happen to share a label. `getByLabel('Prazo')`
 *    (a substring match) would match both, and which one a bare
 *    `{ exact: true }` resolves to depends on which field's accessible name
 *    happens to be the unadorned "Prazo" at any given time — wave 4's
 *    required-field convention (CLAUDE.md §18) already flipped that once
 *    when the action's "Prazo" gained a " (obrigatório)" suffix. The fix
 *    that survives either field's required/optional status changing again
 *    is scoping by container (`actionForm`, the action-creation `<form>`
 *    itself, named by its own "Nova ação de tratamento" heading) rather
 *    than tuning `exact` a second time.
 * 3. **Under-specified locator, also fixed HERE**: with `SEED_DEV_FIXTURES`
 *    enabled, the directory contains several other fixture users whose full
 *    names share a prefix with each other (`Fixture — Platform
 *    Administrator`, `Fixture — E2E Worker Admin 0..N` — see F-16,
 *    `docs/deferred-findings.md`, and `support/admin-session.ts`'s
 *    `signInAsWorkerAdmin`/`workerAdminFullName`, which this spec now signs
 *    in with instead of the single shared bootstrap administrator).
 *    `getByRole('option', { name: adminFullName })` without `exact: true`
 *    would risk matching more than one of these — two DIFFERENT people who
 *    legitimately have overlapping names, not a naming defect. Fixed with
 *    `{ exact: true }`, never by renaming any fixture user.
 * 4. **Under-specified locator, also fixed HERE**: `getByText` matches
 *    case-insensitively by substring by default, so an action deliberately
 *    named to contain the word "vencida" (Portuguese for "overdue") would
 *    itself satisfy a non-exact `getByText('Vencida')` query meant for the
 *    `StatusBadge` — not because the badge and the title share a name, but
 *    because the query was under-specified. Fixed by choosing a fixture
 *    title that does not contain the word at all, plus `{ exact: true }` on
 *    every `StatusBadge` assertion, rather than avoiding the word "vencida"
 *    everywhere in this spec's data out of superstition.
 * 5. **Real defect, fixed HERE (Front H, D-17)**: the control-link picker
 *    used to be a plain `<Select>` fed by one unsearched first page, so
 *    selecting `FIXTURE-CONTROL-1` by its visible name worked only because
 *    the whole catalog was small when this spec was first written. It is
 *    now `SearchablePicker` — this spec types the fixture's own code into
 *    the picker's search box before looking for its option, the same fix
 *    applied to `assets-processes.spec.ts` and `accessibility.spec.ts`,
 *    rather than continuing to assume the fixture lands on an unsearched
 *    first page that has since grown past it (40+ controls from repeated
 *    E2E/UI-capture runs — `audit-engagement.spec.ts`'s own account).
 */
test.describe('Record treatment, add actions, link a control, observe overdue (US5)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real treatment journey.',
  );

  test('records a treatment decision, adds actions, links a control, and the overdue action is flagged', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    const adminFullName = workerAdminFullName(testInfo);

    // --- Create a fixture risk to treat -------------------------------------
    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para tratamento E2E ${uniqueSuffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência criado pelo E2E de tratamento (T136).');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // --- Record a treatment decision (FR-071 to FR-073) ---------------------
    await openRiskDetailSection(page, 'treatment');
    await expect(
      page.getByText('Este risco ainda não possui uma decisão de tratamento'),
    ).toBeVisible();

    // 016-risk-detail-experience, Área 3 (2026-09-17): the decision form is
    // now behind a contextual action — `risk-treatment-section.tsx`'s own
    // `showForm`, the same "list/read first, form behind a button" pattern
    // `treatment-actions-table.tsx` already used. The reveal ("Registrar
    // nova decisão") and the submit ("Registrar decisão") are DIFFERENT
    // labels here, unlike the "Vincular controle"/"Adicionar ação" pattern
    // below and on Planos de Ação.
    await page.getByRole('button', { name: 'Registrar nova decisão' }).click();
    await page.getByRole('combobox', { name: 'Estratégia' }).click();
    await page.getByRole('option', { name: 'Mitigar' }).click();
    await page.getByLabel('Descrição').fill('Mitigar por meio de controles adicionais.');
    await page.getByRole('button', { name: 'Registrar decisão' }).click();

    // The current-treatment display now shows the recorded decision — the
    // durable signal, not the transient success toast.
    await expect(page.getByText('Mitigar por meio de controles adicionais.')).toBeVisible();
    await expect(page.getByText(`Decidido por ${adminFullName}`)).toBeVisible();

    // --- Add treatment actions (FR-074) --------------------------------------
    // The actions table lives on the "Planos de Ação" tab, not on "Tratamento"
    // where this spec originally found it. It moved there in the work that
    // gave the risk module a real Plano de Ação surface: that tab used to
    // render a bare "not yet available" placeholder while THIS table, one tab
    // over, was already doing the work. "Tratamento" keeps the treatment
    // DECISION (recorded above) and now carries a short pointer to where its
    // actions live.
    await openRiskDetailSection(page, 'action-plans');

    // Scoped to the action-creation `<form>` itself. The original reason was
    // that the treatment-DECISION form's own "Prazo" field (optional,
    // FR-073) shared the tab with the action form's required one — the two
    // forms are now on separate tabs, so that particular collision is gone,
    // but the scoping stays: the action form's own submit button and the
    // table's "Adicionar ação" trigger still share an accessible name, and
    // scoping by container is what survives either label changing again.
    const actionForm = page.locator('form').filter({ hasText: 'Nova ação de tratamento' });
    await page.getByRole('button', { name: 'Adicionar ação' }).click();
    await actionForm.getByLabel('Título').fill('Ação com prazo no passado (E2E)');
    await actionForm.getByRole('combobox', { name: 'Responsável' }).click();
    // S-10 — the responsible picker now searches the directory server-side
    // (`UserPicker`); this worker's own admin identity accumulates across
    // runs and is not reliably within the picker's own unsearched first
    // page, so this must search by name. Each option's accessible name is
    // "fullName email" (`SearchablePicker`'s own accname fix — the label
    // and description are concatenated with no separator otherwise), so the
    // exact match from item 3 above is now anchored at the START of that
    // string, not the whole thing.
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill(adminFullName);
    await page.getByRole('option', { name: new RegExp(`^${adminFullName} `) }).click();
    // A due date well in the past, so the server computes it as overdue
    // (ADR-015) — never a client-side date comparison.
    await actionForm.getByLabel('Prazo').fill('2020-01-01');
    await actionForm.getByRole('button', { name: 'Adicionar ação' }).click();

    await expect(page.getByText('Ação com prazo no passado (E2E)')).toBeVisible();
    // "Vencida" is a distinct, text-and-icon status badge — never a bare
    // colour cue (SC-012) — and it reads the SERVER's own computed flag.
    await expect(page.getByText('Vencida', { exact: true })).toBeVisible();

    // A second, future-dated action must NOT be flagged overdue.
    await page.getByRole('button', { name: 'Adicionar ação' }).click();
    await actionForm.getByLabel('Título').fill('Ação futura (E2E)');
    await actionForm.getByRole('combobox', { name: 'Responsável' }).click();
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill(adminFullName);
    await page.getByRole('option', { name: new RegExp(`^${adminFullName} `) }).click();
    await actionForm.getByLabel('Prazo').fill('2099-01-01');
    await actionForm.getByRole('button', { name: 'Adicionar ação' }).click();

    await expect(page.getByText('Ação futura (E2E)')).toBeVisible();
    const futureRow = page.getByRole('row').filter({ hasText: 'Ação futura (E2E)' });
    await expect(futureRow.getByText('Vencida', { exact: true })).toHaveCount(0);
    // Exactly one "Vencida" badge on the whole tab — the future action's row
    // does not carry one.
    await expect(page.getByText('Vencida', { exact: true })).toHaveCount(1);

    // --- Link a control (FR-076 to FR-078) -----------------------------------
    await openRiskDetailSection(page, 'controls');
    await expect(page.getByText('Nenhum controle vinculado a este risco.')).toBeVisible();

    // 016-risk-detail-experience, Área 3 (2026-09-17): the link picker
    // itself is now behind a contextual action for Controles specifically
    // (`gateLinkBehindAction`, `risk-controls-section.tsx`) — Processos e
    // Ativos deliberately do NOT get this (same component, different
    // family, `gateLinkBehindAction` defaults `false` there). The reveal
    // button shares its accessible name with the submit button below
    // (`messages.pickerLabel`, "Vincular controle" — same pattern as
    // Planos de Ação's "Adicionar ação").
    await page.getByRole('button', { name: 'Vincular controle' }).click();
    // The picker's own trigger accessible name is `pickerAriaLabel`
    // ("Selecionar controle") — deliberately DIFFERENT from the adjacent
    // button's "Vincular controle" (see note 5 above), confirmed by
    // rendered inspection against a real worktree build of this component.
    await page.getByRole('combobox', { name: 'Selecionar controle' }).click();
    // Front H: search by the fixture's own code — see note 5 above.
    await page.getByPlaceholder('Buscar controle por nome ou código').fill('FIXTURE-CONTROL-1');
    const fixtureControlOption = page.getByRole('option', { name: /Controle de acesso lógico/ });
    await expect(fixtureControlOption).toBeVisible({ timeout: 10_000 });
    await fixtureControlOption.click();
    await page.getByRole('button', { name: 'Vincular controle' }).click();

    await expect(page.getByText('Controle de acesso lógico (fixture)')).toBeVisible();
    await expect(page.getByText('FIXTURE-CONTROL-1')).toBeVisible();

    // --- Unlink the control — confirmed, and the link is retained in history,
    // not erased (FR-076, FR-102) ---------------------------------------------
    await page.getByRole('button', { name: 'Desvincular' }).click();
    await expect(page.getByText('Desvincular controle?')).toBeVisible();
    await expect(
      page.getByText(/O vínculo não é apagado: ele continua registrado no histórico/),
    ).toBeVisible();
    // Confirming inside the dialog — the row's own trigger becomes inert
    // (Radix marks the rest of the page `aria-hidden` while the dialog is
    // open), so this is now the ONE remaining "Desvincular" match.
    await page.getByRole('button', { name: 'Desvincular' }).click();

    await expect(page.getByText('Nenhum controle vinculado a este risco.')).toBeVisible();
  });
});
