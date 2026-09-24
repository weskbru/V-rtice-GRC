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

function accessibilityDateOnly(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
    const passwordField = page.getByRole('textbox', { name: 'Senha', exact: true });
    await page.getByLabel('E-mail').focus();
    await expect(page.getByLabel('E-mail')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(passwordField).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Mostrar senha' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeFocused();
  });
});

test.describe('Accessibility (WCAG 2.1 AA) — authenticated surfaces', () => {
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
  let incidentDetailUrl = '';
  let incidentTitle = '';
  let problemDetailUrl = '';
  let problemTitle = '';
  let riskTitleForAssetProcessLinks = '';

  test.beforeAll(async ({ browser }, testInfo) => {
    test.setTimeout(180_000);

    const context = await browser.newContext();
    const page = await context.newPage();
    await signInAsWorkerAdmin(page, testInfo);

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
    await page.getByRole('combobox', { name: 'Categoria' }).click();
    await page.getByRole('option').nth(1).click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    riskDetailUrl = page.url();

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

    await page.goto(riskDetailUrl);
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

    await page.getByRole('tab', { name: 'Escopo' }).click();
    await page.getByRole('tab', { name: 'Controle' }).click();
    await page.getByRole('combobox', { name: 'Controle' }).click();
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByText('Nenhum item no escopo deste engajamento ainda.')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Visão geral' }).click();
    const startButton = page.getByRole('button', { name: 'Iniciar engajamento' });
    await expect(startButton).toBeVisible({ timeout: 10_000 });
    await expect(startButton).toBeEnabled({ timeout: 10_000 });
    await startButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Iniciar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Em execução', { exact: true })).toBeVisible();

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

  test('risk detail navigation tablists have distinct, correct accessible names', async ({
    page,
  }) => {
    await page.goto(riskDetailUrl);
    await expect(riskDetailGroupTablist(page)).toBeVisible();

    for (const group of RISK_DETAIL_GROUPS) {
      if (group.id === 'overview') {
        continue;
      }
      await riskDetailGroupTablist(page)
        .getByRole('tab', { name: group.label, exact: true })
        .click();
      await expect(riskDetailLeafTablist(page, group.id)!).toBeVisible();
    }
  });

  test('risk detail navigation is keyboard operable at both levels, with focus visible throughout', async ({
    page,
  }) => {
    await page.goto(riskDetailUrl);

    const groupTabs = riskDetailGroupTablist(page).getByRole('tab');
    await groupTabs.first().focus();
    await expect(groupTabs.first()).toBeFocused();
    await expect(groupTabs.first()).toHaveAttribute('data-state', 'active');

    await page.keyboard.press('ArrowRight');
    await expect(groupTabs.nth(1)).toBeFocused();
    await expect(groupTabs.nth(1)).toHaveAttribute('data-state', 'active');

    await page.keyboard.press('Tab');
    const analysisPanel = page.getByRole('tabpanel', { name: 'Análise', exact: true });
    await expect(analysisPanel).toBeFocused();

    await page.keyboard.press('Tab');
    const analysisLeafTablist = riskDetailLeafTablist(page, 'analysis')!;
    const assessmentTab = analysisLeafTablist.getByRole('tab', { name: 'Avaliação', exact: true });
    await expect(assessmentTab).toBeFocused();
    await expect(assessmentTab).toHaveAttribute('data-state', 'active');

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

  test('a lifecycle transition dialog traps focus, restores it on close, and has no axe violations', async ({
    page,
  }, testInfo) => {
    await page.goto(riskDetailUrl);
    const trigger = page
      .getByRole('button', { name: /^(Aplicar|Solicitar aprovação):/ })
      .and(page.locator(':enabled'))
      .first();
    await trigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await runAxe(page, testInfo);

    await expect(dialog.getByRole('button', { name: 'Fechar' })).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
    }
    await expect(dialog.locator(':focus')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

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

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Unidade organizacional/ })).toHaveText(
      lastLabel,
    );
  });

  async function waitForCatalogContent(page: Page, kind: 'ativo' | 'processo'): Promise<void> {
    const heading = kind === 'ativo' ? 'Ativos' : 'Processos';
    const openLabelPrefix = kind === 'ativo' ? 'Abrir ativo' : 'Abrir processo';
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(
      page.getByRole('link', { name: new RegExp(`^${openLabelPrefix}`) }).first(),
    ).toBeVisible({ timeout: 15_000 });
  }

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
    await expect(page.getByRole('button', { name: 'Cadastrar ativo' })).toBeEnabled({
      timeout: 10_000,
    });
    await runAxe(page, testInfo);
  });

  test('new asset form has no axe violations (dark)', async ({ page }, testInfo) => {
    await gotoWithDarkTheme(page, '/assets/new');
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar ativo' })).toBeEnabled({
      timeout: 10_000,
    });
    await runAxe(page, testInfo);
  });

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
    await page.goto(assetDetailUrl);
    await page.getByRole('tab', { name: 'Riscos' }).click();
    await expect(page.getByText(riskTitleForAssetProcessLinks)).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('asset detail — "Controles" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
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

  async function waitForModuleRegisterContent(
    page: Page,
    heading: string,
    fixtureTitle: string,
  ): Promise<void> {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByRole('link', { name: fixtureTitle })).toBeVisible({ timeout: 15_000 });
  }

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

  test('incident detail — "Riscos" tab has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto(incidentDetailUrl);
    await openIncidentDetailSection(page, 'risks');
    await expect(page.getByText(riskTitleForAssetProcessLinks)).toBeVisible();
    await runAxe(page, testInfo);
  });

  test('the incident edit form has no axe violations', async ({ page }, testInfo) => {
    await page.goto(incidentDetailUrl);
    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await runAxe(page, testInfo);
  });

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

  test('the problem edit form has no axe violations', async ({ page }, testInfo) => {
    await page.goto(problemDetailUrl);
    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await runAxe(page, testInfo);
  });

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

test.describe('Accessibility (WCAG 2.1 AA) — roles and permissions', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to run the roles accessibility audit.',
  );

  test.describe.configure({ mode: 'default' });

  test.beforeEach(async ({ page }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
  });

  const PLATFORM_ADMINISTRATOR_LABEL = 'Administrador da Plataforma';
  const platformAdministratorCardName = new RegExp(
    `^Abrir detalhes do papel ${PLATFORM_ADMINISTRATOR_LABEL}`,
  );

  async function waitForRoleListContent(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: 'Papéis e permissões' })).toBeVisible();
    await expect(page.getByRole('button', { name: platformAdministratorCardName })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('button', { name: 'Mostrar somente os papéis do sistema' }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async function openPopulatedRolePanel(page: Page): Promise<void> {
    await page.getByRole('button', { name: platformAdministratorCardName }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Permissões concedidas' })).toBeVisible();
    await panel.getByRole('button', { name: 'Expandir todos' }).click();
    await panel.getByRole('button', { name: 'Ver identificadores técnicos' }).click();
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

  async function openRosterSecondPage(page: Page): Promise<void> {
    await page.getByRole('button', { name: platformAdministratorCardName }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await panel.getByRole('tab', { name: 'Usuários' }).click();
    await expect(panel.getByText(/@/).first()).toBeVisible({ timeout: 15_000 });
    await panel.getByRole('button', { name: 'Próxima página' }).click();
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

  async function openComposedCreatePanel(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Novo papel' }).click();
    const panel = page.getByRole('complementary', { name: 'Novo papel' });
    await expect(panel).toBeVisible();

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
    await expect(panel).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe('Accessibility (WCAG 2.1 AA) — administration users', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to run the administration users accessibility audit.',
  );

  test.describe.configure({ mode: 'default' });

  test.beforeEach(async ({ page }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
  });

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

  test('administration users card view has no axe violations (light)', async ({
    page,
  }, testInfo) => {
    await page.goto('/admin/users');
    await waitForUserAdminTableContent(page);

    await page.getByRole('radio', { name: 'Ver os usuários em cards' }).click();
    await expect(page.getByRole('list', { name: 'Usuários' })).toBeVisible({ timeout: 15_000 });

    await runAxe(page, testInfo);
  });

  test('administration users card view has no axe violations (dark)', async ({
    page,
  }, testInfo) => {
    await gotoWithDarkTheme(page, '/admin/users');
    await waitForUserAdminTableContent(page);

    await page.getByRole('radio', { name: 'Ver os usuários em cards' }).click();
    await expect(page.getByRole('list', { name: 'Usuários' })).toBeVisible({ timeout: 15_000 });

    await runAxe(page, testInfo);
  });

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
