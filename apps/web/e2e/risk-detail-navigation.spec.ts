import { expect, test } from '@playwright/test';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signInAsWorkerAdmin,
} from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import {
  gotoRiskDetailSection,
  openRiskDetailSection,
  riskDetailGroupTablist,
  riskDetailLeafTablist,
  riskDetailSectionPanel,
  RISK_DETAIL_SECTIONS,
  type RiskDetailSectionId,
} from './support/risk-detail-sections';

import type { Page } from '@playwright/test';

/**
 * 016-risk-detail-experience — E2E for the composition itself: the
 * two-level navigation, the `?section=` deep link, and the "Editar" overlay
 * panel. Every OTHER risk-detail spec in this directory exercises a
 * business flow (assessment, treatment, collaboration, …) THROUGH this
 * navigation; this file exercises the navigation as its own subject —
 * exactly the split `support/risk-detail-sections.ts`'s own header comment
 * draws between `openRiskDetailSection` (click path matters) and
 * `gotoRiskDetailSection` (deep link, click path does not matter).
 *
 * Runs against a real backend, seeded per
 * `apps/api/prisma/seed/platform.seed.ts` — same convention as every other
 * spec in this directory.
 */
test.describe('Risk detail — two-level navigation, deep link, and the edit overlay', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real risk-detail navigation.',
  );

  /**
   * F-71 (`docs/deferred-findings.md`) — a `useId()` mismatch between the
   * server-rendered HTML and the client's first hydration pass, exclusive to
   * `next dev --turbopack` (measured: 0 occurrences in 165 loads against a
   * production build). It hits the APP SHELL's own account-menu
   * `DropdownMenuTrigger` (`app-shell.tsx`, "Menu da conta de …") — nothing
   * this file's own risk-detail markup renders — spot-checked directly
   * against this rodada's own build on 2026-09-16: 2 of 10 hard navigations
   * to a risk detail page at 390px reproduced it, always on that exact
   * element, never on anything inside `RiskDetailView`/`EntityTabs`.
   *
   * This filters ONLY that specific signature — the React boilerplate line
   * AND the component name AND the account-menu's own accessible-name
   * prefix, all three together — never bare "any hydration mismatch"
   * (CLAUDE.md §18.8: a filter a real defect could also satisfy protects
   * nothing). A genuine hydration defect inside the risk-detail screen
   * itself would carry neither "DropdownMenuTrigger" nor "Menu da conta" and
   * would still fail this test's `consoleErrors` assertion.
   *
   * REMOVE THIS FILTER once F-71 is fixed — at that point a recurrence here
   * is real and this test should catch it again.
   */
  function isKnownF71ShellHydrationMismatch(text: string): boolean {
    return (
      text.includes(
        "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties",
      ) &&
      text.includes('DropdownMenuTrigger') &&
      text.includes('Menu da conta')
    );
  }

  async function createFixtureRisk(page: Page, label: string): Promise<string> {
    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para navegação E2E ${label} ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Descrição').fill(`Risco criado pelo E2E de navegação (${label}).`);
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    return title;
  }

  test('every one of the fifteen leaf sections is reachable through the two-level navigation and renders', async ({
    page,
  }, testInfo) => {
    // Every section (Auditoria/Evidência/Achados included) needs to be
    // VISIBLE for this to prove all fifteen, not just the twelve any caller
    // gets — the Platform Administrator equivalent holds every gate.
    await signInAsWorkerAdmin(page, testInfo);
    await createFixtureRisk(page, 'quinze-secoes');

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isKnownF71ShellHydrationMismatch(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    const allSectionIds = Object.keys(RISK_DETAIL_SECTIONS) as RiskDetailSectionId[];
    expect(allSectionIds).toHaveLength(15);

    for (const sectionId of allSectionIds) {
      await openRiskDetailSection(page, sectionId);
      await expect(riskDetailSectionPanel(page, sectionId)).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test('?section=<id> opens the correct group and leaf directly, for every section', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    await createFixtureRisk(page, 'deep-link');
    const riskDetailUrl = page.url();

    for (const [sectionId, descriptor] of Object.entries(RISK_DETAIL_SECTIONS) as [
      RiskDetailSectionId,
      (typeof RISK_DETAIL_SECTIONS)[RiskDetailSectionId],
    ][]) {
      await gotoRiskDetailSection(page, riskDetailUrl, sectionId);
      await expect(riskDetailSectionPanel(page, sectionId)).toBeVisible();
      await expect(
        riskDetailGroupTablist(page).getByRole('tab', { name: descriptor.groupLabel, exact: true }),
      ).toHaveAttribute('data-state', 'active');
      if (descriptor.leafLabel) {
        await expect(
          riskDetailLeafTablist(page, descriptor.groupId)!.getByRole('tab', {
            name: descriptor.leafLabel,
            exact: true,
          }),
        ).toHaveAttribute('data-state', 'active');
      }
    }
  });

  test('an unknown ?section= value falls back silently to the first visible section, never an error', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    const title = await createFixtureRisk(page, 'secao-desconhecida');
    const riskDetailUrl = page.url();

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isKnownF71ShellHydrationMismatch(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto(`${riskDetailUrl}?section=isto-nao-existe`);

    // Falls back to "overview" (the first visible group's first visible
    // section, `resolveActiveRiskDetailSection`'s own documented contract)
    // — the page renders normally, the risk's own heading is still there,
    // and nothing in the console complains.
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(riskDetailSectionPanel(page, 'overview')).toBeVisible();
    await expect(
      riskDetailGroupTablist(page).getByRole('tab', { name: 'Visão geral', exact: true }),
    ).toHaveAttribute('data-state', 'active');
    expect(consoleErrors).toEqual([]);
  });

  /**
   * §4.4 (corrected 2026-09-16, coordinator): section changes commit through
   * `?section=` with `router.replace`, deliberately — the SAME convention
   * `apps/web/src/lib/register/url-state.ts` already established and
   * documents in its own header ("a register must not stack one history
   * entry per filter click, so the Back button from a record's detail page
   * lands on the register exactly as it was left, rather than unwinding a
   * trail of filter states"). §18.12 forbids a module inventing its own
   * convention here. The version of this test that shipped in the previous
   * round of this rodada asserted the OPPOSITE — that Back should unwind the
   * section trail one section at a time — which the coordinator confirmed is
   * the wrong requirement, not a defect in the code: a user who opened six
   * sections would need seven Backs just to leave the risk's screen. That
   * assertion is gone; this is what actually needs protecting.
   *
   * The real guarantee: visiting several sections costs the URL's `?section=`
   * value, never a history entry, so a SINGLE Back after any number of
   * section changes takes the user all the way back to wherever they came
   * from — the risk register, exactly as they left it (FR-092, already
   * proven for the register's OWN filters by `risk-register.spec.ts`'s
   * "navigating to a risk and back preserves the register's search and
   * sort") — never to an intermediate section. Three-plus sections are
   * visited (pinned, not "one or two") so this assertion would fail the
   * moment a future change swapped `replace` for `push` on section commits.
   */
  test('a single Back after visiting several sections leaves the risk screen entirely, landing back on the register as left', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para navegação E2E botao-voltar ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Descrição').fill('Risco criado pelo E2E de navegação (botao-voltar).');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    // Leave from the REGISTER, with real state of its own (table view +
    // search) — mirroring `risk-register.spec.ts`'s own "navigating to a
    // risk and back preserves the register's search and sort" test, so the
    // register side of this guarantee is exercised the exact same way it
    // already is. Table view first: the register opens on Cards by default
    // (`action-plan.spec.ts`'s own comment on the same register family),
    // whose rows are not `role="link"` by title the way table rows are.
    await page.goto('/risks');
    await page.getByRole('radio', { name: 'Ver os riscos em tabela' }).click();
    await expect(page).toHaveURL(/[?&]view=table/);
    await expect(page.getByRole('table', { name: 'Registro de riscos' })).toBeVisible({
      timeout: 15_000,
    });
    const searchLabel = 'Buscar por código, título ou descrição';
    await page.getByLabel(searchLabel).fill(uniqueSuffix);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${uniqueSuffix}`), { timeout: 5_000 });
    const registerUrl = page.url();

    const rowLink = page.getByRole('link', { name: title });
    await expect(rowLink).toBeVisible();
    await rowLink.click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // Visit four sections, spanning three different top-level groups —
    // FOUR, not one, is the point: none of this may cost a history entry.
    await openRiskDetailSection(page, 'causes-consequences');
    await expect(riskDetailSectionPanel(page, 'causes-consequences')).toBeVisible();
    await openRiskDetailSection(page, 'assessment');
    await expect(riskDetailSectionPanel(page, 'assessment')).toBeVisible();
    await openRiskDetailSection(page, 'treatment');
    await expect(riskDetailSectionPanel(page, 'treatment')).toBeVisible();
    await openRiskDetailSection(page, 'history');
    await expect(riskDetailSectionPanel(page, 'history')).toBeVisible();

    // ONE Back, after four section changes, must leave the risk screen
    // entirely and land on the register — exactly where it was left, not on
    // an intermediate section and not on a bare `/risks` with the search box
    // reset.
    await page.goBack();

    await expect(page).toHaveURL(registerUrl);
    await expect(page.getByLabel(searchLabel)).toHaveValue(uniqueSuffix);
    await expect(page.getByRole('link', { name: title })).toBeVisible();
  });

  test('the edit panel opens, saves, and returns focus to the "Editar" trigger on close', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    const title = await createFixtureRisk(page, 'editar-painel');
    const editedTitle = `${title} (editado)`;

    // The page BEHIND the sheet stays read-only throughout (§4.8) — checked
    // BEFORE opening it, not while it is open: Radix marks the rest of the
    // page `aria-hidden` for the duration (the same mechanism this
    // directory's other specs already document, e.g.
    // `risk-collaboration.spec.ts`'s "Radix marks the rest of the page
    // inert" comment), so a role-based query for the overview panel would
    // find nothing while the sheet is up — that is the dialog behaving
    // correctly, not the overview content having been replaced.
    await expect(riskDetailSectionPanel(page, 'overview')).toBeVisible();

    const editTrigger = page.getByRole('button', { name: 'Editar' });
    await editTrigger.click();

    const sheet = page.getByRole('dialog', { name: 'Editar risco' });
    await expect(sheet).toBeVisible();

    await sheet.getByLabel('Título').fill(editedTitle);
    await sheet.getByRole('button', { name: 'Salvar' }).click();

    await expect(sheet).toBeHidden();
    await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();
    // D-15's shared focus-restore mechanism (`useDialogFocusRestore`) — the
    // same one every other dialog on this screen already relies on.
    await expect(editTrigger).toBeFocused();
  });

  /**
   * FR-030 (omission, never disabling) applied to the new two-level
   * navigation specifically: the Risk Analyst fixture holds `risk:view` but
   * not `audit:view` (`platform.seed.ts`, and already exercised by
   * `risk-history.spec.ts`) — reused here rather than inventing a second
   * identity mechanism, per this rodada's own instruction.
   */
  test('a caller without audit:view never sees the Auditoria leaf, including via a stale deep link', async ({
    page,
  }) => {
    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco RBAC navegação E2E ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Descrição').fill('Risco do E2E que verifica a omissão de Auditoria.');
    // This fixture's org-unit picker offers only its own unit (see
    // `action-plan.spec.ts`'s identical comment on the same fixture).
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const riskDetailUrl = page.url();

    // "Registro" still renders — it keeps three always-visible sections
    // (Histórico/Anexos/Comentários) — but its own leaf tablist never
    // contains "Auditoria".
    await openRiskDetailSection(page, 'history');
    await expect(
      riskDetailLeafTablist(page, 'register')!.getByRole('tab', { name: 'Auditoria' }),
    ).toHaveCount(0);

    // A stale/guessed `?section=audit` link falls back silently to the
    // first visible section rather than ever disclosing that the section
    // exists (`resolveActiveRiskDetailSection`'s own contract).
    await gotoRiskDetailSection(page, riskDetailUrl, 'audit');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(riskDetailSectionPanel(page, 'overview')).toBeVisible();
    await expect(
      riskDetailGroupTablist(page).getByRole('tab', { name: 'Visão geral', exact: true }),
    ).toHaveAttribute('data-state', 'active');
  });
});
