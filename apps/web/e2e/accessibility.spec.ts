import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import {
  INCIDENT_DETAIL_GROUPS,
  incidentDetailGroupTablist,
  openIncidentDetailSection,
} from './support/incident-detail-sections';
import { selectSeededRootOrgUnit } from './support/org-units';
import {
  openProblemDetailSection,
  PROBLEM_DETAIL_GROUPS,
  problemDetailGroupTablist,
} from './support/problem-detail-sections';
import {
  openRiskDetailSection,
  RISK_DETAIL_GROUPS,
  riskDetailGroupTablist,
  riskDetailLeafTablist,
} from './support/risk-detail-sections';

import type { Page, TestInfo } from '@playwright/test';

/**
 * T203 — accessibility audit and remediation (WCAG 2.1 AA) for the four
 * surfaces named by the task: login, dashboard, risk register and risk
 * detail (every section tab), plus the dialogs reachable from them.
 *
 * Runs `@axe-core/playwright` against the real, running application — never
 * against static markup or a mock — because this project has been
 * repeatedly bitten by things that looked correct and had never been
 * executed (T203's own brief). `axe` is configured against the
 * `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` rule tags, which is the WCAG 2.1
 * AA surface this task targets — not axe's full "best practice" rule set,
 * which includes checks beyond the AA contract.
 *
 * Every scan asserts zero violations at these tags. A finding accepted as
 * "out of surface" or "requires an apps/api change" (see the task report)
 * is never silenced by weakening this assertion — it is excluded by id,
 * named explicitly in a comment pointing at the report, so a real
 * regression on the same page cannot hide behind it.
 *
 * ## Both themes (CLAUDE.md, "this product ships both")
 *
 * `packages/design-system` themes entirely through a `.dark` class on an
 * ancestor element (`packages/design-system/src/styles/globals.css`),
 * applied by `next-themes` (`components/shell/theme-provider.tsx`, F-21 —
 * closed in the wave that added this comment). Each scan below therefore
 * runs twice: once as the app renders with no persisted preference (light —
 * `next-themes`' own `system` default, and this suite's browsers run with no
 * `prefers-color-scheme: dark`), and once via `gotoWithDarkTheme`, which
 * seeds `localStorage`'s persisted theme key to `"dark"` *before* the page's
 * own scripts run, so `ThemeProvider`'s pre-hydration script picks it up and
 * applies `.dark` from the first paint — the real mechanism a returning user
 * with a saved preference goes through, not a DOM hack layered on top of an
 * already-resolved-light load. (An earlier version of this suite added the
 * `.dark` class directly via `page.evaluate` *after* `goto`, which only
 * worked because no `ThemeProvider` existed yet to resolve its own theme and
 * overwrite that class moments later.)
 *
 * ## Serial within this file, but no longer pinned to 1 worker (F-16)
 *
 * Every authenticated scenario shares ONE signed-in account for this
 * worker, signed in once in `beforeAll` via `signInAsWorkerAdmin` — the
 * file stays `mode: 'serial'` internally so that single sign-in is reused
 * rather than repeated. F-16 (`docs/deferred-findings.md`) root-caused the
 * suite's old inability to run with more than one worker to a
 * shared-account password-rotation race, not "load" in the abstract, and
 * fixed it with a pool of worker-private accounts
 * (`support/admin-session.ts`'s `signInAsWorkerAdmin`) — `playwright.config.ts`'s
 * `workers` is now pinned to that pool's size for both CI and local runs.
 */

/**
 * Blocks until no CSS animation or transition is in flight anywhere in the
 * document — a state check, not a fixed sleep.
 *
 * Root cause this exists for: `axe-core`'s color-contrast rule walks the
 * *computed* opacity of an element's ancestors to determine the colour that
 * is actually painted (opacity is a compositing property, so a partially
 * faded ancestor genuinely changes the rendered colour). Playwright's
 * `toBeVisible()` only waits for a non-empty layout box — it does not wait
 * for a CSS transition or animation to reach its end value. So a scan that
 * runs immediately after `toBeVisible()` resolves can sample an element
 * mid-fade and report a violation (or, just as wrongly, a pass) for a
 * colour pair that never appears once the page is at rest. This was proven
 * on the toast: two runs of the same scenario produced two different,
 * neither-in-the-codebase colour pairs — both the correct token pair
 * (`#10754f` on `#effbf6`) linearly blended with the page background at two
 * different opacities of the same 400ms fade.
 *
 * `Element.getAnimations({ subtree: true })` is the browser's own account of
 * every in-flight CSS transition, CSS animation and Web Animations API
 * animation rooted anywhere under the given element — it is what actually
 * drives the opacity axe reads, not an approximation of it. Polling this
 * (via `page.waitForFunction`, which re-evaluates the predicate rather than
 * sleeping a fixed duration) until every animation's `playState` has left
 * `"running"` is therefore a wait for the exact condition axe needs, on
 * whatever timeline the browser actually runs — not a guess at how long a
 * fade "usually" takes. Checked from `document.documentElement` regardless
 * of `includeSelector` below, because the animating node is sometimes an
 * *ancestor* of the region axe is scoped to (the toast's own fade is on the
 * element the scan includes, but nothing here assumes the two always
 * coincide).
 */
async function waitForNoRunningAnimations(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.documentElement
      .getAnimations({ subtree: true })
      .every((animation) => animation.playState !== 'running'),
  );
}

async function runAxe(
  page: Page,
  testInfo: TestInfo,
  disabledRules: string[] = [],
  includeSelector?: string,
): Promise<void> {
  await waitForNoRunningAnimations(page);

  const builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(disabledRules);
  if (includeSelector) {
    builder.include(includeSelector);
  }
  const results = await builder.analyze();

  await testInfo.attach(`axe-results-${testInfo.title.replace(/[^a-z0-9]+/gi, '-')}`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

/**
 * `axe-core`'s own `NodeResult.target` type is `UnlabelledFrameSelector` —
 * a selector that may nest arrays for shadow-DOM/cross-frame piercing, not
 * a flat `string[]` (a real type shape from `axe-core` 4.13, not
 * this project's own choice) — this recurses through that nesting so a
 * violation on an ordinary element still prints as a plain CSS selector.
 */
function targetToText(target: unknown): string {
  if (Array.isArray(target)) {
    return target.map(targetToText).join(' ');
  }
  return String(target);
}

function formatViolations(
  violations: readonly {
    id: string;
    help: string;
    nodes: readonly { target: unknown }[];
  }[],
): string {
  if (violations.length === 0) {
    return 'no violations';
  }
  return violations
    .map((v) => `${v.id} (${v.help}): ${v.nodes.map((n) => targetToText(n.target)).join(', ')}`)
    .join('\n');
}

async function gotoWithDarkTheme(page: Page, path: string): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'dark');
  });
  await page.goto(path);
}

/** `YYYY-MM-DD`, `daysFromNow` days from today — the audit engagement
 * form's own period fields. Local calendar date, never `Date#toISOString()`
 * (`audit-engagement.spec.ts`'s own identical helper: a UTC-based date
 * string off-by-ones in any timezone behind UTC). */
function accessibilityDateOnly(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * F-72 — the file-level `test.describe.configure({ mode: 'serial' })` that
 * used to sit HERE has been moved down into the one block that needs it
 * ("authenticated surfaces"), and this comment is the reason.
 *
 * ## What was measured, not assumed
 *
 * Serial mode is inherited, and a child `describe` cannot opt out of it. When
 * a test in a serial group fails, Playwright walks UP from that test looking
 * for a serial suite and cancels every remaining test in it
 * (`playwright/lib/worker`'s `_skipRemainingTestsInSuite`). With the
 * configuration at file level, that walk always found the FILE, so the
 * cancellation always covered the whole file — the roles block's own
 * `mode: 'default'` changed nothing about it, because `default` describes how
 * the block runs, not which group it belongs to.
 *
 * Proved directly, with a four-test probe on this repository's own Playwright
 * 1.63.0, rather than reasoned from the documentation:
 *
 * | Configuration | Result |
 * |---|---|
 * | `serial` at file level, second block `mode: 'default'` | 1 failed, **3 did not run** — the `default` block included |
 * | `serial` inside the first block only | 1 failed, **1 did not run** — only the failing block's own remainder |
 *
 * That is exactly F-72's 123/1/73: the scan that failed was number 45, and the
 * fourteen `/admin/roles` scans at the bottom of this file were among the 73
 * that never executed, while the terminal said "1 failed".
 *
 * ## Why the authenticated block keeps it
 *
 * Its `beforeAll` drives ~15 real form submissions and every scan in it reads
 * that one fixture; cancelling the remainder when one of them fails is
 * correct, and honest — those tests genuinely cannot report on their subject.
 * What was wrong was extending that verdict to blocks that share nothing with
 * it.
 *
 * The login block needs no ordering at all (each test navigates to `/login`),
 * and the roles block states its own independence where it is declared.
 */

test.describe('Accessibility (WCAG 2.1 AA) — login', () => {
  test('login page has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('login page has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/login');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('login form is fully keyboard operable with a visible focus indicator', async ({ page }) => {
    await page.goto('/login');
    // Not `getByLabel('Senha')`: the reveal-password button's
    // `aria-label="Mostrar senha"` contains "senha" too, so a substring
    // label match resolves 2 elements and strict mode rejects it.
    const passwordField = page.getByRole('textbox', { name: 'Senha', exact: true });
    await page.getByLabel('E-mail').focus();
    await expect(page.getByLabel('E-mail')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(passwordField).toBeFocused();
    // The reveal-password toggle is a real, focusable control and belongs
    // in the tab order — this stop is expected, not a regression to work
    // around.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Mostrar senha' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeFocused();
  });
});

test.describe('Accessibility (WCAG 2.1 AA) — authenticated surfaces', () => {
  /**
   * F-72 — serial belongs to THIS block and no other. Every scan below reads
   * the one fixture `beforeAll` assembles, and reuses one signed-in account
   * for the worker, so ordering is a real requirement here and cancelling the
   * remainder after a failure is the truthful outcome. See the comment above
   * the login block for what moving this line down actually changed.
   */
  test.describe.configure({ mode: 'serial' });

  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to run the authenticated accessibility audit.',
  );

  let riskDetailUrl = '';
  let auditEngagementDetailUrl = '';
  let auditEngagementObjective = '';
  let auditEngagementFindingTitle = '';
  let assetDetailUrl = '';
  let assetName = '';
  let processDetailUrl = '';
  let processName = '';
  // 008-incidents-problems
  let incidentDetailUrl = '';
  let incidentTitle = '';
  let problemDetailUrl = '';
  let problemTitle = '';
  /** The one fixture risk's own title — linked to BOTH the fixture asset
   * and the fixture process below, and reused by their "Riscos vinculados"
   * scans to wait for a real, populated row (F-28). */
  let riskTitleForAssetProcessLinks = '';

  test.beforeAll(async ({ browser }, testInfo) => {
    // Fixture-assembly budget, NOT an accessibility assertion — this line
    // changes no axe scan, no rule, no expectation below. This hook drives
    // ~15 real form submissions through the actual UI (risk, asset,
    // process, two links, evidence, a risk finding, an audit engagement,
    // scope, engagement start, an engagement finding) so every scan below
    // sees populated markup rather than an empty state (F-28, this file's
    // own header comment) — cheaper creation via `page.request` was
    // considered and rejected here because it's exactly this populated
    // markup axe needs to see.
    //
    // Measured on a local dev machine (2026-09-10, single run, warm
    // Chromium, servers already up): total hook time 27.16s against
    // Playwright's 30s default hook timeout — a 9% margin. CI hit the
    // *default* 30s ceiling while still inside the evidence-creation step,
    // a point this same run reached at ~17s locally: CI was already at
    // least ~1.8x slower than this machine by then, before the remaining
    // ~10s of work (finding, audit engagement, scope, start, engagement
    // finding) even began. GitHub Actions runners are commonly 2-4x slower
    // than a developer workstation for browser-driven suites (shared vCPUs,
    // no GPU acceleration, cold caches). 120s is ~4.4x the local measurement
    // — comfortable headroom over a 3x-slowdown estimate (~82s) and still
    // over a 4x one (~109s), while remaining a real ceiling: a genuine hang
    // (backend down, a selector no longer matching) still fails, just not
    // at a threshold this hook is already known to graze.
    // 008-incidents-problems added a fixture Incident AND a fixture Problem
    // below (each linked to the existing fixture risk, plus the problem
    // also linked to the incident) — the same reasoning as every other
    // fixture in this hook (F-28: a populated tab, not an empty one).
    // Raised from 120s accordingly, keeping proportionally the same margin
    // over the local measurement this file's own header already documents.
    // 009-indicators-reports (T065) added five more real steps (one
    // indicator measurement registration plus one full report-creation form
    // submission) — raised again, same proportional margin.
    test.setTimeout(180_000);

    const context = await browser.newContext();
    const page = await context.newPage();
    await signInAsWorkerAdmin(page, testInfo);

    // Create one fixture risk so the detail-page scan below always has a
    // real, populated record to scan (overview, causes/consequences,
    // assessment, controls, treatment, history, audit, attachments,
    // comments) rather than depending on whatever else already exists in a
    // long-lived development database.
    const uniqueSuffix = Date.now().toString(36);
    riskTitleForAssetProcessLinks = `Risco para auditoria de acessibilidade ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await page.getByLabel('Título').fill(riskTitleForAssetProcessLinks);
    await page
      .getByLabel('Descrição')
      .fill(
        'Risco criado pela suíte de acessibilidade (T203) para varredura das seções de detalhe.',
      );
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    // Category is optional to CREATE a draft, but the DRAFT departure
    // transition's own precondition also requires it — set it here (any
    // real option, never the "no category" placeholder) so the lifecycle
    // dialog test below always finds an enabled transition button.
    await page.getByRole('combobox', { name: 'Categoria' }).click();
    await page.getByRole('option').nth(1).click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    riskDetailUrl = page.url();

    // T056/006-assets-processes — one real asset AND one real process, EACH
    // linked to the fixture risk above, so the `/assets`, `/assets/new`,
    // `/assets/[id]` scans below (and the Process equivalents) cover each
    // screen's actually-populated markup — including the asset/process
    // detail's own "Riscos vinculados" tab, which would otherwise show only
    // its honest empty state — rather than certifying markup axe never saw
    // (F-28, this file's own header comment).
    assetName = `Ativo para auditoria de acessibilidade ${uniqueSuffix}`;
    await page.goto('/assets/new');
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    await page.getByLabel('Nome').fill(assetName);
    await page
      .getByLabel('Descrição')
      .fill('Ativo criado pela suíte de acessibilidade (T056) para varredura das telas.');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Cadastrar ativo' }).click();
    await page.waitForURL(/\/assets\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    assetDetailUrl = page.url();

    processName = `Processo para auditoria de acessibilidade ${uniqueSuffix}`;
    await page.goto('/processes/new');
    await expect(page.getByRole('heading', { name: 'Novo processo' })).toBeVisible();
    await page.getByLabel('Nome').fill(processName);
    await page
      .getByLabel('Descrição')
      .fill('Processo criado pela suíte de acessibilidade (T056) para varredura das telas.');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Cadastrar processo' }).click();
    await page.waitForURL(/\/processes\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    processDetailUrl = page.url();

    // Link both to the fixture risk, from the risk's own "Controles" tab —
    // the real UI surface for this link (`risk-controls-section.tsx`).
    //
    // Front H (D-17): the picker is `SearchablePicker` — server-side
    // search as the user types, never a flat unsearched first page. This
    // types each fixture's own (already-unique, timestamp-suffixed) name
    // into the picker's search box before looking for its option, rather
    // than assuming the just-created fixture lands on whatever unsearched
    // page the picker would otherwise show first — the same fix applied to
    // `assets-processes.spec.ts` and `risk-treatment.spec.ts`.
    //
    // The picker's own trigger accessible name is `pickerAriaLabel`
    // ("Selecionar ativo"/"Selecionar processo") — deliberately DIFFERENT
    // from the adjacent button's "Vincular ativo"/"Vincular processo", now
    // that they are two distinct controls (select vs. link), confirmed by
    // rendered inspection against a real worktree build of this component
    // (CLAUDE.md §18.1) rather than assumed from the old `<Select>`'s own
    // shared label.
    await page.goto(riskDetailUrl);
    // 016-risk-detail-experience, R-6: the asset/process pickers moved OUT
    // of "Controles" (which shows only controls now) into their own
    // "Processos e Ativos" leaf under "Relacionamentos".
    await openRiskDetailSection(page, 'processes-assets');
    await page.getByRole('combobox', { name: 'Selecionar ativo' }).click();
    await page.getByPlaceholder('Buscar ativo por nome ou código').fill(assetName);
    const assetOption = page.getByRole('option').filter({ hasText: assetName }).first();
    await expect(assetOption).toBeVisible({ timeout: 10_000 });
    await assetOption.click();
    await page.getByRole('button', { name: 'Vincular ativo' }).click();
    await expect(page.getByText('Ativo vinculado.')).toBeVisible();
    await page.getByRole('combobox', { name: 'Selecionar processo' }).click();
    await page.getByPlaceholder('Buscar processo por nome ou código').fill(processName);
    const processOption = page.getByRole('option').filter({ hasText: processName }).first();
    await expect(processOption).toBeVisible({ timeout: 10_000 });
    await processOption.click();
    await page.getByRole('button', { name: 'Vincular processo' }).click();
    await expect(page.getByText('Processo vinculado.')).toBeVisible();

    // T081/002-shared-grc-foundation — one real evidence AND one real
    // finding, so the two scans below (`Evidência`/`Achados` tabs) cover
    // each panel's actually-populated markup (cards, status badges, row
    // actions) rather than only its empty state — the same reasoning this
    // file's own header already gives for waiting on a rendered chart
    // `<svg>` instead of settling for "the accessible table existed" (F-28).
    await openRiskDetailSection(page, 'evidence');
    await page.getByRole('button', { name: 'Nova evidência' }).click();
    await page
      .getByLabel('Título')
      .fill(`Evidência para auditoria de acessibilidade ${uniqueSuffix}`);
    await page.getByRole('combobox', { name: /Tipo/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Procedência/ }).click();
    await page.getByRole('option').first().click();
    await page
      .getByLabel('Observação', { exact: true })
      .fill('Evidência criada pela suíte de acessibilidade (T081).');
    await page.getByRole('button', { name: 'Registrar e vincular' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await openRiskDetailSection(page, 'findings');
    await page.getByRole('button', { name: 'Novo achado' }).click();
    await page.getByLabel('Título').fill(`Achado para auditoria de acessibilidade ${uniqueSuffix}`);
    await page
      .getByLabel('Descrição')
      .fill('Achado criado pela suíte de acessibilidade (T081) para varredura do painel.');
    await page.getByRole('combobox', { name: /Categoria/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Origem/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Severidade/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Prioridade/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // T085/005-audit-findings — one real audit engagement, WITH a scope
    // entry and a produced finding, so the three scans below (detail's
    // "Visão geral"/"Escopo"/"Achados" tabs) cover each tab's actually
    // populated markup rather than only an empty state — the same
    // reasoning this file's own header gives for the dashboard's charts
    // (F-28): a scan that runs before real content renders can honestly
    // report zero violations of markup it never saw. The engagement is
    // driven all the way to `IN_PROGRESS` specifically so the "Achados" tab
    // has a real row (recording a finding requires it, FR-007).
    auditEngagementObjective = `Engajamento para auditoria de acessibilidade ${uniqueSuffix}`;
    await page.goto('/audits/new');
    await expect(
      page.getByRole('heading', { name: 'Novo engajamento de auditoria' }),
    ).toBeVisible();
    await page.getByLabel('Objetivo').fill(auditEngagementObjective);
    await page.getByLabel('Início do período').fill(accessibilityDateOnly(-7));
    await page.getByLabel('Fim do período').fill(accessibilityDateOnly(90));
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Auditor responsável/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Abrir engajamento' }).click();
    await page.waitForURL(/\/audits\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    auditEngagementDetailUrl = page.url();
    await expect(page.getByRole('heading', { name: auditEngagementObjective })).toBeVisible();

    // Escopo: add one control to scope so the tab's populated table (not
    // only its empty state) is what gets scanned.
    await page.getByRole('tab', { name: 'Escopo' }).click();
    await page.getByRole('tab', { name: 'Controle' }).click();
    await page.getByRole('combobox', { name: 'Controle' }).click();
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByText('Nenhum item no escopo deste engajamento ainda.')).toHaveCount(0);

    // Start the engagement (FR-002/FR-003) so a finding can be recorded.
    // `AuditEngagementLifecycleActions` lives inside the "Visão geral" tab's
    // own content since 91fc4e3 (aligned with every other detail screen,
    // Riscos included, per CLAUDE.md §18.12) — it is no longer above
    // `EntityTabs`. Radix `Tabs.Content` does not mount an inactive panel's
    // children at all, so with "Escopo" still active above, "Iniciar
    // engajamento" is not merely hidden — it is absent from the DOM, and
    // `getByRole` finds zero matches. Return to "Visão geral" first.
    await page.getByRole('tab', { name: 'Visão geral' }).click();
    const startButton = page.getByRole('button', { name: 'Iniciar engajamento' });
    await expect(startButton).toBeVisible({ timeout: 10_000 });
    await expect(startButton).toBeEnabled({ timeout: 10_000 });
    await startButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Iniciar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Em execução', { exact: true })).toBeVisible();

    // Achados: record one finding, from the engagement, so the tab's
    // populated table is what gets scanned.
    auditEngagementFindingTitle = `Achado de engajamento para acessibilidade ${uniqueSuffix}`;
    await page.getByRole('tab', { name: 'Achados' }).click();
    await page.getByRole('button', { name: 'Registrar achado' }).click();
    await page.getByLabel('Título').fill(auditEngagementFindingTitle);
    await page
      .getByLabel('Descrição')
      .fill(
        'Achado registrado pela suíte de acessibilidade (T085) para varredura da aba do engajamento.',
      );
    await page.getByRole('combobox', { name: /Categoria/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Origem/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Severidade/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Prioridade/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(auditEngagementFindingTitle)).toBeVisible();

    // 008-incidents-problems — one real incident AND one real problem, the
    // incident linked to the fixture risk above and the problem linked to
    // BOTH the fixture risk and the fixture incident, so the register,
    // detail-overview and relationship-tab scans below all cover populated
    // markup rather than an empty state (F-28, this file's own header).
    incidentTitle = `Incidente para auditoria de acessibilidade ${uniqueSuffix}`;
    await page.goto('/incidents/new');
    await expect(page.getByRole('heading', { name: 'Novo incidente' })).toBeVisible();
    await page.getByLabel('Título').fill(incidentTitle);
    await page
      .getByLabel('Descrição')
      .fill('Incidente criado pela suíte de acessibilidade (008) para varredura das telas.');
    await page.getByRole('combobox', { name: 'Severidade' }).click();
    await page.getByRole('option', { name: 'Alta' }).click();
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Registrar incidente' }).click();
    await page.waitForURL(/\/incidents\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    incidentDetailUrl = page.url();

    await openIncidentDetailSection(page, 'risks');
    // 018-incident-detail-experience Fase 5 gates the picker behind an
    // intent button sharing the exact accessible name of the real submit
    // button it is replaced by — click it once to reveal the picker.
    await page.getByRole('button', { name: 'Vincular risco' }).click();
    await page.getByRole('combobox', { name: 'Selecionar risco' }).click();
    await page
      .getByPlaceholder('Buscar risco por título ou código')
      .fill(riskTitleForAssetProcessLinks);
    const riskOptionForIncident = page
      .getByRole('option')
      .filter({ hasText: riskTitleForAssetProcessLinks })
      .first();
    await expect(riskOptionForIncident).toBeVisible({ timeout: 10_000 });
    await riskOptionForIncident.click();
    await page.getByRole('button', { name: 'Vincular risco' }).click();
    await expect(page.getByText('Risco vinculado.')).toBeVisible();

    problemTitle = `Problema para auditoria de acessibilidade ${uniqueSuffix}`;
    await page.goto('/problems/new');
    await expect(page.getByRole('heading', { name: 'Novo problema' })).toBeVisible();
    await page.getByLabel('Título').fill(problemTitle);
    await page
      .getByLabel('Descrição')
      .fill('Problema criado pela suíte de acessibilidade (008) para varredura das telas.');
    await page.getByRole('combobox', { name: 'Severidade' }).click();
    await page.getByRole('option', { name: 'Alta' }).click();
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Registrar problema' }).click();
    await page.waitForURL(/\/problems\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    problemDetailUrl = page.url();

    // 019-problem-detail-experience Fase D gates the picker behind an
    // intent button sharing the exact accessible name of the real submit
    // button it is replaced by — click it once to reveal the picker,
    // mirroring the incident fixture setup above.
    await openProblemDetailSection(page, 'risks');
    await page.getByRole('button', { name: 'Vincular risco' }).click();
    await page.getByRole('combobox', { name: 'Selecionar risco' }).click();
    await page
      .getByPlaceholder('Buscar risco por título ou código')
      .fill(riskTitleForAssetProcessLinks);
    const riskOptionForProblem = page
      .getByRole('option')
      .filter({ hasText: riskTitleForAssetProcessLinks })
      .first();
    await expect(riskOptionForProblem).toBeVisible({ timeout: 10_000 });
    await riskOptionForProblem.click();
    await page.getByRole('button', { name: 'Vincular risco' }).click();
    await expect(page.getByText('Risco vinculado.')).toBeVisible();

    await openProblemDetailSection(page, 'incidents');
    await page.getByRole('button', { name: 'Vincular incidente' }).click();
    await page.getByRole('combobox', { name: 'Selecionar incidente' }).click();
    await page.getByPlaceholder('Buscar incidente por código ou título').fill(incidentTitle);
    const incidentOptionForProblem = page
      .getByRole('option')
      .filter({ hasText: incidentTitle })
      .first();
    await expect(incidentOptionForProblem).toBeVisible({ timeout: 10_000 });
    await incidentOptionForProblem.click();
    await page.getByRole('button', { name: 'Vincular incidente' }).click();
    await expect(page.getByText('Incidente vinculado.')).toBeVisible();

    // 009-indicators-reports (T065) — one real indicator measurement AND one
    // real report definition, so the scans below cover each screen's
    // actually-populated markup rather than an empty/never-configured state:
    // the catalog's real computed cards, the detail screen's "Histórico" tab
    // with a real, RENDERED Recharts `<svg>` (F-28's exact shape — an empty
    // `points` array renders `TrendChart`'s dashed empty-state box instead
    // of a chart at all), and the report register/run dialog with a real
    // row and a real computed result.
    //
    // `RISK_TOTAL_BY_LEVEL` ("Riscos por nível") is used for both: it is a
    // `BY_BUCKET` metric with real, non-zero risk data seeded in this
    // database (verified independently before this task: 87 baixo, 1 médio,
    // 0 alto, 43 crítico), so its card, its history chart AND its report
    // item all render actual bars/badges/counts rather than an honestly
    // empty "0 riscos" catalog that would pass axe without proving anything.
    const riskLevelMetricLabel = 'Riscos por nível';
    await page.goto('/indicators/RISK_TOTAL_BY_LEVEL');
    await expect(page.getByRole('heading', { name: riskLevelMetricLabel })).toBeVisible();
    await page.getByRole('tab', { name: 'Histórico' }).click();
    await page.getByRole('button', { name: 'Registrar medição agora' }).click();
    await expect(page.getByText(`Medição de "${riskLevelMetricLabel}" registrada.`)).toBeVisible({
      timeout: 10_000,
    });

    const reportName = `Relatório para auditoria de acessibilidade ${uniqueSuffix}`;
    await page.goto('/reports/new');
    await expect(page.getByRole('heading', { name: 'Novo relatório' })).toBeVisible();
    await page.getByLabel('Nome').fill(reportName);
    await page
      .getByLabel('Descrição')
      .fill('Relatório criado pela suíte de acessibilidade (T061) para varredura das telas.');
    await page.getByLabel(riskLevelMetricLabel).click();
    await page.getByRole('button', { name: 'Criar relatório' }).click();
    await page.waitForURL(/\/reports$/, { timeout: 15_000 });
    await expect(page.getByText(`Relatório "${reportName}" criado.`)).toBeVisible();

    await context.close();
  });

  test.beforeEach(async ({ page }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
  });

  // T198/T199: the dashboard now renders Recharts visualizations
  // (`RiskLevelChart`/`RiskStatusChart`/`TreatmentActionsChart`) alongside a
  // visually-hidden accessible data table for each one. Waiting for one of
  // those chart cards, and asserting its accessible table is actually in
  // the DOM, is what makes this scan cover the charts rather than silently
  // scanning only the page shell if the dashboard's fetch were ever slow,
  // erroring, or the charts were ever accidentally omitted from a future
  // edit of this page.
  //
  // F-28 (docs/deferred-findings.md): the accessible `<table>` mounts
  // BEFORE Recharts' `ResponsiveContainer` finishes measuring itself and
  // paints the chart's actual `<svg>` — so waiting for the table alone let
  // an earlier version of this scan run axe against a dashboard whose
  // charts had not rendered yet, truthfully reporting zero violations of
  // markup it never saw. Waiting for a real, rendered chart `<svg>`
  // (Recharts' own `recharts-surface` class, on every chart's root SVG) is
  // what makes this scan actually cover the charts rather than certify
  // markup it never looked at.
  test('dashboard has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Riscos por nível (residual)')).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Tabela: quantidade de riscos por nível de risco residual' }),
    ).toHaveCount(1);
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('dashboard has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Riscos por nível (residual)')).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Tabela: quantidade de riscos por nível de risco residual' }),
    ).toHaveCount(1);
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible();
    await runAxe(page, testInfo);
  });

  /**
   * ## Why these scans wait for a card, not for the page heading
   *
   * Both register scans used to wait only for the "Registro de riscos"
   * heading — which is rendered by `page.tsx`'s `PageHeader`, OUTSIDE the
   * `<Suspense>` boundary that holds the register itself. It is on screen
   * before `RiskRegisterView` has resolved its first `GET /risks`, so axe
   * ran against the loading skeleton and honestly reported zero violations
   * for a screen whose results, badges, toolbar and pagination did not
   * exist yet.
   *
   * That is the same defect as F-28 (CLAUDE.md §18.1), on a different
   * screen: a scan that measured markup it never looked at. Waiting for a
   * real card — and, in the table case, for a real `<table>` — is what makes
   * these scans cover the thing they are named after.
   *
   * `RiskRegisterEmpty` is the honest fallback: a scope with no risks at all
   * renders that instead of cards, and asserting either one keeps the scan
   * meaningful on an empty database without ever passing on a skeleton.
   */
  async function waitForRegisterContent(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: 'Registro de riscos' })).toBeVisible();
    await expect(
      page
        .getByRole('link', { name: /^Abrir o risco/ })
        .first()
        .or(page.getByText('Nenhum risco cadastrado ainda')),
    ).toBeVisible({ timeout: 15_000 });
  }

  test('risk register has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/risks');
    await waitForRegisterContent(page);
    await runAxe(page, testInfo);
  });

  test('risk register has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/risks');
    await waitForRegisterContent(page);
    await runAxe(page, testInfo);
  });

  /**
   * The filter controls now rest behind a disclosure button, which means
   * every scan above reaches a register whose filters are NOT in the
   * accessible tree at all: `MultiSelectFilter`'s checkbox panels, the user
   * picker's combobox and the two overdue toggles are only rendered once the
   * panel is open. Scanning the register closed and calling the filters
   * covered is precisely the "guard that passes without protecting
   * anything" shape this project keeps paying for (F-28).
   */
  test('risk register filter panel has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/risks');
    await waitForRegisterContent(page);

    const toggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Nível de risco' })).toBeVisible();

    await runAxe(page, testInfo);
  });

  /**
   * A narrow viewport is where the register's controls have to wrap rather
   * than run off the edge of a shell that clips its own overflow — the exact
   * failure mode that hid the Cards/Tabela toggle at 390px while every
   * desktop scan stayed green.
   */
  test('risk register has no axe violations at phone width (light)', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/risks');
    await waitForRegisterContent(page);

    const viewToggle = page.getByRole('radio', { name: 'Ver os riscos em tabela' });
    const box = await viewToggle.boundingBox();
    expect(box, 'the Cards/Tabela toggle must be laid out, not clipped away').not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);

    await runAxe(page, testInfo);
  });

  test('risk register table view has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/risks');
    await waitForRegisterContent(page);
    await page.getByRole('radio', { name: 'Ver os riscos em tabela' }).click();
    await expect(page.getByRole('table', { name: 'Registro de riscos' })).toBeVisible({
      timeout: 15_000,
    });
    await runAxe(page, testInfo);
  });

  // T058/002-shared-grc-foundation, US2 — "Minhas ações", the one new
  // sidebar entry this whole phase adds (R-009).
  test('"Minhas ações" has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/actions');
    await expect(page.getByRole('heading', { name: 'Planos de Ação' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('"Minhas ações" has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/actions');
    await expect(page.getByRole('heading', { name: 'Planos de Ação' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  // `MyActionsFilters` now sits behind the same collapsible "Filtros"
  // disclosure as every other register this wave (CLAUDE.md §18.12) — its
  // status/origin `Select`s and the two checkboxes are absent from the
  // accessible tree while collapsed, so the two scans above never reach
  // them. Mirrors "risk register filter panel has no axe violations" above.
  test('"Minhas ações" filter panel has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/actions');
    await expect(page.getByRole('heading', { name: 'Planos de Ação' })).toBeVisible();

    const toggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible();

    await runAxe(page, testInfo);
  });

  // Toast notification colour contrast — every `feedback.*` call in the
  // product (`FeedbackProvider`, mounted once at the root layout) goes
  // through this one mechanism, so a single pair of scans here guards every
  // screen, not just risk creation.
  //
  // `feedback-provider.tsx` enables `sonner`'s `richColors`, which makes
  // `sonner` apply its OWN hardcoded per-severity palette instead of the
  // design system's tokens — `apps/web/src/components/ui/sonner.tsx`'s
  // `style` block used to set only `--normal-*`, never the `--success-*`/
  // `--warning-*`/`--error-*`/`--info-*` variables `richColors` actually
  // reads. Measured directly against the rendered toast with
  // `@axe-core/playwright` before this fix (light theme, title/description
  // text against the toast's own background): success 4.25:1, warning
  // 3.07:1, error 4.34:1, info 4.35:1 — all below the 4.5:1 normal-text AA
  // threshold (13px, weight 400/500 — never "large text"). Dark mode's own
  // hardcoded values happened to already clear it, which is why only light
  // is asserted below at the reproduction level: fixing colours nothing
  // measured as broken is exactly the kind of unmeasured change CLAUDE.md's
  // process (§14) warns against. The fix itself (`ui/sonner.tsx`) points
  // all eight combinations at the design system's own `--status-*` tokens
  // — already verified ≥4.5:1 in both themes and already what every status
  // pill/badge in the product uses — so this scan covers both themes going
  // forward for the same reason F-28 covers both themes: a regression that
  // only breaks one theme is still a regression.
  //
  // A toast is transient (`TOAST_LIFETIME` in `sonner`'s own source is
  // 4000ms, and it is also user-dismissible) — scanning one needs it
  // actually on screen at the moment `axe` runs, not asserted against
  // markup nothing produced (F-28, this file's own header). Creating a
  // risk is the minimal real production action that calls
  // `feedback.success` (`risk-form.tsx`), so this triggers a genuine toast
  // through the real UI rather than a synthetic one a future refactor of
  // `risk-form.tsx` could stop covering unnoticed — the assertion is scoped
  // to `[data-sonner-toast]` precisely so it stays a toast-contrast guard,
  // not a second copy of the "new risk form" scan already above.
  async function triggerRiskCreationToast(page: Page): Promise<void> {
    await page.goto('/risks/new');
    await page
      .getByLabel('Título')
      .fill(`Risco para verificação de contraste do toast ${Date.now().toString(36)}`);
    await page
      .getByLabel('Descrição')
      .fill(
        'Risco criado pela suíte de acessibilidade para verificar o contraste da notificação (toast).',
      );
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: 'Risco criado como rascunho.' }),
    ).toBeVisible();
  }

  test('toast notification has no axe violations (light)', async ({ page }, testInfo) => {
    await triggerRiskCreationToast(page);
    await runAxe(page, testInfo, [], '[data-sonner-toast]');
  });

  test('toast notification has no axe violations (dark)', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('theme', 'dark');
    });
    await triggerRiskCreationToast(page);
    await runAxe(page, testInfo, [], '[data-sonner-toast]');
  });

  // T085/005-audit-findings — the three new screens this module adds
  // (`/audits`, `/audits/new`, `/audits/[auditId]`). `waitForEngagementRegisterContent`
  // mirrors `waitForRegisterContent` above exactly, for the identical
  // reason (F-28): the register's own `<Suspense>` fallback renders before
  // `AuditEngagementCatalogView` has resolved its first `GET /audits`, so
  // waiting only for the page's own heading would scan a loading skeleton.
  async function waitForEngagementRegisterContent(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: 'Auditoria' })).toBeVisible();
    await expect(
      page
        .getByRole('link', { name: /^Abrir engajamento/ })
        .first()
        .or(page.getByText('Nenhum engajamento de auditoria cadastrado')),
    ).toBeVisible({ timeout: 15_000 });
  }

  test('audit engagement register has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/audits');
    await waitForEngagementRegisterContent(page);
    await runAxe(page, testInfo);
  });

  test('audit engagement register has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/audits');
    await waitForEngagementRegisterContent(page);
    await runAxe(page, testInfo);
  });

  test('new audit engagement form has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/audits/new');
    await expect(
      page.getByRole('heading', { name: 'Novo engajamento de auditoria' }),
    ).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('new audit engagement form has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/audits/new');
    await expect(
      page.getByRole('heading', { name: 'Novo engajamento de auditoria' }),
    ).toBeVisible();
    await runAxe(page, testInfo);
  });

  // The three tabs `beforeAll` populated with real content above (a scope
  // entry, a started engagement, a produced finding) — each scanned in
  // BOTH themes, exercising every tab rather than only the default one
  // (CLAUDE.md §18.1/§18.11).
  const auditEngagementDetailSections = ['Visão geral', 'Escopo', 'Achados'] as const;

  async function waitForAuditEngagementTabContent(
    page: Page,
    section: (typeof auditEngagementDetailSections)[number],
  ): Promise<void> {
    await expect(page.getByRole('heading', { name: auditEngagementObjective })).toBeVisible();
    await page.getByRole('tab', { name: section }).click();
    if (section === 'Escopo') {
      await expect(page.getByText('Nenhum item no escopo deste engajamento ainda.')).toHaveCount(0);
    } else if (section === 'Achados') {
      await expect(page.getByText(auditEngagementFindingTitle)).toBeVisible();
    }
  }

  for (const section of auditEngagementDetailSections) {
    test(`audit engagement detail — "${section}" tab has no axe violations (light)`, async ({
      page,
    }, testInfo) => {
      await page.goto(auditEngagementDetailUrl);
      await waitForAuditEngagementTabContent(page, section);
      await runAxe(page, testInfo);
    });

    test(`audit engagement detail — "${section}" tab has no axe violations (dark)`, async ({
      page,
    }, testInfo) => {
      await gotoWithDarkTheme(page, auditEngagementDetailUrl);
      await waitForAuditEngagementTabContent(page, section);
      await runAxe(page, testInfo);
    });
  }

  /**
   * 016-risk-detail-experience: every leaf section reachable through the
   * two-level navigation EXCEPT "Evidência"/"Achados" (below — they fetch
   * asynchronously and need to wait for real seeded content first, F-28) —
   * scanned through `openRiskDetailSection`, which clicks the parent group
   * tab before the leaf tab, since Radix does not mount a group's own leaf
   * tablist until that group is active.
   *
   * This list used to be a hand-typed `detailSections` array of ten flat tab
   * labels that had ALREADY drifted from the real catalog
   * (`'Causas e consequências'`/`'Planos de ação'`, lower-case, versus the
   * real `'Causas e Consequências'`/`'Planos de Ação'` in `risks.ts`) —
   * silently tolerated only because Playwright's default name-matching is
   * case-insensitive. `openRiskDetailSection` reads labels from the SAME
   * catalog the screen renders from, so that drift cannot recur. It also
   * closes a real coverage gap the pre-016 audit had: "Incidentes" and
   * "Problemas" (added in phase 013) and the new "Processos e Ativos" leaf
   * were never scanned here at all
   * (docs/reviews/risk-detail-capability-inventory.md §7's own "Ausência
   * notável").
   */
  const riskDetailLeafScanIds = [
    'overview',
    'causes-consequences',
    'assessment',
    'controls',
    'treatment',
    'action-plans',
    'processes-assets',
    'incidents',
    'problems',
    'history',
    'audit',
    'attachments',
    'comments',
  ] as const;

  for (const sectionId of riskDetailLeafScanIds) {
    test(`risk detail — "${sectionId}" section has no axe violations (light)`, async ({
      page,
    }, testInfo) => {
      await page.goto(riskDetailUrl);
      await openRiskDetailSection(page, sectionId);
      await runAxe(page, testInfo);
    });
  }

  // T081/002-shared-grc-foundation — `EvidencePanel`/`FindingsPanel` fetch
  // their content asynchronously (`evidenceMessages.panel.loading`/
  // `findingsMessages.panel.loading` render first) — unlike the static
  // `riskDetailLeafScanIds` loop above, each scan here waits for a REAL card
  // from `beforeAll`'s own seeded evidence/finding to be visible before
  // running axe, exactly for the reason this file's own header names for the
  // dashboard's charts (F-28): scanning before real content renders can
  // truthfully report zero violations of markup axe never saw.
  test('risk detail — "Evidência" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(riskDetailUrl);
    await openRiskDetailSection(page, 'evidence');
    await expect(page.getByText('Ativa', { exact: true }).first()).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('risk detail — "Achados" tab has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto(riskDetailUrl);
    await openRiskDetailSection(page, 'findings');
    await expect(page.getByText('Aberto', { exact: true }).first()).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('risk detail — "Visão geral" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, riskDetailUrl);
    await openRiskDetailSection(page, 'overview');
    await runAxe(page, testInfo);
  });

  /**
   * CLAUDE.md §18.11/§19 (via the coordinator's own task brief for this
   * rodada): axe reporting zero violations proves the markup is
   * axe-compliant, never that the NAVIGATION itself is correct — this file's
   * own header already learned that lesson once from the dashboard's charts
   * (F-28). These five scans are the group-level equivalent: every one of
   * the five level-1 navigation areas, in BOTH themes — the "cinco áreas de
   * navegação, nos dois temas" the coordinator's brief asks for — on top of
   * (not instead of) the fifteen leaf-level, light-only scans above.
   * "Visão geral" has no nested leaf tablist (it is the one group with a
   * single section — see `risk-navigation.ts`'s own doc comment), so opening
   * the group IS opening its only section; every other group's default leaf
   * (its first section) is what actually renders once the group tab is
   * clicked.
   */
  for (const group of RISK_DETAIL_GROUPS) {
    test(`risk detail — "${group.label}" navigation area has no axe violations (light)`, async ({
      page,
    }, testInfo) => {
      await page.goto(riskDetailUrl);
      await riskDetailGroupTablist(page)
        .getByRole('tab', { name: group.label, exact: true })
        .click();
      await runAxe(page, testInfo);
    });

    test(`risk detail — "${group.label}" navigation area has no axe violations (dark)`, async ({
      page,
    }, testInfo) => {
      await gotoWithDarkTheme(page, riskDetailUrl);
      await riskDetailGroupTablist(page)
        .getByRole('tab', { name: group.label, exact: true })
        .click();
      await runAxe(page, testInfo);
    });
  }

  /**
   * The two-level navigation's own accessible names (§4.4, R-10): the
   * level-1 tablist is "Grupos de seções do risco"
   * (`risks.detail.groupsAriaLabel`) and each group's own level-2 tablist is
   * "Seções de <rótulo do grupo>" (`risks.detail.sectionsAriaLabel`) — this
   * is what makes `getByRole('tablist', { name })` an unambiguous way to
   * scope a query on this screen (this file's own risk-detail specs already
   * depend on it via `support/risk-detail-sections.ts`), and what a screen
   * reader user hears when moving between the two levels.
   */
  test('risk detail navigation tablists have distinct, correct accessible names', async ({
    page,
  }) => {
    await page.goto(riskDetailUrl);
    await expect(riskDetailGroupTablist(page)).toBeVisible();

    for (const group of RISK_DETAIL_GROUPS) {
      if (group.id === 'overview') {
        continue; // No nested tablist — see this block's own doc comment.
      }
      await riskDetailGroupTablist(page)
        .getByRole('tab', { name: group.label, exact: true })
        .click();
      await expect(riskDetailLeafTablist(page, group.id)!).toBeVisible();
    }
  });

  /**
   * Keyboard operation of BOTH navigation levels (§4.4, R-10 — the semantics
   * of `role="tab"` are preserved at both levels; only the click PATH to a
   * leaf changed). Radix's roving tabindex activates a tab on FOCUS, not on
   * a separate Enter/Space — confirmed by `data-state="active"` moving with
   * focus below, not merely the DOM focus itself moving.
   */
  test('risk detail navigation is keyboard operable at both levels, with focus visible throughout', async ({
    page,
  }) => {
    await page.goto(riskDetailUrl);

    const groupTabs = riskDetailGroupTablist(page).getByRole('tab');
    await groupTabs.first().focus();
    await expect(groupTabs.first()).toBeFocused();
    await expect(groupTabs.first()).toHaveAttribute('data-state', 'active');

    // Level 1: arrow through the five groups.
    await page.keyboard.press('ArrowRight');
    await expect(groupTabs.nth(1)).toBeFocused();
    await expect(groupTabs.nth(1)).toHaveAttribute('data-state', 'active');

    // "Análise" (now focused/active) has a nested leaf tablist. Radix gives
    // an active `TabsContent` its own `tabIndex=0` so panel content is
    // reachable even with no focusable descendant of its own — spot-checked
    // directly (2026-09-16): the FIRST Tab from the group trigger lands on
    // that content wrapper itself (`role="tabpanel"`), not yet on the nested
    // tablist; the SECOND Tab is what reaches the active leaf's own trigger.
    await page.keyboard.press('Tab');
    const analysisPanel = page.getByRole('tabpanel', { name: 'Análise', exact: true });
    await expect(analysisPanel).toBeFocused();

    await page.keyboard.press('Tab');
    const analysisLeafTablist = riskDetailLeafTablist(page, 'analysis')!;
    const assessmentTab = analysisLeafTablist.getByRole('tab', { name: 'Avaliação', exact: true });
    await expect(assessmentTab).toBeFocused();
    await expect(assessmentTab).toHaveAttribute('data-state', 'active');

    // Level 2: arrow to the group's other leaf.
    await page.keyboard.press('ArrowRight');
    const causesTab = analysisLeafTablist.getByRole('tab', {
      name: 'Causas e Consequências',
      exact: true,
    });
    await expect(causesTab).toBeFocused();
    await expect(causesTab).toHaveAttribute('data-state', 'active');
  });

  test('the risk edit form has no axe violations', async ({ page }, testInfo) => {
    await page.goto(riskDetailUrl);
    await page.getByRole('button', { name: 'Editar' }).click();
    await runAxe(page, testInfo);
  });

  // A DRAFT risk (this fixture's own initial state) always exposes at
  // least one lifecycle transition to a Platform Administrator — either
  // "Aplicar: …" (immediate) or "Solicitar aprovação: …" (approval-gated),
  // per `risk-lifecycle-actions.tsx`'s own two-verb convention.
  test('a lifecycle transition dialog traps focus, restores it on close, and has no axe violations', async ({
    page,
  }, testInfo) => {
    await page.goto(riskDetailUrl);
    // Not every listed transition has its preconditions met (rendered
    // `disabled` rather than omitted, so the caller sees what is missing) —
    // `:enabled` picks one this admin can actually open right now.
    const trigger = page
      .getByRole('button', { name: /^(Aplicar|Solicitar aprovação):/ })
      .and(page.locator(':enabled'))
      .first();
    await trigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await runAxe(page, testInfo);

    // Focus trap: the dialog's own close ("Fechar") button, not the page
    // behind it, should be reachable and the trap should keep focus inside
    // the dialog after repeated Tabs (Radix Dialog's own guarantee — this
    // asserts the app did not opt out of it).
    await expect(dialog.getByRole('button', { name: 'Fechar' })).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
    }
    await expect(dialog.locator(':focus')).toHaveCount(1);

    // Focus restoration: closing with Escape returns focus to the trigger.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  // F-17 (docs/deferred-findings.md), closed by T203: a Radix `Select`
  // left its listbox open in Firefox after choosing an option several
  // items down a long list. Root-caused to `apps/web/src/components/ui
  // /select.tsx` overriding shadcn/ui's own `position="popper"` default to
  // `"item-aligned"` — Radix's item-aligned realignment on open interacts
  // badly with Firefox's pointerdown/pointerup pair for a distant item.
  // Fixed by restoring the `"popper"` default. This runs on every project
  // (not Firefox-only) so a regression is caught regardless of which
  // browser next introduces it.
  test('a long Select closes and commits the choice after picking the LAST option, not just the first', async ({
    page,
  }) => {
    await page.goto('/risks/new');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    const options = page.getByRole('option');
    const optionCount = await options.count();
    test.skip(
      optionCount < 3,
      'Fewer than 3 organizational units are seeded — nothing "several items down" to select. Run with SEED_DEV_FIXTURES=true.',
    );
    const lastOption = options.last();
    const lastLabel = (await lastOption.textContent())!.trim();
    await lastOption.click();

    // The defect's own symptom: the listbox stayed open indefinitely.
    await expect(page.getByRole('listbox')).toHaveCount(0);
    // And the choice actually committed, not just the panel closing.
    await expect(page.getByRole('combobox', { name: /Unidade organizacional/ })).toHaveText(
      lastLabel,
    );
  });

  // T056/006-assets-processes — the six new screens this module adds
  // (`/assets`, `/assets/new`, `/assets/[id]` and the Process equivalents),
  // in both themes. `waitForCatalogContent` mirrors
  // `waitForRegisterContent`/`waitForEngagementRegisterContent` above for
  // the loading-skeleton half of F-28: each catalog's own `<Suspense>`
  // fallback renders before its view component has resolved its first
  // `GET /assets`/`GET /processes`, so waiting only for the page's own
  // heading would scan a loading skeleton, not the real cards.
  //
  // Unlike those two siblings, this helper does NOT accept the empty-state
  // text as a substitute for a real card. F-28's own root cause was a scan
  // that honestly reported zero violations because it waited for something
  // that renders before the real content — accepting "Nenhum ativo
  // cadastrado" here is the identical shape: if the catalog were ever
  // empty, this would silently certify the empty state instead of the
  // populated screen T056 was written to verify, and the axe scan would go
  // green without ever having looked at a card. `beforeAll` unconditionally
  // creates one asset and one process before any scan in this describe
  // runs, and the dev database is never empty either, so the catalog is
  // never actually empty in practice — the assertion below should always
  // resolve to the real branch, not fail.
  //
  // Not asserted more strongly than "at least one card": the default sort
  // is `code` ascending (`use-asset-catalog-state.ts` /
  // `use-process-catalog-state.ts`, `DEFAULT_SORT = 'code'`), and codes are
  // assigned by `EntityCodeGeneratorPort.nextCode('AST'|'PRC', year)` —
  // strictly increasing per year. A record `beforeAll` just created gets
  // the highest code of the year, so on an ascending-by-code first page it
  // sorts LAST, not first — asserting the specific fixture card by name
  // would be flaky once the catalog holds more than one page's worth of
  // rows (`DEFAULT_PAGE_SIZE = 25`), which this suite cannot guarantee
  // given the shared dev database and repeated test runs seeding fixtures.
  async function waitForCatalogContent(page: Page, kind: 'ativo' | 'processo'): Promise<void> {
    const heading = kind === 'ativo' ? 'Ativos' : 'Processos';
    const openLabelPrefix = kind === 'ativo' ? 'Abrir ativo' : 'Abrir processo';
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(
      page.getByRole('link', { name: new RegExp(`^${openLabelPrefix}`) }).first(),
    ).toBeVisible({ timeout: 15_000 });
  }

  /**
   * The control catalog had NO axe scan at all — a gap this project's own
   * register diagnosis found, and one that matters more now that Controls
   * is the second consumer of the shared exploration chrome: a violation
   * introduced there would reach every other register too.
   */
  async function waitForControlCatalogContent(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: 'Controles' })).toBeVisible();
    await expect(
      page
        .getByRole('link', { name: /^Abrir o controle/ })
        .first()
        .or(page.getByText('Nenhum controle cadastrado ainda')),
    ).toBeVisible({ timeout: 15_000 });
  }

  test('control catalog has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/controls');
    await waitForControlCatalogContent(page);
    await runAxe(page, testInfo);
  });

  test('control catalog has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/controls');
    await waitForControlCatalogContent(page);
    await runAxe(page, testInfo);
  });

  test('control catalog filter panel has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/controls');
    await waitForControlCatalogContent(page);
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await expect(page.getByRole('button', { name: 'Efetividade' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  /**
   * F-55 (`docs/deferred-findings.md`): the compliance framework register
   * ("Biblioteca normativa") had no axe scan at all — unlike every other
   * business-module register in this suite (Controles, Ativos, Processos,
   * Incidentes, Problemas). Lean coverage, matching this pass's scope: the
   * catalog itself, both themes. The deeper Compliance screens (framework
   * detail, versions, requirements, mapping migrations, applicability) are
   * deliberately NOT scanned here — they sit in the visual-review queue
   * (CLAUDE.md §18.1) and this spec will be extended there, not now.
   */
  async function waitForComplianceCatalogContent(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: 'Biblioteca normativa' })).toBeVisible();
    await expect(
      page
        .getByRole('link', { name: /^Abrir o framework/ })
        .first()
        .or(page.getByText('Nenhum framework cadastrado')),
    ).toBeVisible({ timeout: 15_000 });
  }

  test('compliance framework register has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/compliance');
    await waitForComplianceCatalogContent(page);
    await runAxe(page, testInfo);
  });

  test('compliance framework register has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/compliance');
    await waitForComplianceCatalogContent(page);
    await runAxe(page, testInfo);
  });

  test('asset inventory has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/assets');
    await waitForCatalogContent(page, 'ativo');
    await runAxe(page, testInfo);
  });

  test('asset inventory has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/assets');
    await waitForCatalogContent(page, 'ativo');
    await runAxe(page, testInfo);
  });

  test('new asset form has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/assets/new');
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    // Same exposure `new process form` already waits out (d31e140): the submit button stays
    // disabled and half-opaque until the org units load, and a scan landing mid-transition
    // measures an in-between colour (2.96:1 measured on 2026-09-13) — not a steady state.
    await expect(page.getByRole('button', { name: 'Cadastrar ativo' })).toBeEnabled({
      timeout: 10_000,
    });
    await runAxe(page, testInfo);
  });

  test('new asset form has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/assets/new');
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    // Same exposure `new process form` already waits out (d31e140): the submit button stays
    // disabled and half-opaque until the org units load, and a scan landing mid-transition
    // measures an in-between colour (2.96:1 measured on 2026-09-13) — not a steady state.
    await expect(page.getByRole('button', { name: 'Cadastrar ativo' })).toBeEnabled({
      timeout: 10_000,
    });
    await runAxe(page, testInfo);
  });

  // `beforeAll` links a real risk to this fixture asset, so "Riscos
  // vinculados" scans a populated table, not only its empty state.
  test('asset detail — "Visão geral" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(assetDetailUrl);
    await expect(page.getByRole('heading', { name: assetName })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('asset detail — "Visão geral" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, assetDetailUrl);
    await expect(page.getByRole('heading', { name: assetName })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('asset detail — "Riscos" tab has no axe violations (light)', async ({ page }, testInfo) => {
    // 022-asset-detail-experience Fase A shortened this tab's own label from
    // "Riscos vinculados" to "Riscos" — see `asset-detail-view.tsx`'s own
    // header comment for the measurement behind the change.
    await page.goto(assetDetailUrl);
    await page.getByRole('tab', { name: 'Riscos' }).click();
    await expect(page.getByText(riskTitleForAssetProcessLinks)).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('asset detail — "Controles" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    // 022-asset-detail-experience Fase A shortened this tab's own label from
    // "Controles vinculados" to "Controles" — see the same header comment.
    await page.goto(assetDetailUrl);
    await page.getByRole('tab', { name: 'Controles' }).click();
    await expect(page.getByText('Nenhum controle vinculado a este ativo.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('the asset edit form has no axe violations', async ({ page }, testInfo) => {
    await page.goto(assetDetailUrl);
    await page.getByRole('button', { name: 'Editar' }).click();
    await runAxe(page, testInfo);
  });

  test('process catalog has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/processes');
    await waitForCatalogContent(page, 'processo');
    await runAxe(page, testInfo);
  });

  test('process catalog has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/processes');
    await waitForCatalogContent(page, 'processo');
    await runAxe(page, testInfo);
  });

  // Pre-existing defect found while running this file for T065
  // (009-indicators-reports), unrelated to Indicators/Reports: `ProcessForm`
  // (and `AssetForm`, built to the identical shape) disables its submit
  // button — via Tailwind's `disabled:opacity-50` — until its own
  // reference-data fetch (the org-unit list for the "Unidade organizacional"
  // select) resolves. A scan that runs before that fetch settles catches the
  // button in this transient, translucent state, and in the dark theme the
  // 50%-opacity blend of `--primary`'s own borderline 4.55:1 pair against
  // the page background measures BELOW 4.5:1 — reproduced deterministically
  // (5/5) by reading the button's own `getComputedStyle` immediately after
  // the heading becomes visible: `opacity: "0.5"`, confirming a real
  // `disabled` DOM state, not an animation `waitForNoRunningAnimations`
  // ought to have caught (`getAnimations()` was empty). This is the exact
  // F-28 shape (this file's own header) on a new screen: a scan measuring
  // markup before it finished settling. Waiting for the submit button to
  // become enabled — the same signal the user's own eyes wait for before
  // the form is usable at all — is what makes this scan cover the form's
  // real, interactive state instead of its momentary loading skeleton.
  test('new process form has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/processes/new');
    await expect(page.getByRole('heading', { name: 'Novo processo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar processo' })).toBeEnabled({
      timeout: 10_000,
    });
    await runAxe(page, testInfo);
  });

  test('new process form has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/processes/new');
    await expect(page.getByRole('heading', { name: 'Novo processo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar processo' })).toBeEnabled({
      timeout: 10_000,
    });
    await runAxe(page, testInfo);
  });

  test('process detail — "Visão geral" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(processDetailUrl);
    await expect(page.getByRole('heading', { name: processName })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('process detail — "Visão geral" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, processDetailUrl);
    await expect(page.getByRole('heading', { name: processName })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('process detail — "Riscos vinculados" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(processDetailUrl);
    await page.getByRole('tab', { name: 'Riscos vinculados' }).click();
    await expect(page.getByText(riskTitleForAssetProcessLinks)).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('process detail — "Controles vinculados" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(processDetailUrl);
    await page.getByRole('tab', { name: 'Controles vinculados' }).click();
    await expect(page.getByText('Nenhum controle vinculado a este processo.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('the process edit form has no axe violations', async ({ page }, testInfo) => {
    await page.goto(processDetailUrl);
    await page.getByRole('button', { name: 'Editar' }).click();
    await runAxe(page, testInfo);
  });

  // 008-incidents-problems — the six new screens Incidents/Problems add
  // (`/incidents`, `/incidents/new`, `/incidents/[id]` and the Problem
  // equivalents), in both themes. Both registers now open on the CARD view
  // by default, with a Cards/Tabela toggle (CLAUDE.md §18.12, joined this
  // wave — see the phone-width test below) — so `waitForModuleRegisterContent`
  // waits for a real LINK carrying the fixture's own title (always present
  // per `beforeAll`), which is the card's own stretched link in card view
  // and a row link in table view either way, rather than
  // `waitForCatalogContent`'s card-or-empty-state branch, the same F-28
  // reasoning applied to this module's own markup shape.
  async function waitForModuleRegisterContent(
    page: Page,
    heading: string,
    fixtureTitle: string,
  ): Promise<void> {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByRole('link', { name: fixtureTitle })).toBeVisible({ timeout: 15_000 });
  }

  // Opened already searched for the fixture's own title (`?search=`, the register's real URL
  // state): the default sort is "Reportado em", a DATE, so on a long-lived database with dozens of
  // incidents reported the same day the fixture is not guaranteed a place on the first page —
  // measured on 2026-09-13 with 73 incidents, where an older fixture held the top row instead.
  const incidentRegisterUrl = (): string =>
    `/incidents?search=${encodeURIComponent(incidentTitle)}`;
  const problemRegisterUrl = (): string => `/problems?search=${encodeURIComponent(problemTitle)}`;

  test('incident register has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto(incidentRegisterUrl());
    await waitForModuleRegisterContent(page, 'Incidentes', incidentTitle);
    await runAxe(page, testInfo);
  });

  test('incident register has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, incidentRegisterUrl());
    await waitForModuleRegisterContent(page, 'Incidentes', incidentTitle);
    await runAxe(page, testInfo);
  });

  /**
   * A narrow viewport is where a register's controls have to wrap rather
   * than run off the edge of a shell that clips its own overflow — the exact
   * failure mode the risk register's own "…at phone width" scan above exists
   * to catch (a previously-shipped clipping defect on the Cards/Tabela
   * toggle). Incidentes gained that same toggle only this wave, and nothing
   * had checked it at phone width yet.
   */
  test('incident register has no axe violations at phone width (light)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(incidentRegisterUrl());
    await waitForModuleRegisterContent(page, 'Incidentes', incidentTitle);

    const viewToggle = page.getByRole('radio', { name: 'Visualização em tabela' });
    const box = await viewToggle.boundingBox();
    expect(box, 'the Cards/Tabela toggle must be laid out, not clipped away').not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);

    // Guard for the shared `ToolbarSelect` clipping defect measured today
    // (now fixed — the trigger shrinks and ellipsises instead of
    // overflowing): the Cards/Tabela check above only ever covered ONE
    // control, which is why it stayed green while `SortSelect`'s
    // (`ToolbarSelect`) "Ordenar por" trigger rendered ~14px past the right
    // edge of a shell that clips its own overflow — nothing scrolled, so the
    // control was simply unreachable. This checks EVERY interactive toolbar
    // element on the page, not just the one control a prior scan happened to
    // assert on. Elements inside a `<table>` are excluded deliberately: a
    // wide table is allowed to scroll horizontally inside its own
    // `overflow-x` container (CLAUDE.md §18), so a cell control sitting past
    // x=390 there is the accepted, scrollable case — not this defect.
    const interactiveElements = page.locator('button, input, select, [role="radio"]');
    const interactiveCount = await interactiveElements.count();
    const viewportSize = page.viewportSize();
    expect(
      viewportSize,
      'the 390px viewport must be set for this assertion to mean anything',
    ).not.toBeNull();
    const innerWidth = viewportSize!.width;

    for (let index = 0; index < interactiveCount; index += 1) {
      const element = interactiveElements.nth(index);
      const insideTable = await element.evaluate((node) => node.closest('table') !== null);
      if (insideTable) continue;
      if (!(await element.isVisible())) continue;

      const elementBox = await element.boundingBox();
      if (!elementBox) continue;

      expect(
        elementBox.x,
        `interactive control #${index} (outside any table) must not start left of the 390px viewport`,
      ).toBeGreaterThanOrEqual(-1);
      expect(
        elementBox.x + elementBox.width,
        `interactive control #${index} (outside any table) must not extend past the 390px viewport — ` +
          'the shared ToolbarSelect clipping defect this guard exists to catch',
      ).toBeLessThanOrEqual(innerWidth + 1);
    }

    await runAxe(page, testInfo);
  });

  test('new incident form has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/incidents/new');
    await expect(page.getByRole('heading', { name: 'Novo incidente' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('new incident form has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/incidents/new');
    await expect(page.getByRole('heading', { name: 'Novo incidente' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('incident detail — "Visão geral" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(incidentDetailUrl);
    await expect(page.getByRole('heading', { name: incidentTitle })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('incident detail — "Visão geral" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, incidentDetailUrl);
    await expect(page.getByRole('heading', { name: incidentTitle })).toBeVisible();
    await runAxe(page, testInfo);
  });

  // `beforeAll` links the fixture risk to this incident, so "Riscos" scans a
  // populated table, not only its empty state.
  test('incident detail — "Riscos" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(incidentDetailUrl);
    await openIncidentDetailSection(page, 'risks');
    await expect(page.getByText(riskTitleForAssetProcessLinks)).toBeVisible();
    await runAxe(page, testInfo);
  });

  // 018-incident-detail-experience Fase 4 — editing moved from an inline
  // swap of "Visão geral" to an overlay `Sheet`; this now scans the overlay
  // open ON TOP of the still-rendered (aria-hidden) page behind it, exactly
  // as `risk-detail-view.tsx`'s own edit-panel scan already does.
  test('the incident edit form has no axe violations', async ({ page }, testInfo) => {
    await page.goto(incidentDetailUrl);
    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await runAxe(page, testInfo);
  });

  // CLAUDE.md §19.10 remediation — Evidence/Attachments/Comments were
  // registered against their respective closed-type registries with no
  // reachable interface until now (`IncidentParentRecordAccessor`
  // /`EvidenceSubjectType.INCIDENT`). Both themes, matching the "Visão
  // geral" tab's own coverage above — these are new tabs, not a variant of
  // an already-scanned screen. 018-incident-detail-experience Fase 2+3
  // regrouped all three under "Registro" — `openIncidentDetailSection`
  // clicks that group tab first, then the leaf.
  test('incident detail — "Evidência" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(incidentDetailUrl);
    await openIncidentDetailSection(page, 'evidence');
    await expect(page.getByText('Nenhuma evidência vinculada ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('incident detail — "Evidência" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, incidentDetailUrl);
    await openIncidentDetailSection(page, 'evidence');
    await expect(page.getByText('Nenhuma evidência vinculada ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('incident detail — "Anexos" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(incidentDetailUrl);
    await openIncidentDetailSection(page, 'attachments');
    await expect(page.getByText('Nenhum anexo enviado ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('incident detail — "Anexos" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, incidentDetailUrl);
    await openIncidentDetailSection(page, 'attachments');
    await expect(page.getByText('Nenhum anexo enviado ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('incident detail — "Comentários" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(incidentDetailUrl);
    await openIncidentDetailSection(page, 'comments');
    await expect(page.getByText('Nenhum comentário registrado ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('incident detail — "Comentários" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, incidentDetailUrl);
    await openIncidentDetailSection(page, 'comments');
    await expect(page.getByText('Nenhum comentário registrado ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  /**
   * 018-incident-detail-experience, Fase 6 — the four top-level groups
   * themselves, both themes, mirroring the risk-detail leaf-scan loop above
   * (`riskDetailLeafScanIds`). Distinct from the leaf-level scans above: a
   * group tab click alone lands on that group's FIRST visible leaf (or, for
   * "Visão geral"/"Resposta", the group's own single-leaf content) — this
   * proves the group-level tablist and its default landing content, not a
   * specific populated/empty state.
   */
  for (const group of INCIDENT_DETAIL_GROUPS) {
    test(`incident detail — "${group.label}" group has no axe violations (light)`, async ({
      page,
    }, testInfo) => {
      await page.goto(incidentDetailUrl);
      const groupTab = incidentDetailGroupTablist(page).getByRole('tab', {
        name: group.label,
        exact: true,
      });
      await groupTab.click();
      // A bare `.click()` only waits for the event to dispatch, never for
      // Radix's own re-render to actually swap the tabpanel's content — a
      // `runAxe` called immediately after was observed scanning the
      // PREVIOUS group's still-mounted markup (the "Resposta"/
      // "Relacionamentos"/"Registro" scans all reported "Visão geral"'s own
      // dt/dd nodes). `aria-selected` becoming `"true"` is set in the SAME
      // commit Radix swaps the panel in, so waiting for it is a real
      // content-ready signal, not an arbitrary pause.
      await expect(groupTab).toHaveAttribute('aria-selected', 'true');
      await runAxe(page, testInfo);
    });

    test(`incident detail — "${group.label}" group has no axe violations (dark)`, async ({
      page,
    }, testInfo) => {
      await gotoWithDarkTheme(page, incidentDetailUrl);
      const groupTab = incidentDetailGroupTablist(page).getByRole('tab', {
        name: group.label,
        exact: true,
      });
      await groupTab.click();
      await expect(groupTab).toHaveAttribute('aria-selected', 'true');
      await runAxe(page, testInfo);
    });
  }

  test('problem register has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto(problemRegisterUrl());
    await waitForModuleRegisterContent(page, 'Problemas', problemTitle);
    await runAxe(page, testInfo);
  });

  test('problem register has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, problemRegisterUrl());
    await waitForModuleRegisterContent(page, 'Problemas', problemTitle);
    await runAxe(page, testInfo);
  });

  // Same reasoning as "risk register filter panel has no axe violations"
  // above: `ProblemRegisterFilters`' status/severity `MultiSelectFilter`s
  // are absent from the accessible tree while `FilterBar`'s "Filtros"
  // disclosure is collapsed, so the register scans above never exercise
  // them.
  test('problem register filter panel has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(problemRegisterUrl());
    await waitForModuleRegisterContent(page, 'Problemas', problemTitle);

    const toggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Status' })).toBeVisible();

    await runAxe(page, testInfo);
  });

  test('new problem form has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/problems/new');
    await expect(page.getByRole('heading', { name: 'Novo problema' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('new problem form has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/problems/new');
    await expect(page.getByRole('heading', { name: 'Novo problema' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('problem detail — "Visão geral" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(problemDetailUrl);
    await expect(page.getByRole('heading', { name: problemTitle })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('problem detail — "Visão geral" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, problemDetailUrl);
    await expect(page.getByRole('heading', { name: problemTitle })).toBeVisible();
    await runAxe(page, testInfo);
  });

  // `beforeAll` links both the fixture risk AND the fixture incident to this
  // problem, so both leaves scan populated tables, not only their empty
  // state. 019-problem-detail-experience Fase A regrouped both under
  // "Relacionamentos" (two-level navigation) — `openProblemDetailSection`
  // clicks the group tab first, then the leaf.
  test('problem detail — "Riscos" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(problemDetailUrl);
    await openProblemDetailSection(page, 'risks');
    await expect(page.getByText(riskTitleForAssetProcessLinks)).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('problem detail — "Incidentes" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(problemDetailUrl);
    await openProblemDetailSection(page, 'incidents');
    await expect(page.getByText(incidentTitle)).toBeVisible();
    await runAxe(page, testInfo);
  });

  // 019-problem-detail-experience Fase C — editing moved from an inline
  // swap of "Visão geral" to an overlay `Sheet`; this now scans the overlay
  // open ON TOP of the still-rendered (aria-hidden) page behind it, exactly
  // as the incident edit form scan above does.
  test('the problem edit form has no axe violations', async ({ page }, testInfo) => {
    await page.goto(problemDetailUrl);
    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await runAxe(page, testInfo);
  });

  // CLAUDE.md §19.10 remediation — mirrors the incident detail scans above,
  // for `ProblemParentRecordAccessor`/`EvidenceSubjectType.PROBLEM`.
  test('problem detail — "Evidência" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(problemDetailUrl);
    await openProblemDetailSection(page, 'evidence');
    await expect(page.getByText('Nenhuma evidência vinculada ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('problem detail — "Evidência" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, problemDetailUrl);
    await openProblemDetailSection(page, 'evidence');
    await expect(page.getByText('Nenhuma evidência vinculada ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('problem detail — "Anexos" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(problemDetailUrl);
    await openProblemDetailSection(page, 'attachments');
    await expect(page.getByText('Nenhum anexo enviado ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('problem detail — "Anexos" tab has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, problemDetailUrl);
    await openProblemDetailSection(page, 'attachments');
    await expect(page.getByText('Nenhum anexo enviado ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('problem detail — "Comentários" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(problemDetailUrl);
    await openProblemDetailSection(page, 'comments');
    await expect(page.getByText('Nenhum comentário registrado ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('problem detail — "Comentários" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, problemDetailUrl);
    await openProblemDetailSection(page, 'comments');
    await expect(page.getByText('Nenhum comentário registrado ainda.')).toBeVisible();
    await runAxe(page, testInfo);
  });

  /**
   * 019-problem-detail-experience, Fase E — the four top-level groups
   * themselves, both themes, mirroring the incident-detail group-scan loop
   * above (`INCIDENT_DETAIL_GROUPS`). Distinct from the leaf-level scans
   * above: a group tab click alone lands on that group's FIRST visible leaf
   * (or, for "Visão geral"/"Resposta", the group's own single-leaf
   * content) — this proves the group-level tablist and its default landing
   * content, not a specific populated/empty state. This is also the FIRST
   * scan of "Visão geral" with the contextual aside (Fase C) actually
   * present — the two earlier "Visão geral" scans above predate Fase C in
   * spec history but re-run against the CURRENT screen, so they already
   * cover the aside too; this loop's own "Visão geral" entry is the
   * group-tablist-interaction variant of the same content.
   */
  for (const group of PROBLEM_DETAIL_GROUPS) {
    test(`problem detail — "${group.label}" group has no axe violations (light)`, async ({
      page,
    }, testInfo) => {
      await page.goto(problemDetailUrl);
      const groupTab = problemDetailGroupTablist(page).getByRole('tab', {
        name: group.label,
        exact: true,
      });
      await groupTab.click();
      // A bare `.click()` only waits for the event to dispatch, never for
      // Radix's own re-render to actually swap the tabpanel's content —
      // waiting for `aria-selected` to become `"true"` is a real
      // content-ready signal (set in the same commit as the panel swap),
      // mirroring the incident-detail group loop's identical guard.
      await expect(groupTab).toHaveAttribute('aria-selected', 'true');
      await runAxe(page, testInfo);
    });

    test(`problem detail — "${group.label}" group has no axe violations (dark)`, async ({
      page,
    }, testInfo) => {
      await gotoWithDarkTheme(page, problemDetailUrl);
      const groupTab = problemDetailGroupTablist(page).getByRole('tab', {
        name: group.label,
        exact: true,
      });
      await groupTab.click();
      await expect(groupTab).toHaveAttribute('aria-selected', 'true');
      await runAxe(page, testInfo);
    });
  }

  // `/compliance` (framework register) — this round's own diagnosis: unlike
  // every sibling register in this file, no scan ever existed for this
  // route, so nothing here had ever caught a regression.
  // `waitForFrameworkRegisterContent` mirrors `waitForRegisterContent` above
  // for the identical F-28 reason: `FrameworkListView`'s own `<Suspense>`
  // fallback (in `page.tsx`) renders before the first `GET /frameworks`
  // resolves, so waiting only on the page heading would scan a loading
  // skeleton. No framework fixture is created for this block — a card's own
  // accessible name ("Abrir o framework …") and the honest "Nenhum
  // framework cadastrado" empty state are both real, scannable outcomes, so
  // the wait accepts either branch rather than assuming a populated
  // catalog this suite cannot guarantee.
  async function waitForFrameworkRegisterContent(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: 'Biblioteca normativa' })).toBeVisible();
    await expect(
      page
        .getByRole('link', { name: /^Abrir o framework/ })
        .first()
        .or(page.getByText('Nenhum framework cadastrado')),
    ).toBeVisible({ timeout: 15_000 });
  }

  test('framework register has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/compliance');
    await waitForFrameworkRegisterContent(page);
    await runAxe(page, testInfo);
  });

  test('framework register has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/compliance');
    await waitForFrameworkRegisterContent(page);
    await runAxe(page, testInfo);
  });

  // Same reasoning as "risk register filter panel has no axe violations"
  // above: the origin `MultiSelectFilter` is absent from the accessible
  // tree while `FilterBar`'s "Filtros" disclosure is collapsed, so the two
  // scans above never reach it.
  test('framework register filter panel has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/compliance');
    await waitForFrameworkRegisterContent(page);

    const toggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Origem' })).toBeVisible();

    await runAxe(page, testInfo);
  });

  // 009-indicators-reports (T060/T065) — the indicator catalog and detail
  // screens (`/indicators`, `/indicators/[metricKey]`), in both themes.
  //
  // indicators-round (S1/S2/S3): the catalog was rewritten from eleven
  // independent per-card `GET /indicators/{key}/current` cards into ONE
  // composition over a single batched `GET /dashboard/summary`
  // (`features/indicators/overview/use-indicator-overview.ts`) — the per-card
  // "Atualizado em" footer this suite used to wait for no longer exists at
  // all (every key now shares ONE context-band timestamp,
  // `indicator-overview-context-band.tsx`). `waitForIndicatorOverviewContent`
  // below waits for that band's own "Calculados às" text (rendered only once
  // `useIndicatorOverview`'s `status` reaches `'success'` — `IndicatorOverviewLoading`'s
  // skeleton renders nothing matching it) PLUS one specific, real card's own
  // accessible link name ("Riscos por nível", always present and always
  // readable for this suite's Platform Administrator session) — the same
  // "wait for something that proves the data rendered, not just the page
  // heading" discipline the OLD wait applied (F-28's own lesson), now
  // anchored on the new screen's actual semantics instead of a removed one.
  async function waitForIndicatorOverviewContent(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: 'Indicadores', level: 1 })).toBeVisible();
    await expect(page.getByText(/^Calculados às/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Riscos por nível', exact: true })).toBeVisible();
  }

  test('indicator catalog has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);
    await runAxe(page, testInfo);
  });

  test('indicator catalog has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/indicators');
    await waitForIndicatorOverviewContent(page);
    await runAxe(page, testInfo);
  });

  // indicators-round (S3) — the one real filter dimension this screen has
  // (`indicator-overview-filters.tsx`'s own header: "no collapsible Filtros
  // panel... exactly one real filter dimension") narrowed to a single
  // domain, scanned with its own ARIA `radiogroup` selection state applied —
  // never scanned only in its default, unfiltered shape. `RISK` is used
  // because the closed 11-key catalog fixes it at exactly 2 items
  // (`RISK_TOTAL_BY_LEVEL`/`RISK_TREATMENT_OVERDUE_COUNT`,
  // `indicator-overview-model.ts`'s own `INDICATOR_CATALOG`), so this scan's
  // shape (one wide distribution card + one compact single-value card, both
  // sections rendered) does not depend on any mutable seed data.
  test('indicator catalog has no axe violations with a domain filter applied (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);
    await page.getByRole('radio', { name: 'Riscos (2)' }).click();
    await expect(page.getByRole('radio', { name: 'Riscos (2)' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(
      page.getByRole('link', { name: 'Tratamentos de risco em atraso', exact: true }),
    ).toBeVisible();
    await runAxe(page, testInfo);
  });

  // Phone width — mirrors the risk register's own identical precedent above
  // ("risk register has no axe violations at phone width (light)"): a narrow
  // viewport is where controls have to WRAP rather than run off the edge of
  // a shell that clips its own overflow (the exact defect that hid a
  // register's Cards/Tabela toggle at 390px while every desktop scan stayed
  // green). This screen's own analogous risk is `ViewToggle`'s domain
  // filter, deliberately stretched to wrap up to eleven segments
  // (`indicator-overview-filters.tsx`'s own header) — asserting the search
  // box (present at every width) is laid out, not clipped, is this scan's
  // version of that same check.
  test('indicator catalog has no axe violations at phone width (light)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    const searchBox = page.getByLabel('Buscar indicadores');
    const box = await searchBox.boundingBox();
    expect(box, 'the indicator search box must be laid out, not clipped away').not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);

    await runAxe(page, testInfo);
  });

  // `beforeAll` registered one real measurement for `RISK_TOTAL_BY_LEVEL`
  // ("Riscos por nível"), so both tabs below scan a screen with a real,
  // available value — never the never-configured or forbidden state.
  test('indicator detail — "Visão geral" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/indicators/RISK_TOTAL_BY_LEVEL');
    await expect(page.getByRole('heading', { name: 'Riscos por nível' })).toBeVisible();
    await expect(page.getByText(/^Atualizado em/).first()).toBeVisible({ timeout: 15_000 });
    await runAxe(page, testInfo);
  });

  test('indicator detail — "Visão geral" tab has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, '/indicators/RISK_TOTAL_BY_LEVEL');
    await expect(page.getByRole('heading', { name: 'Riscos por nível' })).toBeVisible();
    await expect(page.getByText(/^Atualizado em/).first()).toBeVisible({ timeout: 15_000 });
    await runAxe(page, testInfo);
  });

  // F-28's exact chart shape, on a new screen: `TrendChart` (`packages/
  // design-system/src/components/trend-chart.tsx`) mounts its
  // visually-hidden accessible `<table>` in the SAME render pass as its
  // Recharts `<svg>` — the component's own header explains why the two
  // cannot drift out of sync with each other — but Recharts'
  // `ResponsiveContainer` still measures itself asynchronously before that
  // `<svg>` paints, AND an empty `points` array renders the component's
  // dashed empty-state box instead of a chart at all. Waiting for the real,
  // rendered `svg.recharts-surface` (not just the tab's own label, and not
  // just the accessible table) is what makes this scan cover an actually
  // rendered chart — the exact gap T057-T059's own §18.11 ressalva left open
  // until a consuming screen existed, and the exact thing an unrendered-chart
  // capture (like the one this task's brief names for Indicators) would
  // never have shown either.
  test('indicator detail — "Histórico" tab has no axe violations, chart rendered (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/indicators/RISK_TOTAL_BY_LEVEL');
    await page.getByRole('tab', { name: 'Histórico' }).click();
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible({ timeout: 15_000 });
    await runAxe(page, testInfo);
  });

  test('indicator detail — "Histórico" tab has no axe violations, chart rendered (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, '/indicators/RISK_TOTAL_BY_LEVEL');
    await page.getByRole('tab', { name: 'Histórico' }).click();
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible({ timeout: 15_000 });
    await runAxe(page, testInfo);
  });

  // 009-indicators-reports (T061/T065) — the report register, creation form
  // and execution dialog (`/reports`, `/reports/new`). `beforeAll`
  // unconditionally creates one real report definition (mirrors the asset/
  // process catalogs' own reasoning above), so the register is never
  // actually empty in practice — but this waits for a real row action
  // (`Executar`), never the fixture's own name by text match: `listReport
  // Definitions` orders by `code asc` (`prisma-report-definition.repository
  // .ts`), so a just-created report — the highest code of the year — sorts
  // LAST, not first, on an ascending first page. That is the identical
  // fragility `waitForCatalogContent` above already documents for Assets/
  // Processes; picking the FIRST real row (whichever one it is) is the safe
  // sibling to that reasoning, not a departure from it.
  async function waitForReportRegisterContent(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Executar' }).first()).toBeVisible({
      timeout: 15_000,
    });
  }

  test('report catalog has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/reports');
    await waitForReportRegisterContent(page);
    await runAxe(page, testInfo);
  });

  test('report catalog has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/reports');
    await waitForReportRegisterContent(page);
    await runAxe(page, testInfo);
  });

  test('new report form has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/reports/new');
    await expect(page.getByRole('heading', { name: 'Novo relatório' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('new report form has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/reports/new');
    await expect(page.getByRole('heading', { name: 'Novo relatório' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  // The run dialog is the one place a report's actual computed result
  // renders — `ReportRunDialog`'s own header: `GET /reports/{id}` is
  // declared in the contract but deliberately not implemented, so this
  // dialog IS the detail surface, opened from a row the register already
  // holds in memory. Waits for the dialog's own "Executado em" timestamp —
  // rendered only once `GET /reports/{id}/run` has resolved with a real
  // result — so the scan covers a populated grid of `MetricCard`s, never the
  // dialog's own loading spinner.
  test('report run dialog has no axe violations, real result rendered (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/reports');
    await waitForReportRegisterContent(page);
    await page.getByRole('button', { name: 'Executar' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/^Executado em/)).toBeVisible({ timeout: 15_000 });
    await runAxe(page, testInfo);
  });

  test('report run dialog has no axe violations, real result rendered (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, '/reports');
    await waitForReportRegisterContent(page);
    await page.getByRole('button', { name: 'Executar' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/^Executado em/)).toBeVisible({ timeout: 15_000 });
    await runAxe(page, testInfo);
  });

  // Relatórios has no text search (`listReportDefinitions` declares no `q`
  // parameter) — `FilterBar`'s no-search collapsible disposition, added this
  // wave, never scanned before now: collapsed, the toggle+chips sit in a
  // slim unboxed row with no card at all; open, the filter controls (just
  // "Situação" here) get their OWN bordered surface. Both are new markup
  // shapes this scan is the first to cover.
  test('report catalog filter panel has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/reports');
    await waitForReportRegisterContent(page);

    const toggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('combobox', { name: 'Situação' })).toBeVisible();

    await runAxe(page, testInfo);
  });

  // The "N indicadores" `PopoverTrigger` in the Métricas column
  // (`report-register-columns.tsx`'s own header) mounts its content only
  // once opened — no existing scan has ever reached it. Opened by keyboard
  // (focus + Enter), never a mouse click, matching how the column's own
  // header comment describes this as a keyboard/AT-reachable disclosure,
  // not a hover-only affordance (CLAUDE.md §18.8).
  //
  // Picks the FIRST row's own trigger — same "whichever one it is" idiom
  // `waitForReportRegisterContent` above already uses — rather than hunting
  // for this file's own fixture report by name: `listReportDefinitions`
  // orders by `code asc`, so a just-created report (the highest code of the
  // year) sorts LAST, not first, and can land past the first page on this
  // long-lived database (measured directly: a first attempt scoped to the
  // fixture's own row timed out waiting for a match that was not on the
  // page). This is safe because EVERY report ever created through the real
  // UI has at least one metric (`form.validation.metricKeys.required`) —
  // `columns.notSet`'s own comment confirms the zero-metric cell "never
  // renders in practice" — so the first row's trigger is always real.
  test('report catalog metrics popover has no axe violations, opened by keyboard (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/reports');
    await waitForReportRegisterContent(page);

    const metricsTrigger = page.getByRole('button', { name: /indicador/ }).first();
    await metricsTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Indicadores incluídos')).toBeVisible();

    await runAxe(page, testInfo);
  });

  // 390px guard for the same shared `ToolbarSelect`/toolbar-control clipping
  // defect `accessibility.spec.ts`'s incident phone-width scan already
  // guards on `/incidents` — every interactive control OUTSIDE the table
  // (the register's own table is allowed to scroll horizontally inside its
  // own `overflow-x` container, CLAUDE.md §18) must stay within the 390px
  // viewport. Reports is this wave's own no-search `FilterBar` disposition,
  // never checked at phone width before now.
  test('report catalog has no axe violations at phone width (light)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/reports');
    await waitForReportRegisterContent(page);

    const interactiveElements = page.locator('button, input, select, [role="radio"]');
    const interactiveCount = await interactiveElements.count();
    const viewportSize = page.viewportSize();
    expect(
      viewportSize,
      'the 390px viewport must be set for this assertion to mean anything',
    ).not.toBeNull();
    const innerWidth = viewportSize!.width;

    for (let index = 0; index < interactiveCount; index += 1) {
      const element = interactiveElements.nth(index);
      const insideTable = await element.evaluate((node) => node.closest('table') !== null);
      if (insideTable) continue;
      if (!(await element.isVisible())) continue;

      const elementBox = await element.boundingBox();
      if (!elementBox) continue;

      expect(
        elementBox.x,
        `interactive control #${index} (outside any table) must not start left of the 390px viewport`,
      ).toBeGreaterThanOrEqual(-1);
      expect(
        elementBox.x + elementBox.width,
        `interactive control #${index} (outside any table) must not extend past the 390px viewport`,
      ).toBeLessThanOrEqual(innerWidth + 1);
    }

    await runAxe(page, testInfo);
  });
});

/**
 * Administração → Papéis e permissões, and its detail/create panels.
 *
 * ## Why this is a describe of its own, and not part of the block above
 *
 * The authenticated-surfaces block shares one `beforeAll` that drives about
 * fifteen real form submissions — a risk, an asset, a process, two links,
 * evidence, two findings, an audit engagement with scope and a start, an
 * incident, a problem, an indicator measurement and a report — so that every
 * scan in it meets populated markup instead of an empty state (F-28). Every
 * scan in it needs that fixture.
 *
 * These scans need NONE of it. The twelve roles they read are seeded, and the
 * one state that needs a role which does not exist yet is composed in the
 * create panel and never submitted.
 *
 * The file used to run `mode: 'serial'`, so until this block moved it sat
 * behind that fixture: a failure anywhere in those fifteen submissions skipped
 * all fourteen scans below with no result at all. That is not hypothetical —
 * it is how this block was measured on WebKit, twice, failing at two DIFFERENT
 * steps of the fixture (a risk picker with no option, then a report creation
 * that never navigated) and reporting "13 did not run" both times. A scan
 * that cannot report on its own subject because someone else's fixture was
 * slow is a scan that is not protecting anything.
 *
 * ## `mode: 'default'` here was necessary and NOT sufficient — F-72
 *
 * Moving this block into its own `describe` with `mode: 'default'` was the
 * right shape and the wrong mechanism: serial is inherited and a child cannot
 * opt out of it, so while the FILE was serial, a failure anywhere in it still
 * cancelled everything after it — including these fourteen. That is precisely
 * what F-72 measured (123 passed / 1 failed / **73 did not run**, these
 * fourteen among them, reported as "1 failed").
 *
 * The actual fix is above this block, not in it: the serial configuration now
 * lives INSIDE the authenticated-surfaces describe rather than at file level,
 * so the cancellation walk stops there. `mode: 'default'` is kept here because
 * it still says the true thing about these scans — they share no state with
 * each other, each navigates and waits for its own content — and because it
 * keeps them in one worker, which is what the `beforeEach` sign-in expects.
 */
test.describe('Accessibility (WCAG 2.1 AA) — roles and permissions', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to run the roles accessibility audit.',
  );

  test.describe.configure({ mode: 'default' });

  test.beforeEach(async ({ page }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
  });

  // 015-roles-permissions-surface (T054) — `/admin/roles` and its detail
  // panel. This block REPLACES the T182 one, which scanned a screen that no
  // longer exists: it waited for `Ver detalhes do papel …` (the old table
  // row's button) and opened a `RoleDetailsDialog`. Both were removed by
  // this phase, so those scans could only have failed — they are rewritten
  // against the real markup rather than renamed.
  //
  // F-28, restated because this block is exactly where the lesson was
  // learnt: every wait below is on an element that exists ONLY once real
  // data has rendered. The platform administrator is a seeded system role,
  // always present whatever custom roles the shared dev database has
  // accumulated, so its own card button is a populated card — never the
  // list's loading skeleton, which renders the same shell markup and would
  // let a scan report zero violations honestly about a screen it never saw.
  //
  // Each scan below is self-contained — it navigates, waits for its own
  // content, and shares no state with the scan before it. Since F-72 that is
  // also enforced by the structure rather than only intended: the serial
  // configuration no longer sits at file level, so a failure elsewhere in this
  // file cannot cancel these.
  //
  // The name below is the pt-BR LABEL the card prints, not the stored
  // `Role.name` (ADR-022). A later phase made seeded roles read in pt-BR
  // while the identifier the seed upserts on stayed English, so these two
  // strings are now different things; waiting on the stored one here would
  // time out on every scan in this block, which is exactly what it did.
  const PLATFORM_ADMINISTRATOR_LABEL = 'Administrador da Plataforma';
  const platformAdministratorCardName = new RegExp(
    `^Abrir detalhes do papel ${PLATFORM_ADMINISTRATOR_LABEL}`,
  );

  async function waitForRoleListContent(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: 'Papéis e permissões' })).toBeVisible();
    await expect(page.getByRole('button', { name: platformAdministratorCardName })).toBeVisible({
      timeout: 15_000,
    });
    // The indicators are a second, independently-loaded request
    // (`GET /admin/roles/summary`). Waiting for them too means the scan
    // covers the whole surface, not the list with four skeletons above it.
    await expect(
      page.getByRole('button', { name: 'Mostrar somente os papéis do sistema' }),
    ).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Opens the panel on the seeded system role and expands every module, so
   * the scan covers the POPULATED permission tree — 70 permissions across
   * 13 modules — rather than the panel chrome with everything collapsed.
   * `DisclosureGroup` unmounts closed content, so an unexpanded panel
   * genuinely has no permission rows in the document to scan.
   */
  async function openPopulatedRolePanel(page: Page): Promise<void> {
    await page.getByRole('button', { name: platformAdministratorCardName }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Permissões concedidas' })).toBeVisible();
    await panel.getByRole('button', { name: 'Expandir todos' }).click();
    await panel.getByRole('button', { name: 'Ver identificadores técnicos' }).click();
    // A real identifier, revealed — the proof the tree is actually open.
    await expect(panel.getByText('risk:view', { exact: true }).first()).toBeVisible();
  }

  test('admin roles list has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/admin/roles');
    await waitForRoleListContent(page);
    await runAxe(page, testInfo);
  });

  test('admin roles list has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/admin/roles');
    await waitForRoleListContent(page);
    await runAxe(page, testInfo);
  });

  test('admin role detail panel, permissions expanded, has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/admin/roles');
    await waitForRoleListContent(page);
    await openPopulatedRolePanel(page);
    await runAxe(page, testInfo);
  });

  test('admin role detail panel, permissions expanded, has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, '/admin/roles');
    await waitForRoleListContent(page);
    await openPopulatedRolePanel(page);
    await runAxe(page, testInfo);
  });

  // The Users tab is a different surface from the Permissions tab: a roster
  // of people, each with a definition list of job title, status, unit and
  // other roles. Scanned with the roster actually loaded — the wait is on a
  // rendered e-mail, not on the tab becoming selected.
  test('admin role Users tab has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/admin/roles');
    await waitForRoleListContent(page);
    await page.getByRole('button', { name: platformAdministratorCardName }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await panel.getByRole('tab', { name: 'Usuários' }).click();
    await expect(panel.getByText(/@/).first()).toBeVisible({ timeout: 15_000 });
    await runAxe(page, testInfo);
  });

  test('admin role Users tab has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/admin/roles');
    await waitForRoleListContent(page);
    await page.getByRole('button', { name: platformAdministratorCardName }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await panel.getByRole('tab', { name: 'Usuários' }).click();
    await expect(panel.getByText(/@/).first()).toBeVisible({ timeout: 15_000 });
    await runAxe(page, testInfo);
  });

  // The definition sheet of a system role is its own surface: the same fields
  // as the editor, all three read-only with their written reasons, and a
  // tri-state checkbox per module reporting `aria-checked="mixed"`. The
  // read-only-versus-disabled choice (FR-031) is a contrast decision, so it is
  // scanned in both themes — `readOnly` keeps full contrast where `disabled`
  // would drop the text to `opacity-50`, which is the whole point of the
  // choice and exactly what an axe contrast rule would catch if it regressed.
  //
  // F-68 (commit `b1632bd`) renamed the way in: a system role no longer offers
  // "Editar papel", because the server refuses every field of one — including
  // the description, including a write of the identical stored value. What it
  // offers instead is "Ver definição". The text asserted below did NOT change,
  // which is the point of asserting it: the reason a reader is given for the
  // lock is the same sentence it always was.
  async function openSystemRoleDefinitionSheet(page: Page): Promise<void> {
    await page.getByRole('button', { name: platformAdministratorCardName }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await panel.getByRole('button', { name: 'Ver definição' }).click();
    await expect(panel.getByText('Papel do sistema: o nome não pode ser alterado.')).toBeVisible();
  }

  test('admin role definition sheet, on a locked system role, has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/admin/roles');
    await waitForRoleListContent(page);
    await openSystemRoleDefinitionSheet(page);
    await runAxe(page, testInfo);
  });

  test('admin role definition sheet, on a locked system role, has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, '/admin/roles');
    await waitForRoleListContent(page);
    await openSystemRoleDefinitionSheet(page);
    await runAxe(page, testInfo);
  });

  // Below `xl` the same panel is a modal overlay (`Sheet`) instead of a grid
  // cell — a different accessibility contract (backdrop, focus trap,
  // `Escape`), and the one `sheet.tsx` had no focus restoration for until
  // this phase ported `useDialogFocusRestore` into it (T001, D-05). Scanned
  // at 390px, the narrowest supported width.
  test('admin role detail overlay at 390px has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/roles');
    await waitForRoleListContent(page);
    await page.getByRole('button', { name: platformAdministratorCardName }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Detalhes do papel' })).toBeVisible();
    await runAxe(page, testInfo);
  });

  // The roster past its FIRST page. `PaginationFooter` renders a different
  // control set once a second page exists and has been reached — "Página
  // anterior" becomes enabled, a different numbered button carries the
  // current page — and none of that is in the two scans above, which only
  // ever see page one. Scanned in both themes because the current-page
  // button's selected state is a contrast decision.
  async function openRosterSecondPage(page: Page): Promise<void> {
    await page.getByRole('button', { name: platformAdministratorCardName }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await panel.getByRole('tab', { name: 'Usuários' }).click();
    await expect(panel.getByText(/@/).first()).toBeVisible({ timeout: 15_000 });
    await panel.getByRole('button', { name: 'Próxima página' }).click();
    // The SECOND page's own summary, not the footer's mere presence: the
    // footer is on screen while page two is still in flight, and a scan that
    // settled for it would be measuring page one again (F-28's lesson, in
    // its pagination costume).
    await expect(panel.getByText(/^11–/)).toBeVisible({ timeout: 15_000 });
  }

  test('admin role Users tab, past the first page, has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/admin/roles');
    await waitForRoleListContent(page);
    await openRosterSecondPage(page);
    await runAxe(page, testInfo);
  });

  test('admin role Users tab, past the first page, has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, '/admin/roles');
    await waitForRoleListContent(page);
    await openRosterSecondPage(page);
    await runAxe(page, testInfo);
  });

  // The create panel is a THIRD disposition of this same shell, built after
  // the block above was written: a form with three required fields, a live
  // requirement list whose state travels in `sr-only` words rather than in
  // colour, and the tri-state module tree.
  //
  // Scanned COMPOSED, never empty. An empty form has none of the three things
  // axe could have anything to say about here — the `role="alert"` validation
  // nodes, a checkbox reporting `aria-checked="mixed"`, and the composition
  // summary's module chips — so a scan of the pristine panel would report
  // zero violations of markup it never saw, which is exactly F-28.
  //
  // Nothing is submitted, so this leaves no role behind and needs no cleanup.
  async function openComposedCreatePanel(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Novo papel' }).click();
    const panel = page.getByRole('complementary', { name: 'Novo papel' });
    await expect(panel).toBeVisible();

    // An empty submit first, so the error state is inside the scanned DOM.
    await panel.getByRole('button', { name: 'Criar papel' }).click();
    await expect(panel.getByText('Informe o nome do papel.')).toBeVisible();

    await panel.getByLabel('Nome').fill('Papel da varredura de acessibilidade');
    await panel
      .getByLabel('Descrição')
      .fill('Composição usada apenas pela varredura; nada é enviado ao servidor.');

    const risks = panel.getByRole('checkbox', {
      name: 'Selecionar todas as permissões de Riscos',
    });
    await expect(risks).toBeVisible({ timeout: 15_000 });
    await risks.click();
    // Open the module and drop one permission, so a control genuinely reports
    // `mixed` in the document being scanned.
    await panel.getByRole('button', { name: /^Riscos/ }).click();
    await panel.locator('label').filter({ hasText: 'risk:view' }).getByRole('checkbox').click();
    await expect(risks).toHaveAttribute('aria-checked', 'mixed');
  }

  test('admin role create panel, composed and showing a validation error, has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/admin/roles');
    await waitForRoleListContent(page);
    await openComposedCreatePanel(page);
    await runAxe(page, testInfo);
  });

  test('admin role create panel, composed and showing a validation error, has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, '/admin/roles');
    await waitForRoleListContent(page);
    await openComposedCreatePanel(page);
    await runAxe(page, testInfo);
  });

  // Keyboard path, and the focus contract of the NON-MODAL panel — which has
  // no Radix underneath it, so nothing would otherwise move focus into it on
  // open or hand focus back on close (`DetailPanel`'s own focus contract;
  // D-15, WCAG SC 2.4.3). The card is a real `<button>`, so focusing it
  // directly is this file's established way of exercising "the user tabs
  // here" without depending on how many focusable elements precede it in a
  // growing list.
  test('admin roles: Enter on the focused card opens the panel, Escape closes it and restores focus', async ({
    page,
  }) => {
    await page.goto('/admin/roles');
    await waitForRoleListContent(page);

    const trigger = page.getByRole('button', { name: platformAdministratorCardName });
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    // Focus moved INTO the panel, rather than staying on the card and
    // leaving a keyboard user to tab through the whole list to reach it.
    await expect(panel).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

/**
 * Administração → Usuários (this round). Brought into the shared register
 * family (CLAUDE.md §18.12) — summary, filters, Cards/Tabela toggle, the
 * "+N" roles overflow popover — all new markup no existing scan has ever
 * reached.
 *
 * Own describe, same reasoning as "roles and permissions" above (that
 * block's own header comment, F-72): these scans need NONE of the
 * fifteen-submission fixture `beforeAll` builds in the authenticated-
 * surfaces block above — every user, and every role assignment they read,
 * is already seeded — so gating them behind that fixture would only cost
 * them a result whenever an unrelated step in it is slow, exactly what
 * F-72 measured and fixed for the roles block.
 *
 * ## Pending: WAIT for a coordinator go before treating these as final
 *
 * A sibling agent is correcting three measured table defects on this same
 * screen while these tests are being written. They are prepared and can
 * run today, but a failure right now could be that in-progress work, not a
 * regression this scan found — do not report a result from this block as
 * final until told the table has been fixed.
 */
test.describe('Accessibility (WCAG 2.1 AA) — administration users', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to run the administration users accessibility audit.',
  );

  test.describe.configure({ mode: 'default' });

  test.beforeEach(async ({ page }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
  });

  // Tabela is this screen's DEFAULT view (`UserAdminView`'s own header —
  // unlike the business registers, an administrative listing of every user
  // is read densely, row by row, not browsed like a risk or a control) —
  // waits for a real row's own action menu, never just the page heading
  // (F-28): the heading renders before `GET /admin/users` resolves. Any
  // row does: `rowActionsLabel` is per-row, not tied to a specific user.
  async function waitForUserAdminTableContent(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ações para/ }).first()).toBeVisible({
      timeout: 15_000,
    });
  }

  test('administration users has no axe violations (light)', async ({ page }, testInfo) => {
    await page.goto('/admin/users');
    await waitForUserAdminTableContent(page);
    await runAxe(page, testInfo);
  });

  test('administration users has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/admin/users');
    await waitForUserAdminTableContent(page);
    await runAxe(page, testInfo);
  });

  // Status / Unidade organizacional / Papel all live behind the "Filtros"
  // disclosure (`UserAdminFilters`'s own header) — the collapsible,
  // WITH-search `FilterBar` disposition (this screen also has a search
  // box), untouched by this wave's no-search fix — so this is the
  // established with-search shape, not new markup this wave introduced,
  // but still never scanned open on THIS screen before now.
  test('administration users filter panel has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/admin/users');
    await waitForUserAdminTableContent(page);

    const toggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Unidade organizacional' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Papel' })).toBeVisible();

    await runAxe(page, testInfo);
  });

  // The "+N" roles `PopoverTrigger` (`UserRoleBadges`'s own header — ONE
  // component shared by the table cell and the card, never two copies)
  // mounts its content only once opened, opened here by keyboard (focus +
  // Enter — CLAUDE.md §18.8, the trigger's own accessible name already
  // states which roles it hides) — no existing scan has ever reached it.
  //
  // `platform.seed.ts` gives every fixture user exactly ONE role ("one
  // user per system role", that file's own header), so no SEEDED user
  // reliably has enough roles to overflow. This searches instead of
  // hard-coding a row position: "AUDIT-A6" is a real, long-lived debris
  // pair in this database (`[AUDIT-A6] User A`/`User B`, 8 roles each —
  // confirmed directly against this run's own database before writing this
  // test), found through the register's own search box exactly as a user
  // would find it.
  test('administration users roles popover has no axe violations, opened by keyboard (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/admin/users');
    await waitForUserAdminTableContent(page);

    await page.getByLabel('Buscar usuários').fill('AUDIT-A6');
    const rolesTrigger = page.getByRole('button', { name: /^Mais \d+ papéis?:/ }).first();
    await expect(rolesTrigger).toBeVisible({ timeout: 10_000 });
    await rolesTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: 'Papéis adicionais' })).toBeVisible();

    await runAxe(page, testInfo);
  });

  // Cards ↔ Tabela (`UserAdminView`'s own header: Tabela is the default
  // here, unlike the business registers where Cards is primary) — never
  // scanned before now. The toggle's accessible name comes straight from
  // `admin.users.view.cardsLabel` (`lib/messages/admin.ts`), read here
  // rather than guessed at.
  test('administration users card view has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/admin/users');
    await waitForUserAdminTableContent(page);

    await page.getByRole('radio', { name: 'Ver os usuários em cards' }).click();
    await expect(page.getByRole('list', { name: 'Usuários' })).toBeVisible({ timeout: 15_000 });

    await runAxe(page, testInfo);
  });

  // Dark theme sibling of the scan above — the card's own role-badge fit
  // logic (a measured, one-line row via a callback ref) is new markup this
  // wave, never scanned in dark before now.
  test('administration users card view has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, '/admin/users');
    await waitForUserAdminTableContent(page);

    await page.getByRole('radio', { name: 'Ver os usuários em cards' }).click();
    await expect(page.getByRole('list', { name: 'Usuários' })).toBeVisible({ timeout: 15_000 });

    await runAxe(page, testInfo);
  });

  // 390px guard for the same shared `ToolbarSelect`/toolbar-control
  // clipping defect the incident and report scans above already guard —
  // every interactive control OUTSIDE the table must stay within the
  // viewport at phone width (the table itself may scroll horizontally
  // inside its own `overflow-x` container, CLAUDE.md §18). This screen's
  // toolbar is the busiest of the three converged this round (sort AND the
  // Cards/Tabela toggle AND a column-visibility menu), never checked at
  // phone width before now.
  test('administration users has no axe violations at phone width (light)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/users');
    await waitForUserAdminTableContent(page);

    const interactiveElements = page.locator('button, input, select, [role="radio"]');
    const interactiveCount = await interactiveElements.count();
    const viewportSize = page.viewportSize();
    expect(
      viewportSize,
      'the 390px viewport must be set for this assertion to mean anything',
    ).not.toBeNull();
    const innerWidth = viewportSize!.width;

    for (let index = 0; index < interactiveCount; index += 1) {
      const element = interactiveElements.nth(index);
      const insideTable = await element.evaluate((node) => node.closest('table') !== null);
      if (insideTable) continue;
      if (!(await element.isVisible())) continue;

      const elementBox = await element.boundingBox();
      if (!elementBox) continue;

      expect(
        elementBox.x,
        `interactive control #${index} (outside any table) must not start left of the 390px viewport`,
      ).toBeGreaterThanOrEqual(-1);
      expect(
        elementBox.x + elementBox.width,
        `interactive control #${index} (outside any table) must not extend past the 390px viewport`,
      ).toBeLessThanOrEqual(innerWidth + 1);
    }

    await runAxe(page, testInfo);
  });
});
