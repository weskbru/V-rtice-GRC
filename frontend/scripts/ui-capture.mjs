import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2] ?? 'docs/reviews/ui/baseline';
const args = process.argv.slice(3);
const arg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:3000';
const EMAIL = process.env.SEED_ADMIN_EMAIL;
const BASE_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
if (!EMAIL || !BASE_PASSWORD) {
  throw new Error(
    'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required to capture authenticated screens.',
  );
}
const theme = arg('theme', 'light');
const width = Number(arg('width', '1440'));
const surface = arg('surface', 'full');
const height = Number(
  arg(
    'height',
    surface === 'roles'
      ? '2400'
      : surface === 'risk-detail' || surface === 'incident-detail' || surface === 'problem-detail'
        ? '2200'
        : '900',
  ),
);
const widths = arg('widths', '1920,1440,1280,1024,768,390')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);

const PASSWORDS = [`${BASE_PASSWORD}-E2E-1`, BASE_PASSWORD];

async function signIn(page) {
  for (const password of PASSWORDS) {
    await page.goto(`${ORIGIN}/login`, { waitUntil: 'networkidle' });
    await page.getByLabel('E-mail').fill(EMAIL);
    await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    try {
      await page.waitForURL(/\/(profile|dashboard)/, { timeout: 30_000 });
      return true;
    } catch {}
  }
  throw new Error('sign-in failed with both the seeded and the rotated password');
}

async function shoot(page, name, dir = outDir) {
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ${name}`);
}

async function followLink(page, locator) {
  const href = await locator.getAttribute('href');
  if (!href) throw new Error('followLink: locator has no href');
  await page.goto(`${ORIGIN}${href}`, { waitUntil: 'networkidle' });
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  colorScheme: 'light',
  locale: 'pt-BR',
});
await context.addInitScript({
  content: `(() => {
    const hide = () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal{display:none !important}';
      document.head.appendChild(style);
    };
    if (document.head) hide();
    else document.addEventListener('DOMContentLoaded', hide);
  })();`,
});

const page = await context.newPage();
page.on('pageerror', (err) => console.log('  [PAGEERROR]', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('  [CONSOLE ERROR]', msg.text());
});

if (surface === 'full') {
  await mkdir(outDir, { recursive: true });
  console.log(`capturing -> ${outDir} (${theme}, ${width}x${height})`);

  await page.goto(`${ORIGIN}/login`, { waitUntil: 'networkidle' });
  await shoot(page, '01-login');
} else {
  console.log(`capturing -> ${outDir}-${theme}-<width> (${surface}, ${theme})`);
}

await signIn(page);

if (theme === 'dark') {
  await page.getByRole('button', { name: 'Alternar entre tema claro e escuro' }).click();
  await page.waitForFunction('document.documentElement.classList.contains("dark")');
}

async function captureRolesSurface() {
  const PLATFORM_ADMIN_LABEL = 'Administrador da Plataforma';
  const seededCard = new RegExp(`^Abrir detalhes do papel ${PLATFORM_ADMIN_LABEL}`);

  const customRoleName = `Analista de Riscos e Controles (captura ${theme})`;
  const created = await page.request.post(`${ORIGIN}/api/v1/admin/roles`, {
    headers: { Origin: ORIGIN },
    data: {
      name: customRoleName,
      description:
        'Papel temporário da captura renderizada: acompanha riscos e verifica os controles que os tratam.',
      permissionIdentifiers: ['risk:view', 'risk:assess', 'control:view'],
    },
  });
  if (!created.ok()) {
    throw new Error(
      `could not create the capture's custom role: ${String(created.status())} ${await created.text()}`,
    );
  }
  const customRoleId = (await created.json()).id;
  console.log(`  [setup] custom role ${customRoleId} created`);

  async function closePanel() {
    await page.keyboard.press('Escape');
    await page
      .getByRole('complementary', { name: 'Detalhes do papel' })
      .waitFor({ state: 'hidden' });
  }

  let captureError = null;
  try {
    for (const w of widths) {
      const dir = `${outDir}-${theme}-${w}`;
      await mkdir(dir, { recursive: true });
      console.log(`capturing -> ${dir}`);
      await page.setViewportSize({ width: w, height });

      await page.goto(`${ORIGIN}/admin/roles`, { waitUntil: 'networkidle' });
      const card = page.getByRole('button', { name: seededCard });
      await card.waitFor({ state: 'visible', timeout: 30_000 });
      const systemIndicator = page.getByRole('button', {
        name: 'Mostrar somente os papéis do sistema',
      });
      await systemIndicator.waitFor({ state: 'visible', timeout: 30_000 });
      await shoot(page, '01-list', dir);

      const filtersToggle = page.getByRole('button', { name: /^Filtros/ });
      await filtersToggle.click();
      await page.waitForTimeout(250);
      await shoot(page, '02-filters-open', dir);

      await systemIndicator.click();
      await page.waitForTimeout(250);
      await filtersToggle.click();
      await page.waitForTimeout(250);
      await shoot(page, '03-filter-applied', dir);

      await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
      await page.getByLabel('Buscar papéis').fill('zzz-nenhum-papel-com-este-nome-zzz');
      await page.getByText('Nenhum papel encontrado').waitFor({ state: 'visible' });
      await shoot(page, '04-empty-filtered', dir);
      await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
      await card.waitFor({ state: 'visible' });

      await card.click();
      const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
      await panel.waitFor({ state: 'visible' });
      await page.waitForTimeout(400);
      await shoot(page, '05-panel-open-selected-card', dir);

      await panel.getByRole('button', { name: 'Expandir todos' }).click();
      await page.waitForTimeout(300);
      await shoot(page, '06-modules-expanded', dir);

      await panel.getByRole('button', { name: 'Ver identificadores técnicos' }).click();
      await panel.getByText('Nome técnico:').waitFor({ state: 'visible' });
      await shoot(page, '07-identifiers-visible', dir);

      await panel.getByRole('tab', { name: 'Usuários' }).click();
      await panel.getByText(/@/).first().waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(300);
      await shoot(page, '08-users-tab-page-1', dir);

      await panel.getByRole('button', { name: 'Próxima página' }).click();
      await panel.getByText(/^11–/).waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(300);
      await shoot(page, '09-users-tab-page-2', dir);

      await panel.getByRole('tab', { name: 'Permissões' }).click();
      await panel.getByRole('button', { name: 'Ver definição' }).click();
      await panel
        .getByText('Papel do sistema: o nome não pode ser alterado.')
        .waitFor({ state: 'visible' });
      await shoot(page, '10-edit-system-locked', dir);
      await panel.getByRole('button', { name: 'Voltar' }).click();
      await panel.getByRole('button', { name: 'Ver definição' }).waitFor({ state: 'visible' });
      await closePanel();

      await page.getByLabel('Buscar papéis').fill(customRoleName);
      const customCard = page.getByRole('button', {
        name: new RegExp(`^Abrir detalhes do papel ${customRoleName.replace(/[()]/g, '\\$&')}`),
      });
      await customCard.waitFor({ state: 'visible', timeout: 30_000 });
      await customCard.click();
      await panel.waitFor({ state: 'visible' });
      await page.waitForTimeout(400);
      await shoot(page, '11-panel-custom-role', dir);

      await panel.getByRole('tab', { name: 'Usuários' }).click();
      await panel
        .getByText('Nenhuma pessoa tem este papel.')
        .waitFor({ state: 'visible', timeout: 30_000 });
      await shoot(page, '12-users-tab-empty', dir);
      await panel.getByRole('tab', { name: 'Permissões' }).click();

      await panel.getByRole('button', { name: 'Editar papel' }).click();
      const controlsModule = panel.getByRole('checkbox', {
        name: 'Selecionar todas as permissões de Controles',
      });
      await controlsModule.waitFor({ state: 'visible', timeout: 30_000 });
      await controlsModule.click();
      await page.waitForTimeout(300);
      await shoot(page, '13-edit-custom-pending-diff', dir);

      await panel.getByRole('button', { name: 'Cancelar' }).click();
      await page.waitForTimeout(300);
      await shoot(page, '14-edit-cancel-confirm', dir);
      await page.getByRole('button', { name: 'Descartar alterações' }).click();
      await page.waitForTimeout(300);
      await closePanel();
      await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
      await card.waitFor({ state: 'visible' });

      await page.getByRole('button', { name: 'Novo papel' }).click();
      const createPanel = page.getByRole('complementary', { name: 'Novo papel' });
      await createPanel.waitFor({ state: 'visible' });
      await page.waitForTimeout(400);
      await shoot(page, '15-create-panel-empty', dir);

      await createPanel.getByRole('button', { name: 'Criar papel' }).click();
      await createPanel.getByText('Informe o nome do papel.').waitFor({ state: 'visible' });
      await shoot(page, '16-create-panel-validation', dir);

      await createPanel.getByLabel('Nome').fill('Revisor de continuidade');
      await createPanel
        .getByLabel('Descrição')
        .fill('Acompanha os planos de continuidade e verifica as evidências de teste.');
      const risksModule = createPanel.getByRole('checkbox', {
        name: 'Selecionar todas as permissões de Riscos',
      });
      await risksModule.waitFor({ state: 'visible', timeout: 30_000 });
      await risksModule.click();
      await page.waitForTimeout(300);
      await shoot(page, '17-create-panel-composed', dir);

      await createPanel.getByRole('button', { name: 'Cancelar' }).click();
      await page.getByRole('button', { name: 'Descartar', exact: true }).click();
      await createPanel.waitFor({ state: 'hidden' });

      await page.route('**/api/v1/admin/roles?*', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://verticegrc.dev/problems/http-500',
            title: 'Erro interno',
            status: 500,
            detail: 'Falha simulada pela captura renderizada.',
            instance: '/api/v1/admin/roles',
            correlationId: '00000000-0000-4000-8000-000000000000',
          }),
        }),
      );
      await page.goto(`${ORIGIN}/admin/roles`, { waitUntil: 'networkidle' });
      await page.getByText('Não foi possível carregar os papéis', { exact: true }).waitFor({
        state: 'visible',
        timeout: 30_000,
      });
      await shoot(page, '18-error-state', dir);
      await page.unroute('**/api/v1/admin/roles?*');
    }
  } catch (error) {
    captureError = error;
  }

  const cleanupError = await deleteCaptureRole(customRoleId);
  if (captureError) throw captureError;
  if (cleanupError) throw cleanupError;
}

async function deleteCaptureRole(roleId) {
  try {
    const deleted = await page.request.delete(`${ORIGIN}/api/v1/admin/roles/${roleId}`, {
      headers: { Origin: ORIGIN },
    });
    if (!deleted.ok()) {
      return new Error(
        `the capture's custom role ${roleId} was NOT deleted: ` +
          `${String(deleted.status())} ${await deleted.text()}`,
      );
    }
    const after = await page.request.get(`${ORIGIN}/api/v1/admin/roles/${roleId}`);
    if (after.status() !== 404) {
      return new Error(
        `the capture's custom role ${roleId} still resolves after DELETE ` +
          `(${String(after.status())}) — this run would leave a fixture role in the database.`,
      );
    }
    console.log(`  [cleanup] custom role ${roleId} deleted, verified absent`);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

async function captureRiskDetailSurface() {
  const pinnedRiskId = arg('riskId', null);
  let riskDetailUrl;

  if (pinnedRiskId) {
    riskDetailUrl = `${ORIGIN}/risks/${pinnedRiskId}`;
    await page.goto(riskDetailUrl, { waitUntil: 'networkidle' });
    if (!(await page.getByRole('heading', { level: 1 }).count())) {
      throw new Error(
        `--surface=risk-detail --riskId=${pinnedRiskId} did not land on a risk detail page — ` +
          'check the id and that this signed-in identity can see it (organizational scope).',
      );
    }
  } else {
    await page.goto(`${ORIGIN}/risks`, { waitUntil: 'networkidle' });
    const firstRisk = page.getByRole('link', { name: /^RSK-/ }).first();
    if (!(await firstRisk.count())) {
      throw new Error(
        '--surface=risk-detail found no risk under /risks to capture. Seed at least one risk ' +
          '(ideally assessed, with a treatment decision and some linked controls/processes/assets) ' +
          'before running this mode — a capture with nothing real to show defeats its own purpose ' +
          '(CLAUDE.md §18.1). Or pass --riskId=<uuid> to pin a specific one.',
      );
    }
    await firstRisk.click();
    await page.waitForURL(/\/risks\/[0-9a-f-]+/, { timeout: 15_000 });
    riskDetailUrl = page.url();
  }

  const LEAVES = [
    ['01-visao-geral', 'overview', 'Visão geral', null],
    ['02-analise-avaliacao', 'assessment', 'Análise', 'Avaliação'],
    ['03-analise-causas-consequencias', 'causes-consequences', 'Análise', 'Causas e Consequências'],
    ['04-resposta-tratamento', 'treatment', 'Resposta', 'Tratamento'],
    ['05-resposta-planos-de-acao', 'action-plans', 'Resposta', 'Planos de Ação'],
    ['06-relacionamentos-achados', 'findings', 'Relacionamentos', 'Achados'],
  ];

  async function waitForLeafActive(groupLabel, leafLabel) {
    const groupTablist = page.getByRole('tablist', { name: 'Grupos de seções do risco' });
    const groupTab = groupTablist.getByRole('tab', { name: groupLabel, exact: true });
    try {
      await groupTab.waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      return false;
    }
    if (leafLabel === null) {
      return true;
    }
    const leafTablist = page.getByRole('tablist', { name: `Seções de ${groupLabel}` });
    const leafTab = leafTablist.getByRole('tab', { name: leafLabel, exact: true, selected: true });
    try {
      await leafTab.waitFor({ state: 'visible', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  for (const w of widths) {
    const dir = `${outDir}-${theme}-${w}`;
    await mkdir(dir, { recursive: true });
    console.log(`capturing -> ${dir}`);
    await page.setViewportSize({ width: w, height });

    for (const [name, sectionId, groupLabel, leafLabel] of LEAVES) {
      await page.goto(`${riskDetailUrl}?section=${sectionId}`, { waitUntil: 'networkidle' });
      const landed = await waitForLeafActive(groupLabel, leafLabel);
      if (!landed) {
        console.log(
          `  [skip] ${name} — "${leafLabel ?? groupLabel}" never became the active section ` +
            '(likely missing for this signed-in identity — e.g. Achados without finding:view).',
        );
        continue;
      }
      await page.waitForTimeout(500);

      const contentHeight = await page.evaluate(
        "document.querySelector('main')?.scrollHeight ?? document.body.scrollHeight",
      );
      const shotHeight = Math.max(height, contentHeight + 40);
      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height: shotHeight });
      }

      await shoot(page, name, dir);

      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height });
      }
    }
  }
}

async function captureIncidentDetailSurface() {
  const pinnedIncidentId = arg('incidentId', null);
  let incidentDetailUrl;

  if (pinnedIncidentId) {
    incidentDetailUrl = `${ORIGIN}/incidents/${pinnedIncidentId}`;
    await page.goto(incidentDetailUrl, { waitUntil: 'networkidle' });
    if (!(await page.getByRole('heading', { level: 1 }).count())) {
      throw new Error(
        `--surface=incident-detail --incidentId=${pinnedIncidentId} did not land on an incident ` +
          'detail page — check the id and that this signed-in identity can see it (organizational scope).',
      );
    }
  } else {
    await page.goto(`${ORIGIN}/incidents`, { waitUntil: 'networkidle' });
    const firstIncident = page.getByRole('link', { name: /^INC-/ }).first();
    if (!(await firstIncident.count())) {
      throw new Error(
        '--surface=incident-detail found no incident under /incidents to capture. Seed at least ' +
          'one incident (ideally with linked risks/assets/processes and a non-OPEN status) before ' +
          'running this mode — a capture with nothing real to show defeats its own purpose ' +
          '(CLAUDE.md §18.1). Or pass --incidentId=<uuid> to pin a specific one.',
      );
    }
    await firstIncident.click();
    await page.waitForURL(/\/incidents\/[0-9a-f-]+/, { timeout: 15_000 });
    incidentDetailUrl = page.url();
  }

  const GROUPS = [
    ['01-visao-geral', 'overview', 'Visão geral', null],
    ['02-resposta', 'corrective-actions', 'Resposta', null],
    ['03-relacionamentos-riscos', 'risks', 'Relacionamentos', 'Riscos'],
    ['04-registro-evidencia', 'evidence', 'Registro', 'Evidência'],
  ];

  async function waitForLeafActive(groupLabel, leafLabel) {
    const groupTablist = page.getByRole('tablist', { name: 'Grupos de seções do incidente' });
    const groupTab = groupTablist.getByRole('tab', { name: groupLabel, exact: true });
    try {
      await groupTab.waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      return false;
    }
    if (leafLabel === null) {
      return true;
    }
    const leafTablist = page.getByRole('tablist', { name: `Seções de ${groupLabel}` });
    const leafTab = leafTablist.getByRole('tab', { name: leafLabel, exact: true, selected: true });
    try {
      await leafTab.waitFor({ state: 'visible', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  for (const w of widths) {
    const dir = `${outDir}-${theme}-${w}`;
    await mkdir(dir, { recursive: true });
    console.log(`capturing -> ${dir}`);
    await page.setViewportSize({ width: w, height });

    for (const [name, sectionId, groupLabel, leafLabel] of GROUPS) {
      await page.goto(`${incidentDetailUrl}?section=${sectionId}`, { waitUntil: 'networkidle' });
      const landed = await waitForLeafActive(groupLabel, leafLabel);
      if (!landed) {
        console.log(
          `  [skip] ${name} — "${leafLabel ?? groupLabel}" never became the active section ` +
            '(likely missing for this signed-in identity).',
        );
        continue;
      }
      await page.waitForTimeout(500);

      const contentHeight = await page.evaluate(
        "document.querySelector('main')?.scrollHeight ?? document.body.scrollHeight",
      );
      const shotHeight = Math.max(height, contentHeight + 40);
      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height: shotHeight });
      }

      await shoot(page, name, dir);

      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height });
      }
    }
  }
}

async function captureProblemDetailSurface() {
  const pinnedProblemId = arg('problemId', null);
  let problemDetailUrl;

  if (pinnedProblemId) {
    problemDetailUrl = `${ORIGIN}/problems/${pinnedProblemId}`;
    await page.goto(problemDetailUrl, { waitUntil: 'networkidle' });
    if (!(await page.getByRole('heading', { level: 1 }).count())) {
      throw new Error(
        `--surface=problem-detail --problemId=${pinnedProblemId} did not land on a problem ` +
          'detail page — check the id and that this signed-in identity can see it (organizational scope).',
      );
    }
  } else {
    await page.goto(`${ORIGIN}/problems`, { waitUntil: 'networkidle' });
    const firstProblem = page.getByRole('link', { name: /^PRB-/ }).first();
    if (!(await firstProblem.count())) {
      throw new Error(
        '--surface=problem-detail found no problem under /problems to capture. Seed at least ' +
          'one problem (ideally with linked risks/incidents and a non-OPEN status) before ' +
          'running this mode — a capture with nothing real to show defeats its own purpose ' +
          '(CLAUDE.md §18.1). Or pass --problemId=<uuid> to pin a specific one.',
      );
    }
    await firstProblem.click();
    await page.waitForURL(/\/problems\/[0-9a-f-]+/, { timeout: 15_000 });
    problemDetailUrl = page.url();
  }

  const GROUPS = [
    ['01-visao-geral', 'overview', 'Visão geral', null],
    ['02-resposta', 'corrective-actions', 'Resposta', null],
    ['03-relacionamentos-riscos', 'risks', 'Relacionamentos', 'Riscos'],
    ['04-registro-evidencia', 'evidence', 'Registro', 'Evidência'],
  ];

  async function waitForLeafActive(groupLabel, leafLabel) {
    const groupTablist = page.getByRole('tablist', { name: 'Grupos de seções do problema' });
    const groupTab = groupTablist.getByRole('tab', { name: groupLabel, exact: true });
    try {
      await groupTab.waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      return false;
    }
    if (leafLabel === null) {
      return true;
    }
    const leafTablist = page.getByRole('tablist', { name: `Seções de ${groupLabel}` });
    const leafTab = leafTablist.getByRole('tab', { name: leafLabel, exact: true, selected: true });
    try {
      await leafTab.waitFor({ state: 'visible', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  for (const w of widths) {
    const dir = `${outDir}-${theme}-${w}`;
    await mkdir(dir, { recursive: true });
    console.log(`capturing -> ${dir}`);
    await page.setViewportSize({ width: w, height });

    for (const [name, sectionId, groupLabel, leafLabel] of GROUPS) {
      await page.goto(`${problemDetailUrl}?section=${sectionId}`, { waitUntil: 'networkidle' });
      const landed = await waitForLeafActive(groupLabel, leafLabel);
      if (!landed) {
        console.log(
          `  [skip] ${name} — "${leafLabel ?? groupLabel}" never became the active section ` +
            '(likely missing for this signed-in identity).',
        );
        continue;
      }
      await page.waitForTimeout(500);

      const contentHeight = await page.evaluate(
        "document.querySelector('main')?.scrollHeight ?? document.body.scrollHeight",
      );
      const shotHeight = Math.max(height, contentHeight + 40);
      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height: shotHeight });
      }

      await shoot(page, name, dir);

      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height });
      }
    }
  }
}

async function captureActionDetailSurface() {
  const pinnedActionId = arg('actionId', null);
  let actionDetailUrl;

  if (pinnedActionId) {
    actionDetailUrl = `${ORIGIN}/actions/${pinnedActionId}`;
    await page.goto(actionDetailUrl, { waitUntil: 'networkidle' });
    if (!(await page.getByRole('heading', { level: 1 }).count())) {
      throw new Error(
        `--surface=action-detail --actionId=${pinnedActionId} did not land on an action ` +
          'detail page — check the id and that this signed-in identity can see it (organizational scope).',
      );
    }
  } else {
    await page.goto(`${ORIGIN}/actions`, { waitUntil: 'networkidle' });
    const tableToggle = page.getByRole('radio', { name: 'Ver as ações em tabela' });
    if (await tableToggle.count()) {
      await tableToggle.click();
      await page.waitForLoadState('networkidle');
    }
    const firstAction = page.getByRole('link', { name: /^ACT-/ }).first();
    if (!(await firstAction.count())) {
      throw new Error(
        '--surface=action-detail found no action under /actions to capture. Seed at least one ' +
          'action (ideally with a real origin and a non-OPEN status) before running this mode ' +
          '— a capture with nothing real to show defeats its own purpose (CLAUDE.md §18.1). Or ' +
          'pass --actionId=<uuid> to pin a specific one.',
      );
    }
    await followLink(page, firstAction);
    actionDetailUrl = page.url();
  }

  const SECTIONS = [
    ['01-visao-geral', 'Visão geral'],
    ['02-auditoria', 'Auditoria'],
  ];

  for (const w of widths) {
    const dir = `${outDir}-${theme}-${w}`;
    await mkdir(dir, { recursive: true });
    console.log(`capturing -> ${dir}`);
    await page.setViewportSize({ width: w, height });

    await page.goto(actionDetailUrl, { waitUntil: 'networkidle' });

    for (const [name, tabLabel] of SECTIONS) {
      const tab = page.getByRole('tab', { name: tabLabel, exact: true });
      if (!(await tab.count())) {
        console.log(`  [skip] ${name} — "${tabLabel}" tab not offered to this signed-in identity.`);
        continue;
      }
      if (name !== '01-visao-geral') {
        await tab.click();
        await page
          .getByRole('tab', { name: tabLabel, exact: true, selected: true })
          .waitFor({ state: 'visible', timeout: 10_000 });
      }
      await page.waitForTimeout(400);

      const contentHeight = await page.evaluate(
        "document.querySelector('main')?.scrollHeight ?? document.body.scrollHeight",
      );
      const shotHeight = Math.max(height, contentHeight + 40);
      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height: shotHeight });
      }

      await shoot(page, name, dir);

      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height });
      }
    }
  }
}

async function captureRiskRegisterSurface() {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const { writeFile } = await import('node:fs/promises');
  const failures = [];

  for (const w of widths) {
    const dir = `${outDir}-${theme}-${w}`;
    await mkdir(dir, { recursive: true });
    console.log(`capturing -> ${dir}`);
    await page.setViewportSize({ width: w, height });
    await page.goto(`${ORIGIN}/risks`, { waitUntil: 'networkidle' });
    await page
      .getByRole('link', { name: /^Abrir o risco/ })
      .first()
      .waitFor({
        state: 'visible',
        timeout: 15_000,
      });

    async function captureState(name) {
      await page.waitForTimeout(300);
      const dimensions = await page.evaluate(`(() => {
        const main = document.querySelector('main');
        return {
          scrollWidth: main?.scrollWidth ?? document.body.scrollWidth,
          clientWidth: main?.clientWidth ?? document.documentElement.clientWidth,
          contentHeight: main?.scrollHeight ?? document.body.scrollHeight,
        };
      })()`);
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      const overflow = dimensions.scrollWidth > dimensions.clientWidth + 1;
      await writeFile(
        path.join(dir, `${name}-checks.json`),
        JSON.stringify(
          { width: w, theme, overflow, dimensions, violations: axe.violations },
          null,
          2,
        ),
      );
      console.log(`  ${name}: main overflow=${overflow}; axe violations=${axe.violations.length}`);
      if (overflow || axe.violations.length) failures.push(`${theme}/${w}/${name}`);
      await page.screenshot({ path: path.join(dir, `${name}-viewport.png`) });
      await page.setViewportSize({
        width: w,
        height: Math.max(height, dimensions.contentHeight + 56),
      });
      await shoot(page, name, dir);
      await page.setViewportSize({ width: w, height });
    }

    await captureState('01-cards');
    await page.getByRole('radio', { name: 'Ver os riscos em tabela' }).click();
    await page.getByRole('table', { name: 'Registro de riscos' }).waitFor({ state: 'visible' });
    await captureState('02-table');
    if (w >= 1024) {
      await page.getByRole('radio', { name: 'Ver os riscos em cards' }).click();
      await page.getByRole('button', { name: /^Filtros/ }).click();
      await page.getByRole('button', { name: 'Status', exact: true }).waitFor({ state: 'visible' });
      await captureState('03-filters');
    }
  }
  if (failures.length) throw new Error(`Risk register checks failed: ${failures.join(', ')}`);
  if (arg('verify-pagination', 'false') === 'true') {
    const { expect } = await import('@playwright/test');
    await page.setViewportSize({ width: 1440, height });
    await page.goto(`${ORIGIN}/risks`, { waitUntil: 'networkidle' });
    const size = page.getByLabel('Itens por página');
    await expect(size).toHaveCount(1);
    await size.selectOption('25');
    const cards = page.getByRole('link', { name: /^Abrir o risco/ });
    await expect(cards).toHaveCount(25);
    const firstPageCode = await page.locator('article a').first().textContent();
    await page.getByRole('button', { name: 'Próxima página', exact: true }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(cards).toHaveCount(25);
    await expect(page.locator('article a').first()).not.toHaveText(firstPageCode);
    const secondPageCode = await page.locator('article a').first().textContent();
    await page.getByRole('radio', { name: 'Ver os riscos em tabela' }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(
      page.getByRole('table').getByRole('link', { name: secondPageCode, exact: true }),
    ).toBeVisible();
    await expect(size).toHaveValue('25');
    await size.selectOption('50');
    await expect(page).not.toHaveURL(/[?&]page=2/);
    await expect(page.locator('tbody tr')).toHaveCount(50);
    const search = page.getByRole('searchbox');
    await search.focus();
    await page.keyboard.press('Tab');
    const toggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await page.getByRole('radio', { name: 'Ver os riscos em cards' }).click();
    await cards.first().click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await page.goBack();
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    await cards.first().focus();
    await expect(cards.first()).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await page.goBack();
    console.log(
      'pagination and keyboard: 25/page -> page 2 -> table -> 50/page -> page 1; search Tab -> filters Enter; card click/Enter navigate straight to the record: passed',
    );
    await writeFile(
      `${outDir}-${theme}-interaction-checks.json`,
      JSON.stringify(
        {
          pagination: 'passed',
          pageSize: 'passed',
          viewStatePreservation: 'passed',
          keyboardFilterDisclosure: 'passed',
          singlePageSizeControl: 'passed',
          cardNavigatesDirectlyToRecord: 'passed',
          cardKeyboardNavigation: 'passed',
        },
        null,
        2,
      ),
    );
  }
}

async function captureDashboardSurface() {
  await page.goto(`${ORIGIN}/dashboard`, { waitUntil: 'networkidle' });
  await page.locator('svg.recharts-surface').first().waitFor({ state: 'visible', timeout: 15_000 });

  for (const w of widths) {
    const dir = `${outDir}-${theme}-${w}`;
    await mkdir(dir, { recursive: true });
    console.log(`capturing -> ${dir}`);
    await page.setViewportSize({ width: w, height });
    await page.waitForTimeout(300);

    const contentHeight = await page.evaluate(
      "document.querySelector('main')?.scrollHeight ?? document.body.scrollHeight",
    );
    const shotHeight = Math.max(height, contentHeight + 40);
    if (shotHeight !== height) {
      await page.setViewportSize({ width: w, height: shotHeight });
      await page.waitForTimeout(150);
    }

    await shoot(page, '01-dashboard', dir);

    if (shotHeight !== height) {
      await page.setViewportSize({ width: w, height });
    }
  }
}

async function captureControlDetailSurface() {
  const pinnedControlId = arg('controlId', null);
  let controlDetailUrl;

  if (pinnedControlId) {
    controlDetailUrl = `${ORIGIN}/controls/${pinnedControlId}`;
    await page.goto(controlDetailUrl, { waitUntil: 'networkidle' });
    if (!(await page.getByRole('heading', { level: 1 }).count())) {
      throw new Error(
        `--surface=control-detail --controlId=${pinnedControlId} did not land on a control ` +
          'detail page — check the id and that this signed-in identity can see it (organizational scope).',
      );
    }
  } else {
    await page.goto(`${ORIGIN}/controls`, { waitUntil: 'networkidle' });
    const firstControl = page.getByRole('link', { name: /^CTL-/ }).first();
    if (!(await firstControl.count())) {
      throw new Error(
        '--surface=control-detail found no control under /controls to capture. Seed at least ' +
          'one control (ideally ACTIVE, with an owner, a verification and a linked process/asset) ' +
          'before running this mode — a capture with nothing real to show defeats its own purpose ' +
          '(CLAUDE.md §18.1). Or pass --controlId=<uuid> to pin a specific one.',
      );
    }
    await followLink(page, firstControl);
    controlDetailUrl = page.url();
  }

  const SECTIONS = [
    ['01-visao-geral', 'overview', 'Visão geral'],
    ['02-verificacoes', 'assessments', 'Verificações'],
    ['03-vinculos', 'relationships', 'Vínculos'],
    ['04-evidencias', 'evidence', 'Evidências'],
  ];

  async function waitForSectionActive(label) {
    const tab = page.getByRole('tab', { name: label, exact: true, selected: true });
    try {
      await tab.waitFor({ state: 'visible', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  for (const w of widths) {
    const dir = `${outDir}-${theme}-${w}`;
    await mkdir(dir, { recursive: true });
    console.log(`capturing -> ${dir}`);
    await page.setViewportSize({ width: w, height });

    for (const [name, sectionId, label] of SECTIONS) {
      await page.goto(`${controlDetailUrl}?section=${sectionId}`, { waitUntil: 'networkidle' });
      const landed = await waitForSectionActive(label);
      if (!landed) {
        console.log(
          `  [skip] ${name} — "${label}" never became the active section (likely missing for ` +
            'this signed-in identity — e.g. Evidências without evidence:view).',
        );
        continue;
      }
      await page.waitForTimeout(500);

      const contentHeight = await page.evaluate(
        "document.querySelector('main')?.scrollHeight ?? document.body.scrollHeight",
      );
      const shotHeight = Math.max(height, contentHeight + 40);
      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height: shotHeight });
      }

      await shoot(page, name, dir);

      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height });
      }
    }
  }
}

async function captureAssetDetailSurface() {
  const pinnedAssetId = arg('assetId', null);
  let assetDetailUrl;

  if (pinnedAssetId) {
    assetDetailUrl = `${ORIGIN}/assets/${pinnedAssetId}`;
    await page.goto(assetDetailUrl, { waitUntil: 'networkidle' });
    if (!(await page.getByRole('heading', { level: 1 }).count())) {
      throw new Error(
        `--surface=asset-detail --assetId=${pinnedAssetId} did not land on an asset detail ` +
          'page — check the id and that this signed-in identity can see it (organizational scope).',
      );
    }
  } else {
    await page.goto(`${ORIGIN}/assets`, { waitUntil: 'networkidle' });
    const firstAsset = page.getByRole('link', { name: /^AST-/ }).first();
    if (!(await firstAsset.count())) {
      throw new Error(
        '--surface=asset-detail found no asset under /assets to capture. Seed at least one ' +
          'asset before running this mode — a capture with nothing real to show defeats its own ' +
          'purpose (CLAUDE.md §18.1). Or pass --assetId=<uuid> to pin a specific one.',
      );
    }
    await followLink(page, firstAsset);
    assetDetailUrl = page.url();
  }

  const SECTIONS = [
    ['01-visao-geral', 'overview', 'Visão geral'],
    ['02-riscos', 'risks', 'Riscos'],
    ['03-controles', 'controls', 'Controles'],
    ['04-incidentes', 'incidents', 'Incidentes'],
  ];

  async function waitForSectionActive(label) {
    const tab = page.getByRole('tab', { name: label, exact: true, selected: true });
    try {
      await tab.waitFor({ state: 'visible', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  for (const w of widths) {
    const dir = `${outDir}-${theme}-${w}`;
    await mkdir(dir, { recursive: true });
    console.log(`capturing -> ${dir}`);
    await page.setViewportSize({ width: w, height });

    for (const [name, sectionId, label] of SECTIONS) {
      await page.goto(`${assetDetailUrl}?section=${sectionId}`, { waitUntil: 'networkidle' });
      const landed = await waitForSectionActive(label);
      if (!landed) {
        console.log(`  [skip] ${name} — "${label}" never became the active section.`);
        continue;
      }
      await page.waitForTimeout(500);

      const contentHeight = await page.evaluate(
        "document.querySelector('main')?.scrollHeight ?? document.body.scrollHeight",
      );
      const shotHeight = Math.max(height, contentHeight + 40);
      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height: shotHeight });
      }

      await shoot(page, name, dir);

      if (shotHeight !== height) {
        await page.setViewportSize({ width: w, height });
      }
    }
  }
}

if (surface === 'roles') {
  await captureRolesSurface();
  await browser.close();
  console.log('done');
  process.exit(0);
}

if (surface === 'risk-detail') {
  await captureRiskDetailSurface();
  await browser.close();
  console.log('done');
  process.exit(0);
}

if (surface === 'risk-register') {
  await captureRiskRegisterSurface();
  await browser.close();
  console.log('done');
  process.exit(0);
}

if (surface === 'incident-detail') {
  await captureIncidentDetailSurface();
  await browser.close();
  console.log('done');
  process.exit(0);
}

if (surface === 'problem-detail') {
  await captureProblemDetailSurface();
  await browser.close();
  console.log('done');
  process.exit(0);
}

if (surface === 'action-detail') {
  await captureActionDetailSurface();
  await browser.close();
  console.log('done');
  process.exit(0);
}

if (surface === 'control-detail') {
  await captureControlDetailSurface();
  await browser.close();
  console.log('done');
  process.exit(0);
}

if (surface === 'asset-detail') {
  await captureAssetDetailSurface();
  await browser.close();
  console.log('done');
  process.exit(0);
}

if (surface === 'dashboard') {
  await captureDashboardSurface();
  await browser.close();
  console.log('done');
  process.exit(0);
}

const surfaces = [
  ['02-dashboard', '/dashboard'],
  ['03-risk-register', '/risks'],
  ['04-risk-new', '/risks/new'],
  ['04b-my-actions', '/actions'],
  ['20-control-catalog', '/controls'],
  ['10-admin-users', '/admin/users'],
  ['11-admin-roles', '/admin/roles'],
  ['12-admin-organization', '/admin/organization'],
];

for (const [name, route] of surfaces) {
  await page.goto(`${ORIGIN}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shoot(page, name);
}

await page.goto(`${ORIGIN}/risks`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const tableToggle = page.getByRole('radio', { name: 'Ver os riscos em tabela' });
if (await tableToggle.count()) {
  await tableToggle.click();
  await page.waitForTimeout(700);
  await shoot(page, '03e-risk-register-table');
}

await page.goto(`${ORIGIN}/dashboard`, { waitUntil: 'networkidle' });
const collapse = page.getByRole('button', { name: 'Recolher menu lateral' });
if (await collapse.count()) {
  await collapse.click();
  await page.waitForTimeout(250);
  await shoot(page, '02b-dashboard-sidebar-collapsed');
  try {
    await page.getByRole('button', { name: 'Expandir menu lateral' }).click({ timeout: 10_000 });
  } catch (error) {
    console.log('  [WARN] could not restore the expanded sidebar — continuing.', error.message);
    await page.goto(`${ORIGIN}/dashboard`, { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(250);
}

await page.goto(`${ORIGIN}/risks`, { waitUntil: 'networkidle' });
const firstRisk = page.getByRole('link', { name: /^RSK-/ }).first();
if (await firstRisk.count()) {
  await firstRisk.click();
  await page.waitForURL(/\/risks\/[0-9a-f-]+/, { timeout: 15_000 });
  await page.waitForTimeout(800);
  await shoot(page, '05-risk-detail-overview');

  async function openRiskDetailLeaf(groupLabel, leafLabel) {
    const groupTablist = page.getByRole('tablist', { name: 'Grupos de seções do risco' });
    const groupTab = groupTablist.getByRole('tab', { name: groupLabel, exact: true });
    if (!(await groupTab.count())) return false;
    await groupTab.click();
    if (leafLabel === null) return true;
    const leafTablist = page.getByRole('tablist', { name: `Seções de ${groupLabel}` });
    const leafTab = leafTablist.getByRole('tab', { name: leafLabel, exact: true });
    try {
      await leafTab.waitFor({ state: 'visible', timeout: 5_000 });
    } catch {
      return false;
    }
    await leafTab.click();
    return true;
  }

  const sections = [
    ['06-risk-detail-causes', 'Análise', 'Causas e Consequências'],
    ['07-risk-detail-assessment', 'Análise', 'Avaliação'],
    ['08-risk-detail-treatment', 'Resposta', 'Tratamento'],
    ['08b-risk-detail-history', 'Registro', 'Histórico'],
    ['09-risk-detail-audit', 'Registro', 'Auditoria'],
  ];
  for (const [name, groupLabel, leafLabel] of sections) {
    const opened = await openRiskDetailLeaf(groupLabel, leafLabel);
    if (opened) {
      await page.waitForTimeout(700);
      await shoot(page, name);
    }
  }
}

await page.goto(`${ORIGIN}/controls/new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await shoot(page, '21-control-new');
await page.getByLabel('Nome').fill(`Revisão de acessos privilegiados (${theme})`);
await page
  .getByLabel('Descrição')
  .fill('Revisão trimestral dos acessos privilegiados concedidos em sistemas críticos.');
await page.getByRole('combobox', { name: 'Unidade organizacional' }).click();
await page.getByRole('option').first().click();
const ownerCombobox = page.getByRole('combobox', { name: 'Responsável pelo controle' });
await ownerCombobox.click();
await page.getByRole('option').nth(1).click();
await page.getByRole('combobox', { name: 'Natureza' }).click();
await page.getByRole('option', { name: 'Manual' }).click();
await page.getByRole('combobox', { name: 'Tipo' }).click();
await page.getByRole('option', { name: 'Detectivo' }).click();
await page.getByRole('combobox', { name: 'Frequência' }).click();
await page.getByRole('option', { name: 'Trimestral' }).click();
await page.getByRole('button', { name: 'Cadastrar controle' }).click();
await page.waitForURL(/\/controls\/[0-9a-f-]+/, { timeout: 15_000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

const activateButton = page.getByRole('button', { name: /^Aplicar: Ativo/ });
if (await activateButton.count()) {
  await activateButton.click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.waitForTimeout(600);
}

const assessmentsTab = page.getByRole('tab', { name: /verifica/i });
if (await assessmentsTab.count()) {
  await assessmentsTab.click();
  await page.waitForTimeout(400);
  const resultCombobox = page.getByRole('combobox', { name: 'Resultado' });
  if (await resultCombobox.count()) {
    await resultCombobox.click();
    await page.getByRole('option', { name: 'Efetivo', exact: true }).click();
    await page.getByLabel('Conclusão').fill('Amostragem revisada; nenhuma exceção encontrada.');
    await page.getByRole('button', { name: 'Registrar verificação' }).click();
    await page.waitForTimeout(600);

    const requestAttestation = page.getByRole('button', { name: 'Solicitar atestação' });
    if (await requestAttestation.count()) {
      await requestAttestation.click();
      await page.waitForTimeout(600);
    }
  }
}

await page.goto(`${ORIGIN}/controls`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const controlTableToggle = page.getByRole('radio', { name: 'Exibir como tabela' });
if (await controlTableToggle.count()) {
  await controlTableToggle.click();
  await page.waitForTimeout(700);
  await shoot(page, '20c-control-catalog-table');
}

await page.goto(`${ORIGIN}/controls`, { waitUntil: 'networkidle' });
const firstControl = page.getByRole('link', { name: /^CTL-/ }).first();
if (await firstControl.count()) {
  await firstControl.click();
  await page.waitForURL(/\/controls\/[0-9a-f-]+/, { timeout: 15_000 });
  await page.waitForTimeout(800);
  await shoot(page, '22-control-detail-overview');

  const controlTabs = [
    ['23-control-detail-assessments', /verifica/i],
    ['24-control-detail-relationships', /v[íi]nculos/i],
    ['25-control-detail-evidence', /evid[êe]ncias/i],
  ];
  for (const [name, label] of controlTabs) {
    const tab = page.getByRole('tab', { name: label }).first();
    if (await tab.count()) {
      await tab.click();
      await page.waitForTimeout(700);
      await shoot(page, name);
    }
  }
}

await page.goto(`${ORIGIN}/compliance`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shoot(page, '50-compliance-register');

await page.goto(`${ORIGIN}/compliance/new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await shoot(page, '51-compliance-framework-new');
await page.getByLabel(/^Nome/).fill(`ISO 27001 (${theme})`);
await page
  .getByLabel(/^Descrição/)
  .fill('Norma internacional de gestão de segurança da informação.');
await page.getByRole('combobox', { name: /^Origem/ }).click();
await page.getByRole('option', { name: 'Norma externa' }).click();
await page.getByRole('button', { name: 'Cadastrar framework' }).click();
await page.waitForURL(/\/compliance\/[0-9a-f-]+$/, { timeout: 15_000 });
await page.waitForLoadState('networkidle');
await shoot(page, '52-compliance-framework-detail-overview');

const versionsTab = page.getByRole('tab', { name: 'Versões' });
if (await versionsTab.count()) {
  await versionsTab.click();
  await page.waitForTimeout(400);
  await shoot(page, '53-compliance-framework-detail-versions-empty');
}

await followLink(page, page.getByRole('link', { name: 'Nova versão' }).first());
await shoot(page, '54-compliance-version-new');
await page.getByLabel(/^Identificador/).fill('2022');
await page.getByRole('button', { name: 'Criar versão' }).click();
await page.waitForURL(/\/compliance\/[0-9a-f-]+\/versions\/[0-9a-f-]+$/, { timeout: 15_000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(400);
await shoot(page, '55-compliance-version-detail-overview-empty');

await page.getByRole('tab', { name: 'Requisitos (cláusulas)' }).click();
await page.waitForTimeout(400);
await shoot(page, '55b-compliance-requirements-tab-empty');

await page.getByRole('button', { name: 'Cadastrar requisito' }).first().click();
await page.waitForTimeout(300);
await shoot(page, '56-compliance-requirement-create-dialog');
await page.getByLabel(/Identificador na norma/).fill('A.5.1');
await page.getByLabel(/^Título/).fill('Política de segurança da informação');
await page
  .getByLabel(/^Descrição/)
  .fill(
    'A organização deve manter e revisar periodicamente uma política de segurança da informação.',
  );
await page.getByRole('button', { name: 'Cadastrar requisito' }).click();
await page.waitForTimeout(600);
await shoot(page, '57-compliance-requirements-tab-with-requirement');

await followLink(page, page.getByRole('link', { name: 'Política de segurança da informação' }));
await page.waitForTimeout(400);
await shoot(page, '57b-compliance-requirement-detail-not-met');

await page.getByRole('button', { name: 'Editar', exact: true }).click();
await page.waitForTimeout(300);
await shoot(page, '58-compliance-requirement-edit-form');
await page.getByRole('button', { name: 'Cancelar edição' }).click();
await page.waitForTimeout(200);

await page.getByRole('tab', { name: 'Controles mapeados' }).click();
await page.waitForTimeout(300);
await shoot(page, '58b-compliance-requirement-control-mapping-empty');
await page.getByRole('combobox', { name: 'Vincular controle' }).click();
const controlOption = page.getByRole('option', { name: /^Revisão de acessos privilegiados/ });
let hasControlOption = true;
try {
  await controlOption.first().waitFor({ state: 'attached', timeout: 8_000 });
} catch {
  hasControlOption = false;
}
if (hasControlOption) {
  await controlOption.first().click();
  await page.getByRole('button', { name: 'Vincular controle' }).click();
  await page.waitForTimeout(500);
  await shoot(page, '58c-compliance-requirement-control-mapping-linked');
} else {
  await page.keyboard.press('Escape');
}

await page.getByRole('tab', { name: 'Aplicabilidade' }).click();
await page.waitForTimeout(300);
await shoot(page, '58d-compliance-requirement-applicability-default');
await page.getByRole('button', { name: 'Declarar não aplicável' }).click();
await page.waitForTimeout(200);
await shoot(page, '58e-compliance-requirement-applicability-declare-dialog');
await page
  .getByLabel(/^Justificativa/)
  .fill('Cláusula fora do perímetro certificado nesta revisão.');
await page.getByRole('button', { name: 'Declarar não aplicável' }).click();
await page.waitForTimeout(500);
await shoot(page, '58f-compliance-requirement-applicability-active');

const revokeButton = page.getByRole('button', { name: 'Revogar declaração' });
if (await revokeButton.count()) {
  await revokeButton.click();
  await page.waitForTimeout(200);
  await shoot(page, '58g-compliance-requirement-applicability-revoke-confirm');
  await page.getByRole('button', { name: 'Revogar declaração' }).click();
  await page.waitForTimeout(500);
}

await followLink(page, page.getByRole('link', { name: /^Voltar à versão/ }));
await page.waitForTimeout(500);
await shoot(page, '59-compliance-version-detail-overview-with-summary');

await page.getByRole('button', { name: 'Publicar versão' }).click();
await page.waitForTimeout(200);
await shoot(page, '60-compliance-publish-confirm-dialog');
await page.getByRole('button', { name: 'Publicar' }).click();
await page.waitForTimeout(600);
await shoot(page, '61-compliance-version-detail-published');

const migrationTab = page.getByRole('tab', { name: 'Migração de mapeamento' });
if (await migrationTab.count()) {
  await migrationTab.click();
  await page.waitForTimeout(400);
  await shoot(page, '61b-compliance-mapping-migration-tab-empty');
}

const currentUrl = new URL(page.url());
const frameworkPath = currentUrl.pathname.split('/versions/')[0];
await page.goto(`${ORIGIN}${frameworkPath}`, { waitUntil: 'networkidle' });
await page.getByRole('tab', { name: 'Versões' }).click({ timeout: 20_000 });
await page.waitForTimeout(300);
await followLink(page, page.getByRole('link', { name: 'Nova versão' }));
await page.getByLabel(/^Identificador/).fill('2023');
await page.getByRole('button', { name: 'Criar versão' }).click();
await page.waitForURL(/\/compliance\/[0-9a-f-]+\/versions\/[0-9a-f-]+$/, { timeout: 15_000 });
await page.waitForLoadState('networkidle');

await page.getByRole('tab', { name: 'Requisitos (cláusulas)' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Cadastrar requisito' }).first().click();
await page.waitForTimeout(200);
await page.getByLabel(/Identificador na norma/).fill('A.5.1');
await page.getByLabel(/^Título/).fill('Política de segurança da informação (revisada)');
await page.getByLabel(/^Descrição/).fill('Revisão 2023 da mesma cláusula.');
await page.getByRole('button', { name: 'Cadastrar requisito' }).click();
await page.waitForTimeout(500);

await page.getByRole('tab', { name: 'Migração de mapeamento' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Nova migração' }).first().click();
await page.waitForTimeout(300);
await shoot(page, '62-compliance-mapping-migration-dialog-empty');
await page.getByRole('combobox', { name: 'Versão de origem' }).click();
await page.getByRole('option', { name: '2022' }).click();
await page.waitForTimeout(400);
await shoot(page, '63-compliance-mapping-migration-dialog-target-pending');
await page.getByRole('combobox', { name: 'Adicionar correspondência' }).click();
const sourceOption = page
  .getByRole('option', { name: /Política de segurança da informação/ })
  .first();
let hasSourceOption = true;
try {
  await sourceOption.waitFor({ state: 'attached', timeout: 8_000 });
} catch {
  hasSourceOption = false;
}
if (hasSourceOption) {
  await sourceOption.click();
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.waitForTimeout(300);
  await shoot(page, '64-compliance-mapping-migration-dialog-correspondence-added');
  await page.getByRole('button', { name: 'Executar migração' }).click();
  await page.waitForTimeout(600);
  await shoot(page, '65-compliance-mapping-migration-result');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForTimeout(300);
  await shoot(page, '66-compliance-mapping-migration-tab-with-history');

  const migrationDetailLink = page.getByRole('link', { name: 'Ver detalhe' }).first();
  if (await migrationDetailLink.count()) {
    await followLink(page, migrationDetailLink);
    await page.waitForTimeout(400);
    await shoot(page, '67-compliance-mapping-migration-detail-page');
  }
} else {
  await page.keyboard.press('Escape');
}

await page.goto(`${ORIGIN}/compliance`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await shoot(page, '68-compliance-register-populated');

await page.goto(`${ORIGIN}/audits`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shoot(page, '70-audit-register-empty');

await page.goto(`${ORIGIN}/audits/new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await shoot(page, '71-audit-new');

await page.getByLabel('Objetivo').fill(`Auditoria de acessos privilegiados (${theme})`);
await page.getByLabel('Início do período').fill('2026-01-01');
await page.getByLabel('Fim do período').fill('2026-03-31');
await page.getByRole('combobox', { name: 'Unidade organizacional' }).click();
await page.getByRole('option').first().click();
const leadAuditor = page.getByRole('combobox', { name: 'Auditor responsável' });
await leadAuditor.click();
await page.getByRole('option').first().click();
await page.waitForTimeout(200);
await shoot(page, '71b-audit-new-filled');

await page.getByRole('button', { name: 'Abrir engajamento' }).click();
await page.waitForURL(/\/audits\/[0-9a-f-]+/, { timeout: 15_000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(600);
await shoot(page, '72-audit-detail-planning');

const scopeTab = page.getByRole('tab', { name: 'Escopo' }).first();
if (await scopeTab.count()) {
  await scopeTab.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shoot(page, '72b-audit-scope-tab');
}

const scopeControlTab = page.getByRole('tab', { name: 'Controle' }).first();
if (await scopeControlTab.count()) {
  await scopeControlTab.click();
  await page.waitForTimeout(400);
  await shoot(page, '73-audit-scope-empty-control-tab');

  const controlPicker = page.getByRole('combobox', { name: 'Controle' });
  if (await controlPicker.count()) {
    await controlPicker.click();
    const firstControlOption = page.getByRole('option').first();
    let hasControlOption = true;
    try {
      await firstControlOption.waitFor({ state: 'attached', timeout: 8_000 });
    } catch {
      hasControlOption = false;
    }
    if (hasControlOption) {
      await firstControlOption.click();
      await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
      await page.waitForTimeout(700);
      await shoot(page, '74-audit-scope-populated');
    } else {
      await page.keyboard.press('Escape');
    }
  }
}

const startButton = page.getByRole('button', { name: 'Iniciar engajamento' });
if ((await startButton.count()) && (await startButton.isEnabled())) {
  await startButton.click();
  await page.waitForTimeout(300);
  await shoot(page, '75-audit-start-confirm');
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await page.waitForTimeout(900);
  await shoot(page, '76-audit-detail-in-progress');
} else {
  console.log(
    '  [WARN] start stayed disabled — no scope entry was added; findings block will skip.',
  );
}

const findingsTab = page.getByRole('tab', { name: 'Achados' }).first();
if (await findingsTab.count()) {
  await findingsTab.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shoot(page, '76b-audit-findings-tab-empty');
}

const newFindingButton = page.getByRole('button', { name: 'Registrar achado' }).first();
if (await newFindingButton.count()) {
  await newFindingButton.click();
  await page.waitForTimeout(500);
  await shoot(page, '77-audit-finding-create-dialog');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

await page.goto(`${ORIGIN}/audits`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await shoot(page, '78-audit-register-populated');

const auditTableToggle = page.getByRole('radio', { name: 'Exibir como tabela' });
if (await auditTableToggle.count()) {
  await auditTableToggle.click();
  await page.waitForTimeout(700);
  await shoot(page, '79-audit-register-table');
}

for (const [slug, singular, submitLabel, recordName] of [
  ['assets', 'ativo', 'Cadastrar ativo', 'Servidor de aplicação'],
  ['processes', 'processo', 'Cadastrar processo', 'Aprovação de pagamentos'],
]) {
  const prefix = slug === 'assets' ? '80' : '85';

  await page.goto(`${ORIGIN}/${slug}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shoot(page, `${prefix}-${slug}-register-empty`);

  await page.goto(`${ORIGIN}/${slug}/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await shoot(page, `${prefix}b-${slug}-new`);

  await page.getByLabel('Nome').fill(`${recordName} (${theme})`);
  await page
    .getByLabel('Descrição')
    .fill(`Registro de ${singular} criado pela verificação renderizada.`);
  await page.getByRole('combobox', { name: 'Unidade organizacional' }).click();
  await page.getByRole('option').first().click();
  await page.waitForTimeout(200);
  await shoot(page, `${prefix}c-${slug}-new-filled`);

  await page.getByRole('button', { name: submitLabel }).click();
  await page.waitForURL(new RegExp(`/${slug}/[0-9a-f-]+`), { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await shoot(page, `${prefix}d-${slug}-detail`);

  const deactivate = page.getByRole('button', { name: /^Desativar/ }).first();
  if (await deactivate.count()) {
    await deactivate.click();
    await page.waitForTimeout(400);
    await shoot(page, `${prefix}e-${slug}-deactivate-confirm`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  await page.goto(`${ORIGIN}/${slug}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await shoot(page, `${prefix}f-${slug}-register-populated`);

  const tableToggle = page.getByRole('radio', { name: 'Exibir como tabela' });
  if (await tableToggle.count()) {
    await tableToggle.click();
    await page.waitForTimeout(700);
    await shoot(page, `${prefix}g-${slug}-register-table`);
  }
}

await page.goto(`${ORIGIN}/indicators`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await shoot(page, '90-indicators-catalog');

await page.goto(`${ORIGIN}/indicators/RISK_TOTAL_BY_LEVEL`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shoot(page, '91-indicator-detail-overview');

const historyTab = page.getByRole('tab', { name: 'Histórico' });
if (await historyTab.count()) {
  await historyTab.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shoot(page, '92-indicator-detail-history');

  const registerButton = page.getByRole('button', { name: 'Registrar medição agora' });
  if (await registerButton.count()) {
    await registerButton.click();
    await page.waitForTimeout(800);
    await shoot(page, '93-indicator-detail-history-measurement-registered');
  }
}

await page.goto(`${ORIGIN}/reports`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shoot(page, '94-reports-register');

await page.goto(`${ORIGIN}/reports/new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await shoot(page, '95-report-new');
await page.getByLabel('Nome').fill(`Painel executivo de GRC (${theme})`);
await page
  .getByLabel('Descrição')
  .fill('Indicadores consolidados para a diretoria, revisados mensalmente.');
await page.getByLabel('Riscos por nível').click();
await page.getByLabel('Controles inativos').click();
await page.waitForTimeout(200);
await shoot(page, '95b-report-new-filled');
await page.getByRole('button', { name: 'Criar relatório' }).click();
await page.waitForURL(/\/reports$/, { timeout: 15_000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(600);
await shoot(page, '96-reports-register-populated');

const runButton = page.getByRole('button', { name: 'Executar' }).first();
if (await runButton.count()) {
  await runButton.click();
  await page.waitForTimeout(900);
  await shoot(page, '97-report-run-dialog-result');
}

await browser.close();
console.log('done');
