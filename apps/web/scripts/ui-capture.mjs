/**
 * PharosGRC — rendered-UI capture harness (CLAUDE.md §18.1).
 *
 * Drives the *running* application with Playwright and writes screenshots to a
 * review directory, so a visual change can be judged from what the browser
 * actually paints rather than from source code or an implementation summary.
 * This exists because two real defects in this project passed every green gate
 * and were only visible on screen (F-28, and the causes/consequences tab).
 *
 * Usage:
 *   node scripts/ui-capture.mjs <outDir> [--theme=light|dark] [--width=1440]
 *   node scripts/ui-capture.mjs <outDirBase> --surface=roles [--theme=light|dark]
 *                                            [--widths=1920,1440,1280,1024,768,390]
 *                                            [--height=2400]
 *   node scripts/ui-capture.mjs <outDirBase> --surface=risk-detail [--theme=light|dark]
 *                                            [--widths=1920,1440,1280,1024,768,390]
 *                                            [--height=2200] [--riskId=<uuid>]
 *   node scripts/ui-capture.mjs <outDirBase> --surface=incident-detail [--theme=light|dark]
 *                                            [--widths=1920,1440,1280,1024,768,390]
 *                                            [--height=2200] [--incidentId=<uuid>]
 *   node scripts/ui-capture.mjs <outDirBase> --surface=problem-detail [--theme=light|dark]
 *                                            [--widths=1920,1440,1280,1024,768,390]
 *                                            [--height=2200] [--problemId=<uuid>]
 *   node scripts/ui-capture.mjs <outDirBase> --surface=action-detail [--theme=light|dark]
 *                                            [--widths=1920,1440,1280,1024,768,390]
 *                                            [--actionId=<uuid>]
 *   node scripts/ui-capture.mjs <outDirBase> --surface=control-detail [--theme=light|dark]
 *                                            [--widths=1920,1440,1280,1024,768,390]
 *                                            [--controlId=<uuid>]
 *   node scripts/ui-capture.mjs <outDirBase> --surface=asset-detail [--theme=light|dark]
 *                                            [--widths=1920,1440,1280,1024,768,390]
 *                                            [--assetId=<uuid>]
 *   node scripts/ui-capture.mjs <outDirBase> --surface=dashboard [--theme=light|dark]
 *                                            [--widths=1920,1440,1280,1024,768,390]
 *   node scripts/ui-capture.mjs <outDirBase> --surface=risk-register [--theme=light|dark]
 *                                            [--widths=1920,1440,1280,1024,768,390]
 *
 * `--surface=risk-detail`'s `--riskId` pins the capture to one specific,
 * already-seeded risk (by its id, not its code) instead of "whichever risk
 * sorts first in the register" — e.g. one whose organizational unit already
 * carries a real volume of Achados, so the capture shows that scale without
 * provisioning anything new for it. `--surface=incident-detail`'s
 * `--incidentId` does the same for Incident (018-incident-detail-experience),
 * and `--surface=problem-detail`'s `--problemId` does the same for Problem
 * (019-problem-detail-experience).
 *
 * In `--surface=roles`/`--surface=risk-detail`/`--surface=incident-detail`/
 * `--surface=problem-detail` the first argument is a PREFIX, not a
 * directory: each width is written to `<outDirBase>-<theme>-<width>/`. The
 * committed review sets are reproduced by exactly two invocations each,
 * from `apps/web`:
 *
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/015-roles --surface=roles --theme=light
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/015-roles --surface=roles --theme=dark
 *
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/016-risk-detail --surface=risk-detail --theme=light
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/016-risk-detail --surface=risk-detail --theme=dark
 *
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/018-incident-detail --surface=incident-detail --theme=light
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/018-incident-detail --surface=incident-detail --theme=dark
 *
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/019-problem-detail --surface=problem-detail --theme=light
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/019-problem-detail --surface=problem-detail --theme=dark
 *
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/021-control-detail --surface=control-detail --theme=light
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/021-control-detail --surface=control-detail --theme=dark
 *
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/022-asset-detail --surface=asset-detail --theme=light
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/022-asset-detail --surface=asset-detail --theme=dark
 *
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/024-dashboard-v2 --surface=dashboard --theme=light
 *   node scripts/ui-capture.mjs ../../docs/reviews/ui/024-dashboard-v2 --surface=dashboard --theme=dark
 *
 * Requires the app running on APP_ORIGIN (default http://localhost:3000) and a
 * seeded admin whose password may have been rotated by the E2E suite.
 *
 * ## `--surface=roles`/`--surface=risk-detail`, and why these modes exist at all
 *
 * The default run is one long sweep of the whole product, and it PROVISIONS a
 * control, a framework, an engagement, an asset, a process and a report on
 * every invocation. That is correct for a whole-product review and wrong for
 * a screen-level one: capturing one screen across six widths and two themes
 * would mean twelve invocations and dozens of abandoned records.
 *
 * `specs/015-roles-permissions-surface/STATE.md` §13 item 1 records what that
 * cost: the 148 captures of that phase were taken by an ad-hoc script that
 * was never committed, so nobody could reproduce them. `--surface=roles` was
 * the answer to that, and `--surface=risk-detail` (016-risk-detail-experience)
 * follows the exact same shape rather than becoming a second, private script
 * — CLAUDE.md §18.2 names exactly one capture tool, and a private copy per
 * screen is how two of them appear.
 *
 * One property both share, that the default sweep does not need:
 *
 * - **One sign-in for the whole matrix.** `apps/api/.env` carries production
 *   authentication limits on this machine (`docs/local-environment.md` D-23,
 *   F-48): twelve invocations means twelve sign-ins against a budget of
 *   twenty per five minutes. So each mode loops the SIX widths itself, inside
 *   one session, and is invoked twice — once per theme.
 *
 * `--surface=roles` ALSO cleans up after itself (the custom-role states
 * cannot be captured without a custom role, because all twelve seeded roles
 * are system roles — one is created through the API and deleted at the end,
 * verified gone, per `specs/012-admin-roles-screen/STATE.md` §4).
 * `--surface=risk-detail`/`--surface=incident-detail`/`--surface=problem-detail`
 * provision nothing of their own — see `captureRiskDetailSurface`'s/
 * `captureIncidentDetailSurface`'s/`captureProblemDetailSurface`'s own
 * headers for why.
 *
 * `--theme=dark` does NOT set the browser context's `colorScheme` and stop
 * there (CLAUDE.md §18.13 — a trap already paid for once): the shell's dark
 * mode is a `.dark` class applied by `next-themes`
 * (`components/shell/theme-provider.tsx`), not the OS-level
 * `prefers-color-scheme` media feature, so a context-level `colorScheme`
 * option never flips it by itself. This script drives the real in-app
 * `ThemeToggle` after signing in when `--theme=dark` is requested — the same
 * control a user would click — rather than forcing the class through the
 * page in a way no real interaction ever produces.
 */
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
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.local';
const BASE_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Dev-Local-Only-P4ssw0rd!';
const theme = arg('theme', 'light');
const width = Number(arg('width', '1440'));
const surface = arg('surface', 'full');
/**
 * The authenticated shell scrolls `<main>`, not the document, so Playwright's
 * `fullPage` has nothing to stitch: it captures exactly one viewport and
 * everything below the fold is simply absent (CLAUDE.md §18.13's third trap,
 * in reverse). A screen-level review therefore needs a viewport TALLER than
 * the screen, which is what `specs/015-roles-permissions-surface/STATE.md` §6
 * already did for this same screen.
 *
 * 2400 is measured, not guessed: the tallest state of `--surface=roles` is
 * the detail panel with all thirteen modules expanded beside a twelve-card
 * list, which comes to roughly 2100 px at 1440. Override with `--height` when
 * a state grows past it — a state that does not fit is a capture that lies.
 *
 * `--surface=risk-detail`'s own 2200 default is an ESTIMATE, not a
 * measurement like the one above — `DetailLayout`'s two-column shell
 * (summary row, navigation, section content, sticky aside) has not been
 * measured at its tallest state the way `--surface=roles` was. Confirm
 * against a real capture before trusting it, and override with `--height`
 * if any area's shot shows the tell-tale blank band this file's header
 * warns about.
 *
 * ## The artefact this introduces, named so nobody reports it as a defect
 *
 * The panel is capped at `100svh`, so at a 2400 px viewport it is 2400 px
 * tall. Below `xl`, where it covers the whole screen, that leaves a large
 * empty band under its content — most visible at 390. **That is the capture
 * height, not a layout defect**: at a real 844 px phone viewport the panel
 * ends at the fold and its body scrolls, which is what the E2E asserts
 * (`admin-roles.spec.ts`, "Salvar alterações" `toBeInViewport()`). The
 * coordinator of an earlier phase attributed exactly this kind of blank band
 * to a broken layout before finding the cause, which is why it is written
 * down here rather than left to be rediscovered.
 */
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

/** The E2E helper permanently rotates the seeded password; try both. */
const PASSWORDS = [`${BASE_PASSWORD}-E2E-1`, BASE_PASSWORD];

async function signIn(page) {
  // Exact labels, matching e2e/support/admin-session.ts: a loose /senha/i also
  // matches "Senha atual", "Nova senha" and "Confirmar nova senha" on the
  // password-change screen, which Playwright rejects under strict mode.
  // `getByLabel('Senha')` on its own no longer works either, for a different
  // reason: it matches by SUBSTRING by default, and the reveal-password
  // button's `aria-label="Mostrar senha"` also contains "senha", so it now
  // resolves 2 elements. Anchoring to the textbox role excludes that button
  // explicitly instead of relying on substring luck.
  for (const password of PASSWORDS) {
    await page.goto(`${ORIGIN}/login`, { waitUntil: 'networkidle' });
    await page.getByLabel('E-mail').fill(EMAIL);
    await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    try {
      // 30s, not 12s: against a freshly (re)started dev server this is the
      // very first navigation past `/login`, and Next's on-demand compile
      // of `/dashboard` alone has been observed to take longer than 12s
      // cold — a real capture-script failure this run paid for, not a
      // theoretical one.
      await page.waitForURL(/\/(profile|dashboard)/, { timeout: 30_000 });
      return true;
    } catch {
      /* try the next candidate password */
    }
  }
  throw new Error('sign-in failed with both the seeded and the rotated password');
}

async function shoot(page, name, dir = outDir) {
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ${name}`);
}

/**
 * Follows a same-origin `<a>` by reading its `href` and issuing a real
 * `page.goto` rather than `.click()` + `waitForURL`. A plain `.click()` on
 * a `Link` occasionally lands as a silently-swallowed no-op deep into a
 * long capture run (root cause not isolated — reproduced consistently only
 * in the full run, never in a short standalone repro of the same page) —
 * `waitForURL` then times out with no diagnostic beyond "nothing
 * happened". Going by `href` sidesteps the click entirely and is exactly as
 * faithful a capture of the destination screen, which is this script's own
 * purpose (CLAUDE.md §18.1) — it is not testing that the link itself is
 * clickable (Playwright's E2E suite already covers that).
 */
async function followLink(page, locator) {
  const href = await locator.getAttribute('href');
  if (!href) throw new Error('followLink: locator has no href');
  await page.goto(`${ORIGIN}${href}`, { waitUntil: 'networkidle' });
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  // Always light at the OS/browser level, regardless of `--theme`: dark
  // capture is driven by actually clicking `ThemeToggle` below, not by the
  // `prefers-color-scheme` media feature. Leaving this as `theme === 'dark'
  // ? 'dark' : 'light'` would make `next-themes`' own `system` default
  // resolve dark before the toggle is ever clicked — the click would then
  // switch it back OFF to light, the opposite of what `--theme=dark` asks
  // for.
  colorScheme: 'light',
  locale: 'pt-BR',
});
// The Next.js dev-overlay portal is a fixed element pinned to the bottom-left
// of the viewport, and it swallows pointer events over whatever sits beneath
// it. The collapsed sidebar's "Expandir menu lateral" button lands in exactly
// that corner, so the click was retried 58 times and the whole run timed out
// with no risk-detail captures at all. Hiding the portal is honest here: it is
// dev-server chrome, never part of the product, and it must not appear in a
// review screenshot either.
// A string body, not a closure: this file is linted with Node globals only, so
// a literal `document` reference here would fail lint even though Playwright
// evaluates it in the page (same reason as the `waitForFunction` above).
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
// Surfaces a client-side render crash (a React error boundary's "Application
// error" page looks fine in a screenshot's top-left corner and easy to miss
// in a full-page capture) as loud console output instead of a silent blank
// page — this is exactly the class of defect this whole script exists to
// catch (module doc comment above).
page.on('pageerror', (err) => console.log('  [PAGEERROR]', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('  [CONSOLE ERROR]', msg.text());
});

if (surface === 'full') {
  await mkdir(outDir, { recursive: true });
  console.log(`capturing -> ${outDir} (${theme}, ${width}x${height})`);

  // Login is the only surface that must be captured signed out.
  await page.goto(`${ORIGIN}/login`, { waitUntil: 'networkidle' });
  await shoot(page, '01-login');
} else {
  console.log(`capturing -> ${outDir}-${theme}-<width> (${surface}, ${theme})`);
}

await signIn(page);

if (theme === 'dark') {
  // Drive the real toggle (ThemeToggle, `components/shell/theme-toggle.tsx`)
  // rather than forcing the class — see the header comment above.
  await page.getByRole('button', { name: 'Alternar entre tema claro e escuro' }).click();
  // A string body (not a closure referencing `document`) so this Node-context
  // file, linted with Node globals only, never needs a browser global here —
  // Playwright still evaluates it in the page.
  await page.waitForFunction('document.documentElement.classList.contains("dark")');
}

/**
 * Administração → Papéis e permissões, across every supported width, in one
 * session (see this file's header for why the width loop lives here).
 *
 * Eighteen states per width, in capture order. They are the union of what the
 * screen has grown through five phases of work — the read panel, the
 * collapsible filter bar, the paginated roster, the pt-BR role label beside
 * the stored identifier, and the create panel — so one directory per
 * theme/width describes the screen as it is, not as it was at some point
 * during the sequence.
 *
 * Every wait below is on an element that exists only once REAL data has
 * rendered — a seeded role's own card button, a rendered e-mail — never on
 * the page heading or a skeleton, both of which appear before any role does
 * (F-28).
 */
async function captureRolesSurface() {
  // The seeded roles now READ in pt-BR while `Role.name` stays the English
  // identifier (ADR-022). Card names, headings and search results below are
  // the LABEL; the API payload is the stored name.
  const PLATFORM_ADMIN_LABEL = 'Administrador da Plataforma';
  const seededCard = new RegExp(`^Abrir detalhes do papel ${PLATFORM_ADMIN_LABEL}`);

  // All twelve seeded roles are system roles, so the custom-role states have
  // no subject unless one is created. It is deleted — and the deletion
  // verified — at the end of this function.
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

  /**
   * Closes whichever presentation of the panel is on screen.
   *
   * `Escape`, never the header's close button: that button exists ONLY in the
   * inline presentation. Below `xl` the panel is a `Sheet`, which renders its
   * own close control and is given no close pair of its own precisely so the
   * two do not appear together (`role-panel-shell.tsx`). A capture script that
   * clicked the inline button at every width therefore stalled for thirty
   * seconds the first time it reached 1024 — a defect in this script, not in
   * the screen. `Escape` closes both.
   */
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
      // The indicators are a second, independently-loaded request; waiting
      // for one of them too means the capture shows the whole surface rather
      // than the list with four skeletons above it.
      const systemIndicator = page.getByRole('button', {
        name: 'Mostrar somente os papéis do sistema',
      });
      await systemIndicator.waitFor({ state: 'visible', timeout: 30_000 });
      await shoot(page, '01-list', dir);

      // --- The filter bar: what the disclosure hides, and what it does not
      const filtersToggle = page.getByRole('button', { name: /^Filtros/ });
      await filtersToggle.click();
      await page.waitForTimeout(250);
      await shoot(page, '02-filters-open', dir);

      await systemIndicator.click();
      await page.waitForTimeout(250);
      await filtersToggle.click();
      await page.waitForTimeout(250);
      // The machinery is hidden; the STATE is not — the chip stays outside
      // the closed panel, and the count rides the button.
      await shoot(page, '03-filter-applied', dir);

      await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
      await page.getByLabel('Buscar papéis').fill('zzz-nenhum-papel-com-este-nome-zzz');
      await page.getByText('Nenhum papel encontrado').waitFor({ state: 'visible' });
      await shoot(page, '04-empty-filtered', dir);
      await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
      await card.waitFor({ state: 'visible' });

      // --- The detail panel on a seeded system role --------------------
      await card.click();
      const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
      await panel.waitFor({ state: 'visible' });
      await page.waitForTimeout(400);
      await shoot(page, '05-panel-open-selected-card', dir);

      await panel.getByRole('button', { name: 'Expandir todos' }).click();
      await page.waitForTimeout(300);
      await shoot(page, '06-modules-expanded', dir);

      await panel.getByRole('button', { name: 'Ver identificadores técnicos' }).click();
      // The role's OWN stored name is revealed by this same control, so this
      // shot carries both halves of ADR-022 at once.
      await panel.getByText('Nome técnico:').waitFor({ state: 'visible' });
      await shoot(page, '07-identifiers-visible', dir);

      // --- The roster, and the page turn that reaches past it -----------
      await panel.getByRole('tab', { name: 'Usuários' }).click();
      await panel.getByText(/@/).first().waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(300);
      await shoot(page, '08-users-tab-page-1', dir);

      await panel.getByRole('button', { name: 'Próxima página' }).click();
      await panel.getByText(/^11–/).waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(300);
      await shoot(page, '09-users-tab-page-2', dir);

      // --- The definition sheet of a role that is legible and locked ----
      // F-68 (2026-09-14): a system role has no editable field at all, so
      // the panel offers "Ver definição" rather than "Editar papel", and
      // the sheet it opens carries no save control — only "Voltar".
      await panel.getByRole('tab', { name: 'Permissões' }).click();
      await panel.getByRole('button', { name: 'Ver definição' }).click();
      await panel
        .getByText('Papel do sistema: o nome não pode ser alterado.')
        .waitFor({ state: 'visible' });
      await shoot(page, '10-edit-system-locked', dir);
      await panel.getByRole('button', { name: 'Voltar' }).click();
      await panel.getByRole('button', { name: 'Ver definição' }).waitFor({ state: 'visible' });
      await closePanel();

      // --- The same panel on the custom role ---------------------------
      await page.getByLabel('Buscar papéis').fill(customRoleName);
      const customCard = page.getByRole('button', {
        name: new RegExp(`^Abrir detalhes do papel ${customRoleName.replace(/[()]/g, '\\$&')}`),
      });
      await customCard.waitFor({ state: 'visible', timeout: 30_000 });
      await customCard.click();
      await panel.waitFor({ state: 'visible' });
      await page.waitForTimeout(400);
      await shoot(page, '11-panel-custom-role', dir);

      // A role nobody holds — the state a roster has to have an answer for.
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

      // --- Composing a new role, in the same panel ---------------------
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

      // Discarded, never submitted: this run must not leave a second role
      // behind, and the discard question is itself part of the flow.
      await createPanel.getByRole('button', { name: 'Cancelar' }).click();
      await page.getByRole('button', { name: 'Descartar', exact: true }).click();
      await createPanel.waitFor({ state: 'hidden' });

      // --- The failure state, with the API refusing the listing ---------
      // The problem document below is INJECTED by this harness, not produced
      // by the server: there is no way to make a healthy backend fail on
      // demand, and a screenshot of a screen that never fails would say
      // nothing about the one state a reader most needs to recognise. The
      // route is removed immediately afterwards.
      await page.route('**/api/v1/admin/roles?*', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://pharosgrc.dev/problems/http-500',
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

  // Cleanup runs whether the capture finished or threw, but it does NOT throw
  // from a `finally`: that would replace the capture's own error with the
  // cleanup's, and the capture error is the one worth reading. Both are
  // reported, capture first.
  const cleanupError = await deleteCaptureRole(customRoleId);
  if (captureError) throw captureError;
  if (cleanupError) throw cleanupError;
}

/**
 * Deletes the capture's custom role and VERIFIES it is gone.
 *
 * Returns the `Error` instead of throwing, so the caller decides which of two
 * possible failures to surface. A cleanup that fails quietly is how a shared
 * database fills up with fixture rows nobody notices until a screenshot shows
 * one (`specs/012-admin-roles-screen/STATE.md` §4).
 */
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

/**
 * Risk detail (016-risk-detail-experience) — six specific leaf sections,
 * across every supported width, in one session (see this file's header for
 * why the width loop lives inside a surface function rather than being one
 * invocation per width).
 *
 * ## Six leaves, not "the five groups, first leaf each"
 *
 * An earlier version of this function captured one shot per level-1 GROUP,
 * stopping at whichever leaf a bare group click lands on by default
 * (`resolveActiveRiskDetailSection`'s own contract — the group's first
 * VISIBLE section). That undershot what a review of the 2026-09-16/17
 * refinement (five areas: summary row, Análise, Resposta, Causas e
 * Consequências, Achados) actually needs to show: "Resposta" landed on
 * Tratamento and never reached Planos de Ação, "Relacionamentos" landed on
 * Incidentes and never reached Achados, and "Análise" never showed Causas e
 * Consequências at all. This version navigates every leaf DIRECTLY via
 * `?section=<id>` (the deep link 016-risk-detail-experience §4.4 added) —
 * simpler than a two-click group-then-leaf dance and correct regardless of
 * which leaf a group would otherwise default to.
 *
 * A one-off ad hoc script producing capture directories nobody could
 * reproduce is exactly the defect `specs/015-roles-permissions-surface/
 * STATE.md` §13 item 1 already recorded once (148 uncommitted captures) —
 * this mode existing, committed, at a fixed six-leaf list, is what makes
 * these six shots reproducible by anyone who runs the two commands in this
 * file's own header, rather than a coordinator's private scratchpad script.
 *
 * Unlike `captureRolesSurface`, this mode does not provision a fixture of
 * its own: by default it captures the FIRST risk `/risks` already lists
 * (matching the `--surface=full` sweep's own "pick a real assessed risk"
 * convention, above) rather than creating and tearing down a throwaway one,
 * since a risk carries far more state to seed realistically (an assessment,
 * a treatment decision, linked controls/processes/assets, evidence, several
 * findings) than the roles screen's one custom role. Point this at a
 * seeded/dev database that already has at least one risk with real content —
 * an empty risk still captures, just with more empty states than a reviewer
 * needs to see.
 *
 * `--riskId=<uuid>` overrides the "first risk in the register" default and
 * navigates straight to `/risks/<uuid>` — for pinning this capture to a
 * SPECIFIC already-seeded risk on a shared dev database (e.g. one whose
 * organizational unit already carries a real volume of Achados) without
 * hardcoding that id into this file, which would make it wrong the moment a
 * different database is seeded. Nothing is provisioned or cleaned up for
 * this option — it only changes which existing risk is opened.
 */
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

  /**
   * The six leaves, in the order the coordinator asked for them, each named
   * by its own two-level path so a reviewer never has to cross-reference a
   * number back to a section. `groupLabel`/`leafLabel` (`null` for "Visão
   * geral", the one group with no nested tablist —
   * `risk-navigation.ts`'s own documented contract) are used only to WAIT
   * for the deep link to have actually landed before shooting, not to click
   * anything — mirrors `e2e/support/risk-detail-sections.ts`'s
   * `RISK_DETAIL_SECTIONS` table, which this script cannot `import` (a plain
   * `.mjs` run directly by `node`, no TS loader — same reasoning
   * `openRiskDetailLeaf` above already documents).
   */
  const LEAVES = [
    ['01-visao-geral', 'overview', 'Visão geral', null],
    ['02-analise-avaliacao', 'assessment', 'Análise', 'Avaliação'],
    ['03-analise-causas-consequencias', 'causes-consequences', 'Análise', 'Causas e Consequências'],
    ['04-resposta-tratamento', 'treatment', 'Resposta', 'Tratamento'],
    ['05-resposta-planos-de-acao', 'action-plans', 'Resposta', 'Planos de Ação'],
    ['06-relacionamentos-achados', 'findings', 'Relacionamentos', 'Achados'],
  ];

  /**
   * Waits for the deep link to have actually resolved to the expected
   * group/leaf — never trusts the navigation alone — the same render-commit
   * race `openRiskDetailLeaf` above guards against, here on the SELECTED
   * state rather than on a click target. Tolerant of a leaf this signed-in
   * identity cannot see (e.g. "Achados" without `finding:view`): logs and
   * returns `false` rather than throwing, so one missing permission does not
   * abort the other five leaves.
   */
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
      // A fresh navigation per leaf, not just a deep-link replace, so one
      // leaf's own state (a search box filled in a picker, a dialog left
      // open) can never bleed into the next — the same defensive reset
      // every width iteration of `captureRolesSurface` gets from its own
      // `page.goto`.
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

      /**
       * Grows the viewport to fit THIS leaf's actual content before
       * shooting, never shrinks below the configured `height` — measured
       * directly, not guessed. `<main>` (`app-shell.tsx`), not the document,
       * is the app shell's own scrolling container (`overflow-y-auto`), so
       * Playwright's `fullPage` screenshot has nothing of its own to stitch
       * past the viewport's height — CLAUDE.md §18.13's own documented trap,
       * confirmed directly here: Achados against an organizational unit
       * carrying real volume (~100 findings, this file's own header) cut off
       * more than half the list at the shared `height` default that the
       * other five, far shorter leaves render correctly at. A single fixed
       * `--height` tall enough for Achados-at-scale would instead leave a
       * large blank band under the other five (the exact artefact this same
       * section already warns about) — measuring per leaf avoids both.
       */
      // A string body, not a closure referencing `document` — this file is
      // linted with Node globals only (see the `nextjs-portal`-hiding
      // `addInitScript` above for the same reasoning); Playwright still
      // evaluates it in the page.
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

/**
 * Incident detail (018-incident-detail-experience) — one shot per top-level
 * GROUP, across every supported width, in one session — the same shape
 * `captureRiskDetailSurface` established, deliberately simpler: Incident has
 * four groups against Risk's five, and unlike Risk's six hand-picked leaves
 * (chosen because a bare group click undershot several leaves worth
 * reviewing on their own), the coordinator's own ask for this surface was
 * literally "the four groups" — one representative leaf per group is enough
 * to show each group's own landing state; a leaf-by-leaf sweep of all nine
 * sections was not asked for and would just be six more near-identical
 * relationship-table shots.
 *
 * Like `captureRiskDetailSurface`, this mode provisions nothing of its own:
 * by default it captures the FIRST incident `/incidents` already lists.
 * `--incidentId=<uuid>` pins it to a specific already-seeded incident
 * instead (e.g. one carrying real relationship volume) — mirrors
 * `--riskId` exactly, including that nothing is provisioned or cleaned up
 * for this option.
 */
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

  /**
   * One representative leaf per group — `groupLabel`/`leafLabel` (`null`
   * for the two single-leaf groups, "Visão geral"/"Resposta") are used only
   * to WAIT for the deep link to have actually landed, never to click
   * anything, mirroring `captureRiskDetailSurface`'s own `LEAVES`/
   * `waitForLeafActive` exactly. This script cannot `import` `e2e/support/
   * incident-detail-sections.ts` (a plain `.mjs` run directly by `node`, no
   * TS loader) so the table is restated here — the same documented caveat
   * that file's own header records for its risk-detail counterpart.
   */
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

/**
 * Problem detail (019-problem-detail-experience) — one shot per top-level
 * GROUP, across every supported width, in one session — the exact same
 * shape `captureIncidentDetailSurface` established (Problem's own detail
 * screen mirrors Incident's shell/navigation/aside/overlay pattern, one
 * group fewer to cover since Problem has only two relationship leaves
 * against Incident's four, but the same four TOP-LEVEL groups). Deliberately
 * NOT a copy-pasted second capture mode with its own logic — see this
 * file's own header comment: CLAUDE.md §18.2 names exactly one capture
 * tool, and duplicating the mechanism here rather than reusing the shape
 * would be the first step toward a second one.
 *
 * Provisions nothing of its own: by default it captures the FIRST problem
 * `/problems` already lists. `--problemId=<uuid>` pins it to a specific
 * already-seeded problem instead — mirrors `--incidentId`/`--riskId`
 * exactly, including that nothing is provisioned or cleaned up for this
 * option. The coordinator's own Fase E instruction was explicit: use
 * whatever data already exists in the environment, do not provision volume
 * for this capture.
 */
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

  /**
   * One representative leaf per group — `groupLabel`/`leafLabel` (`null`
   * for the two single-leaf groups, "Visão geral"/"Resposta") are used only
   * to WAIT for the deep link to have actually landed, never to click
   * anything, mirroring `captureIncidentDetailSurface`'s own `GROUPS`/
   * `waitForLeafActive` exactly. This script cannot `import` `e2e/support/
   * problem-detail-sections.ts` (a plain `.mjs` run directly by `node`, no
   * TS loader) so the table is restated here — the same documented caveat
   * that file's own header records.
   */
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

/**
 * Action detail (020-action-detail-experience) — two shots per width, one
 * per FLAT section ("Visão geral", "Auditoria"). Deliberately NOT the
 * `GROUPS`/`?section=` shape `captureIncidentDetailSurface`/
 * `captureProblemDetailSurface` use: Action's own detail screen has no
 * two-level navigation and no `?section=` deep link at all
 * (`action-detail-view.tsx`'s own Fase A header comment — the coordinator
 * measured `stripOverflow = 0` for this screen's two sections, so the
 * problem two-level navigation/deep-linking solve does not exist here).
 * Reaching "Auditoria" for this capture therefore clicks the tab directly,
 * exactly as a real reader would, rather than navigating a query string
 * this screen was deliberately never given.
 *
 * No static `--height` default (unlike `risk-detail`/`incident-detail`/
 * `problem-detail`'s own 2200 estimate): this screen has no aside and no
 * summary row, and its tallest state — the "Ciclo de vida" card with its
 * outcome facts — was measured directly during this rodada's own rendered
 * verification at well under 1440px tall. Each shot below measures its own
 * `document.querySelector('main')?.scrollHeight` and grows the viewport
 * only if needed, mirroring `captureProblemDetailSurface`'s own dynamic
 * sizing exactly, rather than asserting a number that was never measured.
 *
 * Provisions nothing of its own: by default it captures the FIRST action
 * `/actions` already lists (switched to Tabela — the row-based "find one
 * real record" convention every sibling surface's own default already
 * uses). `--actionId=<uuid>` pins it to a specific already-seeded action
 * instead — mirrors `--problemId`/`--incidentId`/`--riskId` exactly,
 * including that nothing is provisioned or cleaned up for this option.
 */
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

    // Fresh load per width — `EntityTabs` here is UNCONTROLLED (no
    // `?section=`), so its selected tab is plain React state that would
    // otherwise carry over from the previous width's last section.
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

/** Risk register only: existing records, one session, all widths and both list views. */
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
    // Existing data only: a heading/skeleton is not evidence of rendered cards.
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
      // The shell scrolls main; grow for the artifact after checking the real viewport.
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
  // Optional read-only interaction evidence against an existing register with >25 records.
  // No fixtures are provisioned by this capture surface.
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
    // No quick-view panel exists any more: a card's own links navigate
    // straight to the full record. Prove that directly, then keyboard-only.
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

/**
 * Dashboard (Dashboard V2, `024-dashboard-v2`) — one shot per width, the
 * landing screen as the signed-in identity actually sees it. Provisions
 * nothing: the screen reads existing aggregate data
 * (`GET /dashboard`/`GET /dashboard/summary`), never a record of its own,
 * so there is nothing to create or clean up — unlike `--surface=roles`,
 * which creates and deletes a custom role because the states it captures
 * cannot exist otherwise.
 *
 * A single shot per width (not a multi-state walk like `--surface=roles`
 * or the six-leaf risk-detail sweep): the dashboard has no tabs, no
 * dialogs, no filter states of its own to walk — its own content already
 * varies by which cards the summary includes, which this mode does not
 * try to control.
 */
async function captureDashboardSurface() {
  await page.goto(`${ORIGIN}/dashboard`, { waitUntil: 'networkidle' });
  // Waits for a REAL chart `<svg>`, not just the page heading or the
  // accessible data table alone — the same F-28 lesson
  // `accessibility.spec.ts`'s own dashboard scans document: the table
  // mounts before Recharts finishes measuring and painting, so a capture
  // that only waited for text could show the loading/pre-chart state.
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

/**
 * Control detail (021-control-detail-experience) — one shot per FLAT
 * section ("Visão geral", "Verificações", "Vínculos", "Evidências"),
 * across every supported width, in one session. Closer to
 * `captureProblemDetailSurface`'s/`captureIncidentDetailSurface`'s own
 * `?section=<id>` deep-link navigation than to `captureActionDetailSurface`'s
 * own tab-click approach: Control ADOPTED the `?section=` deep link
 * (`control-detail-view.tsx`'s own Fase A header comment — unlike Action,
 * which declined it), so reaching each section here navigates the URL
 * directly, exactly as a shared link would. There is also no two-level
 * GROUPS structure to navigate (Control's own Fase A decision: four
 * sections don't justify grouping, unlike Risk/Incident/Problem) — so,
 * unlike `captureProblemDetailSurface`'s own `waitForLeafActive`, this
 * only ever waits on ONE tablist, never a group-then-leaf pair.
 *
 * No static `--height` default, mirroring `captureActionDetailSurface`'s
 * own choice rather than `captureRiskDetailSurface`'s/`captureProblemDetail
 * Surface`'s estimated `2200`: this screen's own tallest state was never
 * measured at a fixed number during this rodada's own rendered
 * verification, so each shot below measures its own
 * `document.querySelector('main')?.scrollHeight` and grows the viewport
 * only if needed, rather than asserting a number that was never checked.
 *
 * Provisions nothing of its own: by default it captures the FIRST control
 * `/controls` already lists. `--controlId=<uuid>` pins it to a specific
 * already-seeded control instead (e.g. one already ACTIVE, with an owner,
 * a verification and a linked process/asset, so the capture shows that
 * volume without provisioning anything new for it) — mirrors
 * `--problemId`/`--incidentId`/`--riskId`/`--actionId` exactly, including
 * that nothing is provisioned or cleaned up for this option.
 */
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

  /**
   * The four flat sections, in tab order — `sectionId` is the exact
   * `?section=<id>` value `control-detail-view.tsx`'s own `tabs` array
   * uses, and `label` is used only to WAIT for the deep link to have
   * actually landed (the tab's own accessible name), never to click
   * anything.
   */
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
      // A fresh navigation per section, not just a deep-link replace —
      // mirrors `captureRiskDetailSurface`'s own reasoning: one section's
      // own state (a search box filled in a picker, a dialog left open)
      // must never bleed into the next.
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

/**
 * Asset detail (022-asset-detail-experience) — one shot per FLAT section
 * ("Visão geral", "Riscos", "Controles", "Incidentes"), across every
 * supported width, in one session. Mirrors `captureControlDetailSurface`
 * almost exactly: Asset ALSO adopted the `?section=` deep link (Fase A) and
 * ALSO has no two-level GROUPS structure (four sections, all unconditional
 * — unlike Control's own permission-gated fourth, Asset's `Incidentes` is
 * always visible), so this navigates the URL directly per section and waits
 * on a single tablist, exactly like Control's own capture.
 *
 * No static `--height` default, same reasoning as Control's/Action's own
 * captures: each shot measures its own `document.querySelector('main')?.
 * scrollHeight` and grows the viewport only if needed.
 *
 * Provisions nothing of its own: by default it captures the FIRST asset
 * `/assets` already lists. `--assetId=<uuid>` pins it to a specific
 * already-seeded asset instead (e.g. one already linked to a risk/control,
 * so the capture shows a real, non-empty relationship table without
 * provisioning anything new for it) — mirrors `--controlId`/`--riskId`/
 * `--incidentId`/`--problemId`/`--actionId` exactly, including that nothing
 * is provisioned or cleaned up for this option.
 */
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

  /**
   * The four flat sections, in tab order — `sectionId` is the exact
   * `?section=<id>` value `asset-detail-view.tsx`'s own `tabs` array uses,
   * and `label` is used only to WAIT for the deep link to have actually
   * landed (the tab's own accessible name — the SHORT one, Fase A: "Riscos"/
   * "Controles"/"Incidentes", never "vinculados"), never to click anything.
   */
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
      // A fresh navigation per section, not just a deep-link replace —
      // mirrors `captureControlDetailSurface`'s own reasoning: one
      // section's own state must never bleed into the next.
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

// Risk register, the table view. The plain `/risks` shot above catches the
// default (cards); this one catches the state a reviewer cannot otherwise
// see, and it is guarded the same way every optional surface here is — a run
// against a register with no risks in scope skips it rather than failing the
// whole capture. There is no quick-view panel to capture any more: a card's
// links navigate straight to the full record.
await page.goto(`${ORIGIN}/risks`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const tableToggle = page.getByRole('radio', { name: 'Ver os riscos em tabela' });
if (await tableToggle.count()) {
  await tableToggle.click();
  await page.waitForTimeout(700);
  await shoot(page, '03e-risk-register-table');
}

// Collapsed sidebar (Wave 2, CLAUDE.md §18 shell refinement) — captured once,
// back on the dashboard, then restored so it doesn't affect anything after.
await page.goto(`${ORIGIN}/dashboard`, { waitUntil: 'networkidle' });
// Guarded: below the sidebar's breakpoint the persistent rail is replaced by a
// sheet and this control does not exist, so a narrow-viewport run must skip the
// pair rather than fail the whole capture.
const collapse = page.getByRole('button', { name: 'Recolher menu lateral' });
if (await collapse.count()) {
  await collapse.click();
  await page.waitForTimeout(250);
  await shoot(page, '02b-dashboard-sidebar-collapsed');
  // Best-effort restore, not fatal: an intermittent dev-server hiccup here
  // (observed a few times in this environment, unrelated to the sidebar
  // itself) must not abort every capture still queued after it — including
  // every compliance screenshot below, which is this run's actual purpose.
  try {
    await page.getByRole('button', { name: 'Expandir menu lateral' }).click({ timeout: 10_000 });
  } catch (error) {
    console.log('  [WARN] could not restore the expanded sidebar — continuing.', error.message);
    await page.goto(`${ORIGIN}/dashboard`, { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(250);
}

// Risk detail: pick a real assessed risk so every tab has content to render.
//
// 016-risk-detail-experience regrouped the flat fourteen-tab strip into a
// TWO-level navigation (five groups, each with its own leaf strip) — Radix
// only mounts a group's own leaf tablist once that group is the ACTIVE one,
// so a single `getByRole('tab', { name: <regex> })` click (what this block
// used to do) can no longer resolve a leaf that sits behind an unselected
// group. `openRiskDetailLeaf` below clicks the parent group tab first, then
// the leaf — this script cannot `import` the TS support helper the E2E suite
// uses for the same two clicks (`e2e/support/risk-detail-sections.ts`; this
// is a plain `.mjs` run directly by `node`, no TS loader) — labels are
// therefore hardcoded pt-BR literals here, matching every other label in
// this script (see `captureRolesSurface`'s own header) and matching the
// canonical source, `apps/web/src/lib/messages/risks.ts`'s `detail.groups`/
// `detail.sections`.
await page.goto(`${ORIGIN}/risks`, { waitUntil: 'networkidle' });
const firstRisk = page.getByRole('link', { name: /^RSK-/ }).first();
if (await firstRisk.count()) {
  await firstRisk.click();
  await page.waitForURL(/\/risks\/[0-9a-f-]+/, { timeout: 15_000 });
  await page.waitForTimeout(800);
  await shoot(page, '05-risk-detail-overview');

  /**
   * Clicks the level-1 group tab (`groupLabel`, inside the "Grupos de
   * seções do risco" tablist) and, when `leafLabel` is given, the group's
   * own level-2 leaf tab (inside "Seções de <groupLabel>") — `null` for
   * "Visão geral", the one group with no nested tablist at all (a single
   * section, rendered directly — mirrors `risk-navigation.ts`'s own
   * documented contract). Tolerant of a leaf that does not exist for this
   * signed-in identity (e.g. "Auditoria" without `audit:view`), exactly
   * like the pre-016 version of this block tolerated a missing tab.
   */
  async function openRiskDetailLeaf(groupLabel, leafLabel) {
    const groupTablist = page.getByRole('tablist', { name: 'Grupos de seções do risco' });
    const groupTab = groupTablist.getByRole('tab', { name: groupLabel, exact: true });
    if (!(await groupTab.count())) return false;
    await groupTab.click();
    if (leafLabel === null) return true;
    // `waitFor` (not an immediate `.count()`) — the leaf tablist mounts only
    // once React commits the group click's re-render, a tick or two after
    // the click event itself; an immediate `.count()` here raced that commit
    // and produced false negatives for a leaf that appears a moment later,
    // which is a defect in a script tolerating a MISSING (permission-gated)
    // tab, not a real absence.
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

// Provision one real control end-to-end so the catalog and detail captures
// below show a populated state, not an empty one — a fresh database has no
// control yet. `--theme=dark` still uses this same provisioning (the toggle
// above already switched to dark by this point), so this only runs once per
// invocation and both theme runs get their own control.
await page.goto(`${ORIGIN}/controls/new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await shoot(page, '21-control-new');
await page.getByLabel('Nome').fill(`Revisão de acessos privilegiados (${theme})`);
await page
  .getByLabel('Descrição')
  .fill('Revisão trimestral dos acessos privilegiados concedidos em sistemas críticos.');
await page.getByRole('combobox', { name: 'Unidade organizacional' }).click();
await page.getByRole('option').first().click();
// The owner picker only populates — and becomes enabled — once an org unit
// is selected (the assignment-listing fetch this task's own instructions
// call out). `.click()` already auto-waits for the trigger to become
// actionable (visible, enabled, stable), so no extra polling is needed here.
const ownerCombobox = page.getByRole('combobox', { name: 'Responsável pelo controle' });
await ownerCombobox.click();
// `.nth(1)`, not `.first()`: the owner picker's own first option is the
// "Selecione o responsável" placeholder sentinel (owner is optional at
// creation, FR-005) — clicking it is a no-op that leaves the owner unset,
// which then leaves the control permanently unable to activate below.
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
// `ControlLifecycleActions` fetches its own lifecycle state after the
// detail page itself has rendered — a beat beyond `networkidle` avoids
// racing its "Aplicar: Ativo" button into existence before it renders.
await page.waitForTimeout(500);

// Activate it (US1 AS2) so the catalog/detail captures show an ACTIVE
// control, not a permanent DRAFT.
const activateButton = page.getByRole('button', { name: /^Aplicar: Ativo/ });
if (await activateButton.count()) {
  await activateButton.click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.waitForTimeout(600);
}

// Record one assessment (US2) so the "Verificações" tab has real history to
// show, and request its attestation so the segregation-of-duties state
// (D-3, FR-017/FR-018) is visible rather than only described.
const assessmentsTab = page.getByRole('tab', { name: /verifica/i });
if (await assessmentsTab.count()) {
  await assessmentsTab.click();
  await page.waitForTimeout(400);
  const resultCombobox = page.getByRole('combobox', { name: 'Resultado' });
  if (await resultCombobox.count()) {
    await resultCombobox.click();
    // Exact match: a loose match also hits "Parcialmente efetivo" (Playwright's
    // strict mode then refuses to guess between the two).
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

// Control catalog: the table view (003-controls-management, mirroring the
// risk register block above — CLAUDE.md §18.12). There is no quick-view
// panel to capture any more: a card's links navigate straight to the full
// record.
await page.goto(`${ORIGIN}/controls`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const controlTableToggle = page.getByRole('radio', { name: 'Exibir como tabela' });
if (await controlTableToggle.count()) {
  await controlTableToggle.click();
  await page.waitForTimeout(700);
  await shoot(page, '20c-control-catalog-table');
}

// Control detail: pick a real control so every tab has content to render.
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

// Compliance — normative library, requirement↔control mapping, mapping
// migration and the calculated compliance state (004-compliance-management,
// US1 to US3). All 23 contract operations are live server-side.
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
// "Visão geral" is the default tab: publish card + the calculated
// compliance summary, honestly showing "nothing to measure yet" — zero
// requirements exist on this version so far.
await shoot(page, '55-compliance-version-detail-overview-empty');

await page.getByRole('tab', { name: 'Requisitos (cláusulas)' }).click();
await page.waitForTimeout(400);
await shoot(page, '55b-compliance-requirements-tab-empty');

// Create the first requirement (US1) through the real dialog-based form —
// the genuine, server-fetched listing (operation 10) replaces the
// session-scoped workaround the first UI slice shipped with. `.first()`:
// the empty state's own action button shares this exact name with the
// section header's — the same established pattern `FrameworkListView`'s
// own empty state already uses, not new to this screen.
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

// Requirement detail — the real per-clause screen (US2/US3): compliance
// state, control mapping, applicability.
await followLink(page, page.getByRole('link', { name: 'Política de segurança da informação' }));
await page.waitForTimeout(400);
// Freshly created, no control linked yet: "Não atendido" (never "conforme"
// by omission, FR-018) — distinct from "Não comprovado" below.
await shoot(page, '57b-compliance-requirement-detail-not-met');

await page.getByRole('button', { name: 'Editar', exact: true }).click();
await page.waitForTimeout(300);
await shoot(page, '58-compliance-requirement-edit-form');
await page.getByRole('button', { name: 'Cancelar edição' }).click();
await page.waitForTimeout(200);

// Control mapping (US2, ADR-020) — link the control this same script
// already provisioned and attested earlier, so the transition away from
// "Não atendido" is a real, server-computed state, not a fixture.
await page.getByRole('tab', { name: 'Controles mapeados' }).click();
await page.waitForTimeout(300);
await shoot(page, '58b-compliance-requirement-control-mapping-empty');
await page.getByRole('combobox', { name: 'Vincular controle' }).click();
const controlOption = page.getByRole('option', { name: /^Revisão de acessos privilegiados/ });
// A real `waitFor`, not a fixed sleep: the picker's own registry fetch is
// async (`ensureOptionsLoaded`), and a 200ms guess left this Radix `Select`
// OPEN when the fetch had not resolved yet — its full-viewport outside-click
// overlay then silently swallowed every click for the rest of the run (the
// actual root cause behind what first looked like unrelated flakiness on
// the "Aplicabilidade" tab click much later). `{ state: 'attached' }` with
// a generous timeout, and an explicit Escape in the `catch`, so this Select
// is never left open no matter which way this resolves.
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

// Applicability (US3, FR-015/FR-016) — the default-applicable state, the
// mandatory-justification dialog, then the active declaration with the
// "kept but excluded" notice for a clause that still carries a control
// link (the edge case the spec names explicitly).
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

// Revoke it again — the requirement re-enters the compliance calculation,
// and publishing below should measure a real, mapped clause.
const revokeButton = page.getByRole('button', { name: 'Revogar declaração' });
if (await revokeButton.count()) {
  await revokeButton.click();
  await page.waitForTimeout(200);
  await shoot(page, '58g-compliance-requirement-applicability-revoke-confirm');
  await page.getByRole('button', { name: 'Revogar declaração' }).click();
  await page.waitForTimeout(500);
}

// Back to the version — "Visão geral" now shows a real requirement count
// and a calculated compliance summary (likely "Não comprovado": the linked
// control has no completed attestation in this run — mapped, but not yet
// proven, distinct from "Não atendido").
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

// Mapping migration (US2, FR-012 to FR-014) — create the framework's next
// version, give it one requirement of its own, then migrate the mapping
// from "2022" into it, deciding one correspondence by hand.
const currentUrl = new URL(page.url());
const frameworkPath = currentUrl.pathname.split('/versions/')[0];
await page.goto(`${ORIGIN}${frameworkPath}`, { waitUntil: 'networkidle' });
// A generous, explicit wait before the next role query: `networkidle` only
// promises the network is quiet, not that this client component's own fetch
// has finished re-rendering past its loading skeleton.
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
// `.first()`: the empty state's own action button shares this exact name
// with the panel header's, the same established pattern as "Cadastrar
// requisito" above.
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
// A real `waitFor`, not a fixed sleep — see the identical comment above the
// requirement-control picker: leaving this `Select` open on an empty check
// is exactly the bug that first looked like unrelated flakiness.
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

// Audit engagements — register, creation, detail, scope, lifecycle and the
// findings an engagement produces (005-audit-findings, US1-US3). Provisions
// one real engagement end-to-end so the detail/scope/findings captures show
// a populated state rather than three empty sections, the same way the
// control and compliance blocks above provision their own subject.
await page.goto(`${ORIGIN}/audits`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shoot(page, '70-audit-register-empty');

await page.goto(`${ORIGIN}/audits/new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await shoot(page, '71-audit-new');

// Exact labels, never a loose regex: `/período/i` matches BOTH "Início do
// período" and "Fim do período", which Playwright's strict mode rejects —
// the same trap CLAUDE.md §18.13 records for `/senha/i`.
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

// Scope: the three variants are tabs, each an explicit auditor decision.
// Captured before adding anything (the empty state plus the no-removal
// notice) and again after a control has been added.
// The three scope variants live INSIDE the detail's own "Escopo" tab —
// clicking the variant tab while "Visão geral" is still selected finds
// nothing, and the guarded block below then silently skips, leaving start
// correctly disabled and the run failing several steps later on a symptom
// rather than the cause. Open the section first.
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
    // A real `waitFor`, not a fixed sleep — same reasoning as the
    // compliance source-option block above: leaving this `Select` open on
    // an empty check is what first looked like unrelated flakiness.
    const firstControlOption = page.getByRole('option').first();
    let hasControlOption = true;
    try {
      await firstControlOption.waitFor({ state: 'attached', timeout: 8_000 });
    } catch {
      hasControlOption = false;
    }
    if (hasControlOption) {
      await firstControlOption.click();
      // "Adicionar", not "Adicionar ao escopo" — the latter is the
      // SECTION HEADING above this control, not the submit button.
      await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
      await page.waitForTimeout(700);
      await shoot(page, '74-audit-scope-populated');
    } else {
      await page.keyboard.press('Escape');
    }
  }
}

// Lifecycle: PLANNING -> IN_PROGRESS. Start is refused without scope
// (FR-003), so this only succeeds because the block above added one.
const startButton = page.getByRole('button', { name: 'Iniciar engajamento' });
// `isEnabled()`, not just `count()`: start is deliberately DISABLED until
// the engagement has at least one scope entry (FR-003), so a scope block
// that silently skipped above must not turn into a 30s click timeout here
// — it must skip too, and say so.
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

// Findings produced by the engagement — only recordable while IN_PROGRESS.
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

// Assets and Processes (006-assets-processes) — the two reference registries
// promoted to domains. Provisions one record of each end to end so the
// catalogue and detail captures show a populated state, the same way the
// control, compliance and audit blocks above provision their own subject.
for (const [slug, singular, submitLabel, recordName] of [
  ['assets', 'ativo', 'Cadastrar ativo', 'Servidor de aplicação'],
  // A process is an activity, not a machine — naming both the same would
  // make the review captures read as if the two catalogues held the same
  // kind of thing, which is exactly what this fase must NOT suggest.
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
  // The organizational unit is REQUIRED (invariant A1) — the form cannot be
  // submitted without it, so this is not an optional step.
  await page.getByRole('combobox', { name: 'Unidade organizacional' }).click();
  await page.getByRole('option').first().click();
  await page.waitForTimeout(200);
  await shoot(page, `${prefix}c-${slug}-new-filled`);

  await page.getByRole('button', { name: submitLabel }).click();
  await page.waitForURL(new RegExp(`/${slug}/[0-9a-f-]+`), { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await shoot(page, `${prefix}d-${slug}-detail`);

  // Deactivation is NOT deletion — the confirmation itself has to say so
  // (FR-012), so it is captured rather than only the resulting state.
  const deactivate = page.getByRole('button', { name: /^Desativar/ }).first();
  if (await deactivate.count()) {
    await deactivate.click();
    await page.waitForTimeout(400);
    await shoot(page, `${prefix}e-${slug}-deactivate-confirm`);
    // Dismiss rather than confirm: the populated catalogue below is more
    // useful showing an active record, and the confirmation copy is what
    // this capture exists to review.
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

// Indicators and Reports (009-indicators-reports, T066) — the indicator
// catalog/detail and the report catalog/creation/run screens.
//
// Indicators is the platform's own closed, eleven-key registry (never an
// empty catalog, `IndicatorCatalogView`'s own header) — and this database
// already has real, non-zero computed values for it (verified before this
// capture: `RISK_TOTAL_BY_LEVEL` returns 87 baixo/1 médio/0 alto/43
// crítico). This is the EXACT screen an earlier capture
// (`docs/reviews/ui/t060-indicators/`) got wrong: every card showed a
// permission-refusal state because the seeded permission table was stale at
// the time. That has since been fixed (seed re-run with the six new
// permissions, API rebuilt) — this capture is what proves the happy path
// with real data, not the empty/forbidden one.
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

  // Register one real measurement so the trend chart has at least one point
  // to render — an empty series shows `TrendChart`'s own dashed empty-state
  // box instead of a chart at all (`trend-chart.tsx`'s own header). Mirrors
  // the same provision-before-capture discipline as Controls/Compliance/
  // Audits above.
  const registerButton = page.getByRole('button', { name: 'Registrar medição agora' });
  if (await registerButton.count()) {
    await registerButton.click();
    await page.waitForTimeout(800);
    await shoot(page, '93-indicator-detail-history-measurement-registered');
  }
}

// Reports — catalog, creation form, and the execution dialog with a real
// computed result. There is no `GET /reports/{id}` detail route
// (`ReportController`'s own header comment) — `ReportRunDialog` IS the
// detail surface for a report, opened from its own catalog row.
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
