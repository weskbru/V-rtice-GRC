import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import {
  requireSeedCredentials,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';

/**
 * 015-roles-permissions-surface — functional coverage for `/admin/roles`,
 * rewritten for the surface this phase built (T052/T053).
 *
 * The screen this file used to describe no longer exists. It was a
 * `DataTable` with a row menu, a read-only `RoleDetailsDialog` and a
 * separate `RoleEditDialog`; it is now four aggregate indicators, search and
 * filters, the roles as cards, and one detail panel that reads AND edits
 * beside the list (D-03, FR-009). Every assertion below was rewritten
 * against the real markup, not adapted by renaming selectors.
 *
 * ## What is proved here, and what is proved elsewhere
 *
 * Six of the thirteen mandatory security-regression scenarios
 * (`plan.md` §3) are browser-only and live in this file:
 *
 * | # | Scenario | Where in this file |
 * |---|---|---|
 * | 1 | `role:administer` WITHOUT `user:administer` — no personal data | "a session holding role:administer …" |
 * | 2 | `user:administer` present — the Users tab works | "the Users tab lists the people …" |
 * | 10 | Keyboard access to the panel and the overlay | "the panel opens from the keyboard …" |
 * | 11 | Focus restoration on closing panel and overlay | same, and "the overlay … returns focus" |
 * | 12 | `Esc` closes the overlay | "the overlay … closes with Escape" |
 * | 13 | Desktop and responsive, no horizontal page scroll | "no horizontal page scroll …" |
 *
 * Scenarios 5, 6, 7, 8 and 9 are SERVER properties and are proved against
 * the server, not through a browser — re-asserting them here would be a
 * weaker copy of a stronger test:
 *
 * - 5 and 6 (a system role refuses a name / permission change) —
 *   `apps/api/test/contract/admin-roles.spec.ts:249,266` (F-76: the file this
 *   comment used to cite, `apps/api/test/integration/role-admin.spec.ts`,
 *   never existed — confirmed via `git log --all` on that path);
 * - 7 (`usersWithRoles` counts a multi-role person once) —
 *   `apps/api/test/integration/role-summary.spec.ts` and
 *   `apps/api/test/unit/get-roles-summary.usecase.spec.ts`;
 * - 8 (the privilege classification is inert) — it does not exist on the
 *   server at all, which is the proof; the client half is
 *   `role-privilege.test.ts` / `role-privilege-badge.test.tsx`;
 * - 9 (no inheritance; effective permission is a flat union) —
 *   `apps/api/test/unit/` permission-resolution coverage.
 *
 * ## Two hazards this file is written around
 *
 * - **F-28** — every wait is on an element that only exists once real data
 *   has rendered (a named role's own card button), never on the page
 *   heading or a skeleton, both of which appear before any role does.
 * - **F-45/F-54** — the unique marker appended to fixture role names uses a
 *   prefix of SEVEN characters. A two-character prefix produced a
 *   43-character string that `information-disclosure.spec.ts`'s leaked-token
 *   detector matches as a session token.
 */
test.describe('Administration — roles and permissions (/admin/roles)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the roles administration screen.',
  );

  /**
   * The seeded "Platform Administrator" is always present, whatever custom
   * roles a shared dev database has accumulated, and it is a SYSTEM role
   * carrying the whole catalogue — so it is simultaneously the "real data has
   * rendered" signal (F-28) and the fixture for every protected-role check.
   *
   * ## Two names, and the distinction is the point (ADR-022)
   *
   * A later phase made seeded roles READ in pt-BR while the STORED
   * `Role.name` stayed the English identifier the seed upserts on. So a role
   * now has two names, and every assertion below has to say which one it
   * means — a single shared constant would hide exactly the boundary that
   * change introduced, and this file would go green again for the wrong
   * reason the first time somebody "fixed" a locator.
   *
   * - `*_LABEL` — what the screen PRINTS. Card names, panel headings,
   *   anything a reader sees.
   * - `*_STORED` — what the database HOLDS. API payloads, the read-only name
   *   field of the editor (FR-016/FR-031), and the search term a reader types
   *   after seeing the name in an audit entry or a runbook.
   */
  const PLATFORM_ADMIN_STORED = 'Platform Administrator';
  const PLATFORM_ADMIN_LABEL = 'Administrador da Plataforma';
  const RISK_MANAGER_LABEL = 'Gestor de Riscos';
  const platformAdminCard = new RegExp(`^Abrir detalhes do papel ${PLATFORM_ADMIN_LABEL}`);

  /**
   * Marker prefix for fixture role names. SEVEN characters, deliberately
   * (F-45/F-54): a two-character prefix plus this suffix generator produces
   * a 43-character string, which is exactly the shape
   * `information-disclosure.spec.ts` flags as a leaked session token.
   */
  const FIXTURE_PREFIX = 'e2e015r';

  function fixtureRoleName(): string {
    return `${FIXTURE_PREFIX} Papel de verificação ${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  /** Ids of roles this test created through the API and has not deleted itself. */
  let createdRoleIds: string[] = [];

  /**
   * State to restore on the verification identity used by the restricted
   * scenario, so the database ends each run exactly as it started.
   */
  let restrictedUserToRestore: string | null = null;

  async function apiCreateRole(
    request: APIRequestContext,
    baseURL: string | undefined,
    body: { name: string; description: string; permissionIdentifiers: string[] },
  ): Promise<{ id: string; name: string }> {
    const response = await request.post('/api/v1/admin/roles', {
      headers: { Origin: baseURL ?? '' },
      data: body,
    });
    if (!response.ok()) {
      throw new Error(
        `POST /admin/roles returned ${String(response.status())}: ${await response.text()}`,
      );
    }
    const created = (await response.json()) as { id: string; name: string };
    createdRoleIds.push(created.id);
    return created;
  }

  /**
   * API cleanup after every test, exactly as the 012 version of this file
   * established (`specs/012-admin-roles-screen/STATE.md` §4/§5: its FIRST
   * draft left a fixture role behind, and it was found in a rendered
   * capture of the list). It runs whether the test passed, failed or timed
   * out, and only ever touches ids this file itself created.
   */
  test.afterEach(async ({ page, baseURL }, testInfo) => {
    const ids = createdRoleIds;
    createdRoleIds = [];

    const userId = restrictedUserToRestore;
    restrictedUserToRestore = null;

    // ONLY the restricted scenario needs a new session here, and only
    // because it ends signed in as an identity that may delete nothing.
    // Signing out unconditionally was a real defect in the first draft of
    // this hook: it revoked the administrator session that the DELETEs
    // below depend on, so every cleanup silently 401'd and fixture roles
    // accumulated in the shared dev database — visible as a strict-mode
    // collision on the very next run. Exactly the class of leftover
    // `specs/012-admin-roles-screen/STATE.md` §4 recorded.
    if (userId !== null) {
      await signOut(page).catch(() => undefined);
      await signInAsWorkerAdmin(page, testInfo);

      // Strip every role, then deactivate — the state the account was found
      // in, and the state it is left in.
      await page.request.put(`/api/v1/admin/users/${userId}/roles`, {
        headers: { Origin: baseURL ?? '' },
        data: { roleIds: [] },
      });
      await page.request.put(`/api/v1/admin/users/${userId}/status`, {
        headers: { Origin: baseURL ?? '' },
        data: { status: 'INACTIVE', reason: 'Fim da verificação E2E 015.' },
      });
    }

    for (const id of ids) {
      const deleted = await page.request.delete(`/api/v1/admin/roles/${id}`, {
        headers: { Origin: baseURL ?? '' },
      });
      // Loud, not silent: a cleanup that fails quietly is how the database
      // fills up with fixture rows nobody notices until a capture shows one.
      if (!deleted.ok()) {
        throw new Error(
          `Cleanup failed to delete fixture role ${id}: ${String(deleted.status())} ` +
            `${await deleted.text()}`,
        );
      }
    }
  });

  /**
   * The panel's focus contract for the element that OPENED it, when that
   * element was activated WITH A MOUSE.
   *
   * ## Why this is browser-aware, and why that is not a weakening
   *
   * `DetailPanel` and `sheet.tsx` decide where focus goes on close by
   * capturing `document.activeElement` at the moment the panel MOUNTS
   * (`packages/design-system/src/lib/use-restore-focus.ts`). That is exact on
   * Chromium and Firefox, where activating a `<button>` with the mouse
   * leaves focus on it.
   *
   * WebKit does not. Measured directly on this screen, on a control that
   * unmounts nothing (the "Filtros" disclosure), so no React lifecycle is
   * involved at all:
   *
   * | engine   | `document.activeElement` after clicking a `<button>` |
   * |---|---|
   * | chromium | the button                                           |
   * | firefox  | the button                                           |
   * | webkit   | `<main tabindex="0">` — the shell's scroll container  |
   *
   * It is the macOS convention (a button is not focused by mouse
   * activation), and it holds even when the button was explicitly focused
   * first: the click blurs it. So on WebKit the panel captures `<main>` as
   * its restore target and, correctly by its own rule, returns focus there.
   *
   * The guarantee that WCAG SC 2.4.3 is actually about — a KEYBOARD user
   * gets focus back where they left it — holds on all three engines, and is
   * asserted unconditionally by the two keyboard tests in this file. This
   * helper covers the mouse path, where the three engines genuinely differ,
   * and it asserts the measured behaviour of each rather than the weaker
   * "something happened".
   *
   * **If the WebKit branch ever fails, do not relax it — delete it.** A
   * WebKit run that restores focus to the opener means the capture stopped
   * depending on `document.activeElement` (the fix is to let a caller pass
   * the trigger element, the way Radix does), and this helper should then
   * collapse back to a single unconditional assertion.
   */
  async function expectMouseFocusReturn(
    page: Page,
    opener: Locator,
    browserName: string,
  ): Promise<void> {
    if (browserName === 'webkit') {
      await expect(opener).not.toBeFocused();
      const active = await page.evaluate(() => document.activeElement?.tagName ?? 'NONE');
      expect(
        active,
        'WebKit does not focus a button activated by mouse, so the panel captures the shell ' +
          "scroll container as its restore target. If this is no longer 'MAIN', the underlying " +
          'capture changed — read this helper’s comment before touching the assertion.',
      ).toBe('MAIN');
      return;
    }
    await expect(opener).toBeFocused();
  }

  /** Signs in and lands on a list with REAL roles rendered — never a skeleton (F-28). */
  async function openRolesScreen(page: Page): Promise<void> {
    await page.goto('/admin/roles');
    await expect(page.getByRole('heading', { name: 'Papéis e permissões' })).toBeVisible();
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible({
      timeout: 15_000,
    });
  }

  test.beforeEach(async ({ page }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    await openRolesScreen(page);
  });

  // ==================================================================
  // Opening the screen, searching, filtering, ordering
  // ==================================================================

  test('the four indicators come from the summary endpoint, and the first three filter while the fourth does not', async ({
    page,
  }) => {
    const indicators = page.getByRole('region', { name: 'Resumo de papéis e permissões' });
    await expect(indicators).toBeVisible();

    // FR-004 — real figures. The platform seeds twelve SYSTEM roles, so
    // "papéis do sistema" is at least that and total is at least as large;
    // asserting the relationship rather than a literal keeps this honest
    // against a shared database that has accumulated custom roles.
    const systemIndicator = page.getByRole('button', {
      name: 'Mostrar somente os papéis do sistema',
    });
    const customIndicator = page.getByRole('button', {
      name: 'Mostrar somente os papéis personalizados',
    });
    const allIndicator = page.getByRole('button', { name: 'Mostrar todos os papéis' });

    // FR-002 — real interactive controls, operable and stateful. A `div`
    // with `onClick` would have neither role nor `aria-pressed`.
    await expect(systemIndicator).toHaveAttribute('aria-pressed', 'false');

    await systemIndicator.click();
    await expect(systemIndicator).toHaveAttribute('aria-pressed', 'true');
    // The state is ALSO said in words, never signalled by colour alone (NFR-004).
    await expect(systemIndicator.getByText('Filtro aplicado')).toBeVisible();
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();

    await customIndicator.click();
    await expect(customIndicator).toHaveAttribute('aria-pressed', 'true');
    await expect(systemIndicator).toHaveAttribute('aria-pressed', 'false');
    // Platform Administrator is a system role: the custom filter excludes it.
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeHidden();

    await allIndicator.click();
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();

    // FR-003 — "Usuários com papéis" neither navigates nor filters, so it is
    // not a control at all.
    await expect(indicators.getByText('Usuários com papéis')).toBeVisible();
    await expect(page.getByRole('button', { name: /Usuários com papéis/ })).toHaveCount(0);
  });

  test('search narrows the list by name and the results line says how many of the total are left', async ({
    page,
  }) => {
    // The STORED name, deliberately: search matches both names (ADR-022), and
    // a reader who met this role in an API response or an audit entry types
    // the English one. The card it finds still READS in pt-BR.
    await page.getByLabel('Buscar papéis').fill(PLATFORM_ADMIN_STORED);

    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: new RegExp(`^Abrir detalhes do papel ${RISK_MANAGER_LABEL}`),
      }),
    ).toBeHidden();
    // FR-005 — the results line names the filtered count against the total.
    await expect(page.getByText(/^1 de \d+ papéis$/)).toBeVisible();

    // ADR-022 — and the OTHER name finds the same single role. Typing what
    // the screen prints must not come up empty-handed either; a search that
    // matched only the stored name would leave a reader who saw
    // "Administrador da Plataforma" on this very page with no results.
    await page.getByLabel('Buscar papéis').fill(PLATFORM_ADMIN_LABEL);
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();
    await expect(page.getByText(/^1 de \d+ papéis$/)).toBeVisible();

    // A term that matches nothing gives the "nothing matched" state, which is
    // a DIFFERENT state from "no role exists" and carries its own exit.
    await page.getByLabel('Buscar papéis').fill('zzz-nenhum-papel-com-este-nome-zzz');
    await expect(page.getByText('Nenhum papel encontrado')).toBeVisible();
    await expect(page.getByText('Nenhum papel cadastrado')).toHaveCount(0);

    await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();
  });

  test('the module filter keeps only roles granting at least one permission of that module (FR-005a)', async ({
    page,
    baseURL,
  }) => {
    const roleName = fixtureRoleName();
    // A role reaching ONLY the Risks module — so filtering by any other
    // module must exclude it, and filtering by Risks must keep it.
    await apiCreateRole(page.request, baseURL, {
      name: roleName,
      description: 'Papel de verificação da fase 015: alcança apenas o módulo Riscos.',
      permissionIdentifiers: ['risk:view'],
    });
    await page.reload();
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible({
      timeout: 15_000,
    });

    // Located by the EXACT name this test generated, never by the shared
    // fixture prefix: a prefix match would collide with any leftover from
    // another run and fail in strict mode for a reason unrelated to the
    // filter under test.
    const fixtureCard = page.getByRole('button', {
      name: `Abrir detalhes do papel ${roleName}`,
      exact: false,
    });
    await expect(fixtureCard).toBeVisible();

    // The filters moved BEHIND a "Filtros" disclosure when this screen adopted
    // the collapsible `FilterBar` the five business registers share — the
    // panel's content is unmounted while closed, so the select does not exist
    // in the document until the button is pressed. The name is a prefix match
    // because the button carries a count badge ("Filtros 1") as soon as a
    // filter field is applied, and this test applies one.
    const filtersToggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(filtersToggle).toHaveAttribute('aria-expanded', 'false');
    await filtersToggle.click();
    await expect(filtersToggle).toHaveAttribute('aria-expanded', 'true');

    // A Radix `Select`, not a native `<select>` — so it is driven by role
    // (`combobox` + `option`), never by `selectOption`. Located by ROLE
    // rather than by label, because `getByLabel('Módulo')` also matches the
    // shell sidebar's "Módulos de GRC" list.
    const moduleFilter = page.getByRole('combobox', { name: 'Módulo' });

    await moduleFilter.click();
    await page.getByRole('option', { name: 'Riscos', exact: true }).click();
    await expect(fixtureCard).toBeVisible();

    await moduleFilter.click();
    await page.getByRole('option', { name: 'Compliance', exact: true }).click();
    await expect(fixtureCard).toBeHidden();
    // Platform Administrator holds every permission, so it survives every
    // module filter — the control is narrowing, not simply emptying.
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();

    // What is hidden behind the disclosure is the MACHINERY, never the state:
    // the active-filter chip sits outside the panel, so a reader who closes
    // "Filtros" still sees which filter narrowed the list, and can drop it
    // without opening anything. That is the whole reason the collapsible
    // disposition is acceptable here, so it is asserted rather than assumed.
    await filtersToggle.click();
    await expect(filtersToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(moduleFilter).toHaveCount(0);
    const moduleChip = page.getByRole('button', { name: 'Remover filtro: Módulo: Compliance' });
    await expect(moduleChip).toBeVisible();
    // And the count badge on the closed button reports the one applied field.
    await expect(filtersToggle).toContainText('1');

    await moduleChip.click();
    await expect(fixtureCard).toBeVisible();
  });

  // ==================================================================
  // The detail panel: selecting, reading, disclosure, identifiers, tabs
  // ==================================================================

  test('selecting a role opens the panel beside the list, which stays operable, and closing it returns focus to the card', async ({
    page,
    browserName,
  }) => {
    const card = page.getByRole('button', { name: platformAdminCard });
    await card.click();

    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    // By heading, not by text: the privilege badge's accessible sentence
    // ("Platform Administrator concede permissões de administração de
    // acesso") also contains the role's name, and a bare text match
    // resolves to both.
    await expect(panel.getByRole('heading', { name: PLATFORM_ADMIN_LABEL })).toBeVisible();

    // FR-009/FR-010 — no navigation, and at this (desktop) width the list is
    // still there and still operable beside the panel.
    await expect(page).toHaveURL(/\/admin\/roles/);
    await expect(card).toBeVisible();
    // The selection is stated in words as well as in colour (NFR-004).
    await expect(card).toHaveAttribute('aria-current', 'true');
    await expect(card.getByText('Papel selecionado')).toBeVisible();

    // Scenario 11 — closing hands focus back to the card that opened it.
    // Opened and closed with the MOUSE here, which is where the three engines
    // genuinely differ; see `expectMouseFocusReturn`. The keyboard path, which
    // is what SC 2.4.3 is about, is asserted unconditionally by the next test.
    await panel.getByRole('button', { name: 'Fechar detalhes do papel' }).click();
    await expect(panel).toBeHidden();
    await expectMouseFocusReturn(page, card, browserName);
  });

  test('the panel opens from the keyboard and closes with Escape, returning focus to the card (scenarios 10 and 11)', async ({
    page,
  }) => {
    const card = page.getByRole('button', { name: platformAdminCard });

    // The card is a real `<button>`, so it takes focus and activates on
    // Enter — focusing it directly is this suite's established way of
    // exercising "the user tabs here" without depending on how many
    // focusable elements precede it in a growing list.
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');

    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();

    // The non-modal panel moves focus INTO itself on open — otherwise a
    // keyboard user would have to tab through the whole list to reach what
    // they just opened (`DetailPanel`'s own focus contract).
    await expect(panel).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(card).toBeFocused();
  });

  test('the Permissions tab groups by module, expands on demand and reveals the real identifiers (FR-013, FR-014, FR-016)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: platformAdminCard }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();

    // FR-015 — the real authorization model, stated where the wrong mental
    // model would otherwise form.
    await expect(panel.getByText('Como este papel concede acesso')).toBeVisible();
    await expect(
      panel.getByText('Não há herança entre papéis: um papel nunca recebe permissões de outro.'),
    ).toBeVisible();
    // SC-003 — zero occurrences of "herdada de" or any hierarchy wording.
    expect(await panel.textContent()).not.toMatch(/herdad/i);

    // Modules start collapsed; "Expandir todos" opens every one (FR-014).
    await expect(panel.getByRole('heading', { name: /^Riscos/ })).toBeVisible();
    await expect(panel.getByText('risk:view', { exact: true })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Expandir todos' }).click();
    // The pt-BR label is the primary one; the identifier is NOT shown yet.
    await expect(panel.getByText('risk:view', { exact: true })).toHaveCount(0);

    // FR-016 — the identifiers are revealed on demand, exactly as stored.
    const identifiersToggle = panel.getByRole('button', { name: 'Ver identificadores técnicos' });
    await expect(identifiersToggle).toHaveAttribute('aria-pressed', 'false');
    // ADR-022 — the stored role name is NOT on screen while the panel reads in
    // pt-BR. Asserted before the toggle, so what follows is a state change and
    // not something that was there all along.
    await expect(panel.getByText('Nome técnico:')).toHaveCount(0);

    await identifiersToggle.click();
    await expect(panel.getByText('risk:view', { exact: true }).first()).toBeVisible();
    await expect(panel.getByText('role:administer', { exact: true }).first()).toBeVisible();
    // The same control answers the same question about the role's own name:
    // the heading keeps printing the pt-BR label, and the English identifier
    // the server stores appears beside it — never instead of it.
    await expect(panel.getByText('Nome técnico:')).toBeVisible();
    await expect(panel.getByText(PLATFORM_ADMIN_STORED, { exact: true })).toBeVisible();
    await expect(panel.getByRole('heading', { name: PLATFORM_ADMIN_LABEL })).toBeVisible();

    await panel.getByRole('button', { name: 'Ocultar identificadores técnicos' }).click();
    await expect(panel.getByText('risk:view', { exact: true })).toHaveCount(0);
    await expect(panel.getByText('Nome técnico:')).toHaveCount(0);
  });

  test('the Users tab lists the people holding the role for a caller with user:administer (scenario 2)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: platformAdminCard }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();

    await panel.getByRole('tab', { name: 'Usuários' }).click();

    // The worker admin holds Platform Administrator itself, so this role
    // always has at least one holder — the roster is genuinely populated,
    // never an empty state standing in for one.
    await expect(panel.getByRole('heading', { name: 'Pessoas com este papel' })).toBeVisible();
    await expect(panel.getByText(/pessoas? têm? este papel/)).toBeVisible();
    await expect(panel.getByText(/@/).first()).toBeVisible({ timeout: 15_000 });

    // FR-022 — scope is a dimension of the USER, never a property of this
    // role assignment.
    await expect(panel.getByRole('heading', { name: 'Escopo organizacional' })).toBeVisible();
    await expect(
      panel.getByText(/O escopo organizacional é concedido por usuário, não por este papel\./),
    ).toBeVisible();

    // FR-025 — other roles are provenance, never inheritance.
    expect(await panel.textContent()).not.toMatch(/herdad/i);
  });

  // ==================================================================
  // Editing
  // ==================================================================

  /**
   * F-68 / commit `b1632bd` — a system role is platform-owned ENTIRE, and the
   * interface follows the server instead of fighting it.
   *
   * ## What this test replaced, and what was deliberately removed
   *
   * It used to be "a protected (system) role is legible and locked, and saving
   * it sends only the description (FR-031)", and it carried a scenario from
   * phase 012 §3.1: open the editor on a system role, change nothing, press
   * "Salvar alterações", expect 200 — proving the client no longer sent the
   * unchanged permission set that used to make every such save a 422.
   *
   * **That scenario is removed, not relocated, and this is the declaration of
   * it.** It is not obsolete because it became inconvenient: it is obsolete
   * because its subject no longer exists. There is no save control on a system
   * role any more, and there is no request for the client to get right or
   * wrong — `useRoleEditor` refuses a locked target locally and issues none.
   * A test that pressed a button that is not there could only fail, and one
   * rewritten to "assert the 200" through the API would assert the opposite of
   * the current rule, which is that the server refuses that write too. The
   * refusal it would have to assert instead is already proved, by cause and
   * not merely by status code, in
   * `apps/api/test/integration/system-role-immutability.spec.ts` — including
   * the identical-value no-op, which is the exact shape 012 used to save.
   *
   * What genuinely belonged to 012 and is NOT dropped: the fixed-footer
   * property (§3.2 — the old dialog put 888.6px of content in a 720px window
   * and left the primary action unreachable by wheel and by Tab). It is
   * re-asserted below on "Voltar", which is now the one control that footer
   * carries.
   */
  test('a protected (system) role opens as a read-only definition, with no save to press (FR-031, F-68)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: platformAdminCard }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });

    // The reading state says WHY before anything is opened, so the reason does
    // not depend on the reader clicking to discover it.
    await expect(
      panel.getByText(
        'Nome, descrição e permissões são definidos pela plataforma e não podem ser alterados aqui.',
      ),
    ).toBeVisible();
    // "Editar papel" is not merely disabled here — it is not offered at all.
    await expect(panel.getByRole('button', { name: 'Editar papel' })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Ver definição' }).click();
    // The panel's kicker above the role name, which says WHICH disposition of
    // this shell is open. `getByText`, not `getByRole('heading')`: the `<h2>`
    // here carries the role's own pt-BR name, and this line is a `<span>`
    // above it — asserting it as a heading passed against nothing and was
    // caught by running this test, not by reading it.
    await expect(panel.getByText('Definição do papel', { exact: true })).toBeVisible();

    // One sentence covering all three fields, at the top, so the reader knows
    // before scrolling that nothing here is editable and why.
    await expect(
      panel.getByText(
        'Este papel é definido pela plataforma. Nome, descrição e permissões são mantidos pelo ' +
          'próprio sistema e não podem ser alterados aqui.',
      ),
    ).toBeVisible();

    // FR-031 — legible AND locked, with each field's own reason in words.
    // `readOnly` rather than `disabled`: a disabled input is dimmed to
    // `opacity-50` and dropped from the tab order, and the stored name became
    // the faintest text in the panel when it was measured on screen.
    const nameField = panel.getByLabel('Nome');
    await expect(nameField).toHaveAttribute('readonly', '');
    await expect(nameField).toHaveValue(PLATFORM_ADMIN_STORED);
    await expect(panel.getByText('Papel do sistema: o nome não pode ser alterado.')).toBeVisible();

    // F-68's own field: the description has exactly one owner, and it is the
    // platform seed. This is the assertion that would have gone green against
    // the defect and red against the fix, so it is the one that matters most
    // in this test.
    const descriptionField = panel.getByLabel('Descrição');
    await expect(descriptionField).toHaveAttribute('readonly', '');
    await expect(
      panel.getByText(
        'Papel do sistema: a descrição não pode ser alterada. Ela é definida pela plataforma e ' +
          'restaurada a cada atualização do sistema.',
      ),
    ).toBeVisible();

    await expect(
      panel.getByText(
        'Papel do sistema: o conjunto de permissões não pode ser alterado. As permissões ' +
          'continuam visíveis abaixo.',
      ),
    ).toBeVisible();

    // Every permission control is locked.
    const moduleToggle = panel.getByRole('checkbox').first();
    await expect(moduleToggle).toBeDisabled();

    // There is NO save, and no cancel-with-confirmation either: nothing was
    // editable, so there is nothing to discard. Asserted by absence, because a
    // control that merely looks disabled would still be a promise the server
    // refuses.
    await expect(panel.getByRole('button', { name: 'Salvar alterações' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);

    // 012 §3.2's property, on the one control this footer now carries: it
    // lives in the panel's FIXED footer, so it is reachable however long the
    // permission tree is.
    const back = panel.getByRole('button', { name: 'Voltar', exact: true });
    await expect(back).toBeInViewport();
    await back.click();

    // And it really goes back to reading, rather than leaving the sheet open.
    await expect(panel.getByRole('button', { name: 'Ver definição' })).toBeVisible();
    await expect(panel.getByText('Definição do papel', { exact: true })).toHaveCount(0);
  });

  /**
   * F-68, the other half: the client makes NO request for a system role.
   *
   * The test above proves there is no control to press. This proves the
   * absence goes all the way down — `useRoleEditor` refuses a locked target
   * locally — by watching the network for the whole interaction instead of
   * inferring it from the DOM. Without this, a future "convenience" that
   * PATCHed on open, or on close, would leave every assertion above green.
   *
   * It is a browser-level property and belongs here: the server-side refusal
   * is proved separately and more strongly in
   * `apps/api/test/integration/system-role-immutability.spec.ts`.
   */
  test('no PATCH is ever sent while reading a system role definition (F-68)', async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      const method = request.method();
      if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
        writes.push(`${method} ${request.url()}`);
      }
    });

    await page.getByRole('button', { name: platformAdminCard }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await panel.getByRole('button', { name: 'Ver definição' }).click();
    await expect(panel.getByText('Definição do papel', { exact: true })).toBeVisible();

    // Type into both read-only fields. A `readOnly` input accepts focus and
    // keystrokes without changing value — which is the point of choosing it
    // over `disabled` — so this is the realistic "user tried" path, and the
    // one that would expose a change handler that still fired.
    await panel.getByLabel('Nome').click();
    await page.keyboard.type('X');
    await panel.getByLabel('Descrição').click();
    await page.keyboard.type('X');
    await expect(panel.getByLabel('Nome')).toHaveValue(PLATFORM_ADMIN_STORED);

    await panel.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Ver definição' })).toBeVisible();

    expect(
      writes,
      'reading a system role definition must issue no write request at all — the server refuses ' +
        'every field of one (F-68), so a request made here could only produce an error toast',
    ).toEqual([]);
  });

  test('a custom role can be edited: the pending change is summarised, cancelling persists nothing, and saving does', async ({
    page,
    baseURL,
  }) => {
    const roleName = fixtureRoleName();
    const created = await apiCreateRole(page.request, baseURL, {
      name: roleName,
      description: 'Papel de verificação da fase 015: edição dentro do painel.',
      permissionIdentifiers: ['risk:view'],
    });
    await page.reload();
    // Exact generated name, for the same reason as the module-filter test.
    const card = page.getByRole('button', {
      name: `Abrir detalhes do papel ${roleName}`,
      exact: false,
    });
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    // Not a system role: nothing is locked.
    await expect(panel.getByText('Personalizado')).toBeVisible();

    // --- Cancel persists nothing (FR-032) ---------------------------
    await panel.getByRole('button', { name: 'Editar papel' }).click();
    const description = panel.getByLabel('Descrição');
    await expect(description).toBeEnabled();
    await description.fill('Alteração que NÃO deve ser gravada.');
    await expect(panel.getByText('A descrição foi alterada.')).toBeVisible();

    await panel.getByRole('button', { name: 'Cancelar' }).click();
    // A discarded edit is confirmed first — the change is unrecoverable.
    await page.getByRole('button', { name: 'Descartar alterações' }).click();
    await expect(panel.getByRole('button', { name: 'Editar papel' })).toBeVisible();

    const afterCancel = await page.request.get(`/api/v1/admin/roles/${created.id}`);
    expect(((await afterCancel.json()) as { description: string }).description).toBe(
      'Papel de verificação da fase 015: edição dentro do painel.',
    );

    // --- A real permission change, summarised before it is saved ----
    await panel.getByRole('button', { name: 'Editar papel' }).click();
    const controlsToggle = panel.getByRole('checkbox', {
      name: 'Selecionar todas as permissões de Controles',
    });
    await expect(controlsToggle).toBeVisible({ timeout: 15_000 });
    // FR-028 — the module selector distinguishes none / some / all.
    await expect(controlsToggle).toHaveAttribute('aria-checked', 'false');

    const risksToggle = panel.getByRole('checkbox', {
      name: 'Selecionar todas as permissões de Riscos',
    });
    // The role holds 1 of the Risks module's permissions: partial, and said
    // in words as well as in shape.
    await expect(risksToggle).toHaveAttribute('aria-checked', 'mixed');

    await risksToggle.click();
    await expect(risksToggle).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByText('Todas selecionadas')).toBeVisible();

    // FR-029 — what will change, before it changes.
    await expect(panel.getByText(/permissões? a acrescentar$/)).toBeVisible();
    // FR-030 — and when it takes effect.
    await expect(
      panel.getByText(
        'A alteração no conjunto de permissões passa a valer na próxima requisição de cada usuário afetado — sem necessidade de novo login.',
      ),
    ).toBeVisible();

    await panel.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Papel atualizado com sucesso.')).toBeVisible();

    const afterSave = await page.request.get(`/api/v1/admin/roles/${created.id}`);
    const saved = (await afterSave.json()) as { permissions: { identifier: string }[] };
    expect(saved.permissions.length).toBeGreaterThan(1);
    expect(saved.permissions.map((p) => p.identifier)).toContain('risk:view');
  });

  // ==================================================================
  // Scenario 1 — the permission boundary, in a real browser session
  // ==================================================================

  /**
   * `role:administer` does NOT imply `user:administer` (FR-019), and the only
   * operation that lists the people holding a role requires the latter. The
   * component-level guards (`role-users-tab.test.tsx`,
   * `role-admin-view.test.tsx`) already prove the roster is never mounted and
   * the request never made; this proves the same thing end to end, against
   * the real server, with a real session that genuinely lacks the permission.
   *
   * ## Why an EXISTING account is reused rather than a new one created
   *
   * There is no endpoint that deletes a user, by design — deleting one would
   * orphan the audit trail that references it as actor. So every restricted
   * identity a test creates is permanent. `verificacao-015@pharosgrc.local`
   * was left behind by this phase's earlier wave for exactly this purpose
   * (it already carries four audit events as actor); reusing it adds nobody
   * to the directory, and `afterEach` returns it to the state it was found
   * in: no roles, INACTIVE.
   */
  test('a session holding role:administer but NOT user:administer sees no personal data at all (scenario 1)', async ({
    page,
    baseURL,
  }) => {
    const restrictedEmail = 'verificacao-015@pharosgrc.local';
    const restrictedPassword = 'Pharos-Verificacao-015-1!';

    // --- Find the verification identity ------------------------------
    const search = await page.request.get(
      `/api/v1/admin/users?page=1&pageSize=100&q=${encodeURIComponent(restrictedEmail)}`,
    );
    expect(search.ok()).toBe(true);
    const found = ((await search.json()) as { data: { id: string; email: string }[] }).data.find(
      (user) => user.email === restrictedEmail,
    );
    if (!found) {
      throw new Error(
        `The verification identity ${restrictedEmail} is not in this database. It is created by ` +
          'the 015 phase and cannot be deleted (no user-deletion endpoint exists); re-create it ' +
          'through POST /admin/users before running this scenario.',
      );
    }
    restrictedUserToRestore = found.id;

    // --- A role granting role:administer and NOTHING else -------------
    const restrictedRole = await apiCreateRole(page.request, baseURL, {
      name: fixtureRoleName(),
      description:
        'Papel de verificação da fase 015: concede apenas role:administer, nunca user:administer.',
      permissionIdentifiers: ['role:administer'],
    });

    await page.request.put(`/api/v1/admin/users/${found.id}/status`, {
      headers: { Origin: baseURL ?? '' },
      data: { status: 'ACTIVE', reason: 'Verificação E2E 015 do limite de permissão.' },
    });
    const passwordReset = await page.request.put(`/api/v1/admin/users/${found.id}/password`, {
      headers: { Origin: baseURL ?? '' },
      data: { newPassword: restrictedPassword },
    });
    expect(passwordReset.status()).toBe(204);
    const rolesSet = await page.request.put(`/api/v1/admin/users/${found.id}/roles`, {
      headers: { Origin: baseURL ?? '' },
      data: { roleIds: [restrictedRole.id] },
    });
    expect(rolesSet.ok()).toBe(true);

    // --- Sign in AS the restricted identity ---------------------------
    await signOut(page);
    await signInAsFreshlyProvisionedUser(page, restrictedEmail, restrictedPassword);
    await openRolesScreen(page);

    await page.getByRole('button', { name: platformAdminCard }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    await panel.getByRole('tab', { name: 'Usuários' }).click();

    // FR-020 — the aggregate count, which `GET /admin/roles` legitimately
    // returned, and an explanation of what is missing and why.
    await expect(panel.getByText('Relação de pessoas indisponível')).toBeVisible();
    await expect(panel.getByText(/pessoas? têm? este papel/)).toBeVisible();
    await expect(
      panel.getByText(/exige a permissão de administração de usuários \(user:administer\)/),
    ).toBeVisible();

    // And NOTHING personal anywhere in the document. Asserted over the raw
    // HTML, so a node merely hidden by CSS would still fail: no e-mail
    // address of any kind reached the page.
    const markup = await page.content();
    expect(markup).not.toContain('@example.local');
    expect(markup).not.toContain('Pessoas com este papel');
    // FR-023 — the scope LINK is gated too: this identity holds no
    // `org_unit:administer`, so the notice appears without the link.
    await expect(panel.getByRole('heading', { name: 'Escopo organizacional' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Gerenciar escopo organizacional' })).toHaveCount(
      0,
    );
  });

  // ==================================================================
  // Responsive behaviour (scenario 13)
  // ==================================================================

  test('no horizontal page scroll from 1920 down to 390, and below xl the panel is an overlay that traps focus and closes with Escape (scenarios 12 and 13)', async ({
    page,
    browserName,
  }) => {
    for (const width of [1920, 1440, 1280, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();
      // NFR-005/SC-010 — the PAGE never scrolls sideways. A one-pixel
      // tolerance absorbs sub-pixel layout rounding, not a real overflow.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal page overflow at ${String(width)}px`).toBeLessThanOrEqual(1);
    }

    // At 390 (well below `xl`) the panel is a modal overlay, not a grid cell.
    const card = page.getByRole('button', { name: platformAdminCard });
    await card.click();

    const overlay = page.getByRole('dialog');
    await expect(overlay).toBeVisible();
    const panel = overlay.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();

    // Scenario 12 — Escape closes the overlay; scenario 11 — and focus goes
    // back to the card that opened it. Before this phase ported
    // `useDialogFocusRestore` into `sheet.tsx` (T001, D-05), the sheet had no
    // focus restoration at all and this would land on `<body>`.
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    // The overlay was opened with the MOUSE, which is what decides the
    // restore target — see `expectMouseFocusReturn`. The same overlay opened
    // from the keyboard DOES return focus to the card on every engine, and
    // that is asserted in `accessibility.spec.ts`'s own keyboard scan.
    await expectMouseFocusReturn(page, card, browserName);

    // The overlay still has no horizontal page overflow while open.
    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const overlayOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overlayOverflow).toBeLessThanOrEqual(1);
  });

  // ==================================================================
  // Authorization regression (scenario 16 of the requested flows)
  // ==================================================================

  test('the server refuses a system role rename regardless of what the client sends (FR-033)', async ({
    page,
    baseURL,
  }) => {
    // The client never offers this edit at all — since F-68 (`b1632bd`) a
    // system role has no editor, only a read-only definition sheet, and
    // `useRoleEditor` issues no request for one. FR-033 says the client is
    // never the only protection, so the refusal is asserted against the server
    // directly, bypassing the UI entirely.
    //
    // The comment this replaces said the client "omits the name from the
    // payload", which described the behaviour b1632bd removed: there is no
    // payload now, for any field.
    const list = await page.request.get('/api/v1/admin/roles?page=1&pageSize=100');
    const roles = (
      (await list.json()) as { data: { id: string; name: string; description: string }[] }
    ).data;
    const systemRole = roles.find((role) => role.name === PLATFORM_ADMIN_STORED);
    expect(systemRole, 'Platform Administrator must be seeded').toBeTruthy();

    const renamed = await page.request.patch(`/api/v1/admin/roles/${systemRole!.id}`, {
      headers: { Origin: baseURL ?? '' },
      data: { name: 'Renomeado pela verificação 015' },
    });
    expect(renamed.status()).toBe(422);

    // F-68 — and the description too, which is the field the old rule let
    // through. This is the shape the interface used to send on every save of a
    // system role; it is now refused like the rest, which is why the save
    // control was removed rather than merely narrowed. The browser can no
    // longer produce this request, so asserting it here is the only place a
    // regression in the SERVER would be caught from this file.
    const describedOnly = await page.request.patch(`/api/v1/admin/roles/${systemRole!.id}`, {
      headers: { Origin: baseURL ?? '' },
      data: { description: 'Descrição alterada pela verificação 015.' },
    });
    expect(
      describedOnly.status(),
      'a system role refuses a description-only PATCH — the platform owns all three fields (F-68)',
    ).toBe(422);

    const deleted = await page.request.delete(`/api/v1/admin/roles/${systemRole!.id}`, {
      headers: { Origin: baseURL ?? '' },
    });
    expect(deleted.ok()).toBe(false);

    // And it is still there, unchanged — name AND description, the second
    // read back against the value the listing reported before any of the three
    // refused writes, so "refused" means the row is untouched and not merely
    // that a status code was returned.
    const after = await page.request.get(`/api/v1/admin/roles/${systemRole!.id}`);
    const stored = (await after.json()) as { name: string; description: string };
    expect(stored.name).toBe(PLATFORM_ADMIN_STORED);
    expect(stored.description).toBe(systemRole!.description);
  });

  // ==================================================================
  // Creating a role, in the same panel that reads one
  // ==================================================================

  /**
   * Records a role this test created THROUGH THE INTERFACE so `afterEach`
   * deletes it like any other fixture.
   *
   * The panel never shows an id, so the id has to be read back — and it is
   * read back by paging the listing rather than trusting the first page,
   * which is the condition `docs/local-environment.md` D-20 already recorded
   * for this very endpoint on this very database.
   *
   * It THROWS when the role is not found. A creation test whose cleanup
   * quietly skipped would leave a custom role in a shared database and be
   * discovered, three runs later, as a strict-mode collision in an unrelated
   * test — precisely the failure `specs/015-roles-permissions-surface/STATE.md`
   * §7.2 paid for once already.
   */
  async function rememberCreatedRole(page: Page, name: string): Promise<string> {
    const pageSize = 100;
    let pageNumber = 1;
    let totalPages = 1;
    do {
      const response = await page.request.get(
        `/api/v1/admin/roles?page=${String(pageNumber)}&pageSize=${String(pageSize)}`,
      );
      if (!response.ok()) {
        throw new Error(
          `GET /admin/roles (page ${String(pageNumber)}) returned ${String(response.status())} ` +
            `while looking up the role "${name}" this test created.`,
        );
      }
      const body = (await response.json()) as {
        data: { id: string; name: string }[];
        meta: { totalPages: number };
      };
      const match = body.data.find((role) => role.name === name);
      if (match) {
        createdRoleIds.push(match.id);
        return match.id;
      }
      totalPages = body.meta.totalPages;
      pageNumber += 1;
    } while (pageNumber <= totalPages);

    throw new Error(
      `The role "${name}" was reported created by the interface but is not in GET /admin/roles. ` +
        'It cannot be cleaned up, so this run would leave a fixture role behind.',
    );
  }

  test('“Novo papel” composes a role in the panel that reads one: it says what is still missing, the module toggle is tri-state, and the created role opens in the detail panel', async ({
    page,
  }) => {
    const roleName = fixtureRoleName();

    // Rendered in the page header while the list has roles in it; the empty
    // state renders the same action, which is why this is anchored by role
    // and name rather than by position.
    const newRoleButton = page.getByRole('button', { name: 'Novo papel' });
    await newRoleButton.click();

    // The SAME shell the detail panel uses (inline at this width), not a
    // modal over the list — that duality is what this phase of the work
    // removed, so it is asserted rather than assumed.
    const panel = page.getByRole('complementary', { name: 'Novo papel' });
    await expect(panel).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The subject before it has one, and it is visibly a placeholder rather
    // than a stored value.
    await expect(panel.getByRole('heading', { name: 'Sem nome ainda' })).toBeVisible();
    // A created role is never a system role, and the form says so instead of
    // offering a control that would do nothing.
    await expect(panel.getByText(/^Papéis criados aqui são sempre personalizados/)).toBeVisible();

    // --- What the form requires, stated before anything is typed ------
    // Each requirement carries its state in WORDS as well as in the glyph
    // beside it (NFR-004), and the words are what a screen reader gets — so
    // the words are what is asserted.
    // `toHaveCount`, not `toBeVisible`: these phrases are `sr-only`, which is
    // what makes them a second channel rather than decoration — asserting them
    // as visible would be asserting the wrong thing about them.
    await expect(panel.getByText('Pendente: Um nome, de até 100 caracteres')).toHaveCount(1);
    await expect(panel.getByText('Pendente: Ao menos uma permissão selecionada')).toHaveCount(1);
    await expect(
      panel.getByText('Nenhuma permissão selecionada — o papel ainda não concede nada.'),
    ).toBeVisible();

    // --- An empty submit names all three missing fields ---------------
    await panel.getByRole('button', { name: 'Criar papel' }).click();
    await expect(panel.getByText('Informe o nome do papel.')).toBeVisible();
    await expect(panel.getByText('Informe uma descrição do papel.')).toBeVisible();
    await expect(panel.getByText('Selecione ao menos uma permissão.')).toBeVisible();

    await panel.getByLabel('Nome').fill(roleName);
    await panel
      .getByLabel('Descrição')
      .fill('Papel de verificação da fase de E2E: criação pelo painel.');
    // The name error clears as the field is corrected: a validation message
    // that survives its own correction stops being guidance.
    await expect(panel.getByText('Informe o nome do papel.')).toHaveCount(0);
    await expect(panel.getByRole('heading', { name: roleName })).toBeVisible();
    await expect(panel.getByText('Atendido: Um nome, de até 100 caracteres')).toHaveCount(1);

    // --- The module tree is tri-state, in shape AND in words ----------
    const risksModule = panel.getByRole('checkbox', {
      name: 'Selecionar todas as permissões de Riscos',
    });
    await expect(risksModule).toBeVisible({ timeout: 15_000 });
    await expect(risksModule).toHaveAttribute('aria-checked', 'false');
    await expect(panel.getByText('Nenhuma selecionada').first()).toBeVisible();

    await risksModule.click();
    await expect(risksModule).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByText('Todas selecionadas').first()).toBeVisible();
    await expect(panel.getByText('Pendente: Ao menos uma permissão selecionada')).toHaveCount(0);

    // Untick ONE permission of that module and the module reports `mixed` —
    // the state that "all" and "some" must not share (FR-028). The module is
    // expanded first because `DisclosureGroup` unmounts closed content, so
    // its permissions are genuinely absent until it is open.
    await panel.getByRole('button', { name: /^Riscos/ }).click();
    const firstRiskPermission = panel
      .locator('label')
      .filter({ hasText: 'risk:view' })
      .getByRole('checkbox');
    await firstRiskPermission.click();
    await expect(risksModule).toHaveAttribute('aria-checked', 'mixed');
    await expect(panel.getByText(/^\d+ de \d+ selecionadas$/).first()).toBeVisible();
    await firstRiskPermission.click();
    await expect(risksModule).toHaveAttribute('aria-checked', 'true');

    // --- The catalogue search narrows what is SHOWN, and says so ------
    const permissionSearch = panel.getByLabel('Buscar permissão');
    // A term that reaches exactly one permission, so "the Riscos module is
    // gone from the tree" below is a fact about the filter and not about
    // whether an English catalogue description happened to contain the word.
    await permissionSearch.fill('control:test');
    await expect(panel.getByText(/^1 de \d+ permissões$/)).toBeVisible();
    // The trap this notice exists to prevent: a module toggle keeps meaning
    // "every permission of this module", filtered or not.
    await expect(
      panel.getByText(
        'A busca filtra o que aparece aqui. Selecionar um módulo inteiro continua valendo para todas as permissões dele.',
      ),
    ).toBeVisible();
    await expect(panel.getByRole('button', { name: /^Riscos/ })).toHaveCount(0);
    await permissionSearch.fill('zzz-nenhuma-permissao-zzz');
    await expect(panel.getByText('Nenhuma permissão corresponde à busca.')).toBeVisible();
    await panel.getByRole('button', { name: 'Limpar a busca de permissões' }).click();
    await expect(panel.getByRole('button', { name: /^Riscos/ })).toBeVisible();

    // --- Create ------------------------------------------------------
    await panel.getByRole('button', { name: 'Criar papel' }).click();
    await expect(page.getByText('Papel criado com sucesso.')).toBeVisible();
    const createdId = await rememberCreatedRole(page, roleName);

    // The created role is SELECTED, so "where did it go?" never has to be
    // answered by hunting the list — and what opens is the read panel, not
    // the create panel still hanging around.
    await expect(page.getByRole('complementary', { name: 'Novo papel' })).toHaveCount(0);
    const detail = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('heading', { name: roleName })).toBeVisible();
    await expect(detail.getByText('Personalizado')).toBeVisible();

    // And it is really stored, with the permissions the tree composed —
    // asserted against the server, never only against the screen.
    const stored = await page.request.get(`/api/v1/admin/roles/${createdId}`);
    const body = (await stored.json()) as {
      name: string;
      isSystem: boolean;
      permissions: { identifier: string }[];
    };
    expect(body.name).toBe(roleName);
    expect(body.isSystem).toBe(false);
    expect(body.permissions.map((permission) => permission.identifier)).toContain('risk:view');
  });

  test('a duplicate name is refused by the server and reported in the panel, and discarding a half-composed role asks first and creates nothing', async ({
    page,
    baseURL,
    browserName,
  }) => {
    const takenName = fixtureRoleName();
    await apiCreateRole(page.request, baseURL, {
      name: takenName,
      description: 'Papel de verificação: ocupa o nome que a criação pelo painel vai tentar usar.',
      permissionIdentifiers: ['risk:view'],
    });

    const newRoleButton = page.getByRole('button', { name: 'Novo papel' });
    await newRoleButton.click();
    const panel = page.getByRole('complementary', { name: 'Novo papel' });
    await expect(panel).toBeVisible();

    await panel.getByLabel('Nome').fill(takenName);
    await panel.getByLabel('Descrição').fill('Segunda tentativa com um nome já ocupado.');
    const risksModule = panel.getByRole('checkbox', {
      name: 'Selecionar todas as permissões de Riscos',
    });
    await expect(risksModule).toBeVisible({ timeout: 15_000 });
    await risksModule.click();

    // FR-033 — the client is never the only protection. The uniqueness of
    // `Role.name` is the server's rule, and the panel reports the 409 it
    // answers with rather than pretending the request succeeded.
    await panel.getByRole('button', { name: 'Criar papel' }).click();
    await expect(panel.getByText('Já existe um papel com esse nome.')).toBeVisible();
    await expect(page.getByText('Papel criado com sucesso.')).toHaveCount(0);

    // --- Discarding asks first, and persists nothing ------------------
    await panel.getByRole('button', { name: 'Cancelar' }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Descartar o novo papel?' });
    await expect(confirm).toBeVisible();
    // "Continuar preenchendo" goes back to the form with the work intact —
    // the reason the question is asked at all.
    await confirm.getByRole('button', { name: 'Continuar preenchendo' }).click();
    await expect(panel.getByLabel('Nome')).toHaveValue(takenName);

    await panel.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Descartar', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Novo papel' })).toHaveCount(0);

    // Focus comes back to the control that opened the panel (WCAG SC 2.4.3);
    // `Sheet` had no focus restoration at all before this surface was built.
    // Mouse path, so the per-engine difference applies — see
    // `expectMouseFocusReturn`.
    await expectMouseFocusReturn(page, newRoleButton, browserName);

    // Nothing was created: the only role carrying this test's own generated
    // name is the one the API created above.
    const list = await page.request.get('/api/v1/admin/roles?page=1&pageSize=100');
    const named = ((await list.json()) as { data: { name: string }[] }).data.filter(
      (role) => role.name === takenName,
    );
    expect(named).toHaveLength(1);
  });

  // ==================================================================
  // The Users tab, past the first page
  // ==================================================================

  test('the Users tab pages through the holders of a role, one request per page turn, and a role nobody holds says so', async ({
    page,
    baseURL,
  }) => {
    // A role nobody holds, so the empty state is a real state of a real role
    // rather than a fixture standing in for one. Created first, because the
    // reload below has to bring it into the list.
    const emptyRoleName = fixtureRoleName();
    await apiCreateRole(page.request, baseURL, {
      name: emptyRoleName,
      description: 'Papel de verificação: criado sem nenhum titular.',
      permissionIdentifiers: ['risk:view'],
    });

    // --- A role with more holders than one page can show --------------
    await page.getByRole('button', { name: platformAdminCard }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    await panel.getByRole('tab', { name: 'Usuários' }).click();
    await expect(panel.getByText(/@/).first()).toBeVisible({ timeout: 15_000 });

    // The footer states the SLICE, while the line above states the total —
    // two different facts, and the reason holders past the page size stopped
    // being unreachable.
    const summary = panel.getByText(/^\d+–\d+ de \d+$/);
    await expect(summary).toBeVisible();
    const firstSlice = (await summary.textContent()) ?? '';
    const total = Number(firstSlice.split(' de ')[1]);
    expect(
      total,
      'this scenario needs a role with more holders than one page shows; the seeded platform ' +
        'administrator is the largest, and if it ever falls below 11 this assertion is the ' +
        'thing that should fail rather than the page turn silently proving nothing',
    ).toBeGreaterThan(10);
    expect(firstSlice).toMatch(/^1–10 de /);

    // FR-024/NFR-006 — a page turn costs exactly ONE request. This screen's
    // whole roster contract is "one request per page, never one per person",
    // and F-61 is what a panel that fans out per row looks like in
    // production: the global limiter refusing part of it on screen.
    const rosterRequests: string[] = [];
    const countRoster = (url: string): void => {
      if (url.includes('/api/v1/admin/users')) rosterRequests.push(url);
    };
    page.on('request', (request) => {
      countRoster(request.url());
    });

    await panel.getByRole('button', { name: 'Próxima página' }).click();
    await expect(panel.getByText(/^11–20 de /)).toBeVisible();
    expect(rosterRequests).toHaveLength(1);

    // A larger page can collapse several pages into one; the footer STAYS,
    // because a control that vanishes under the pointer that just operated
    // it strands the focus that was inside it.
    rosterRequests.length = 0;
    await panel.getByLabel('Itens por página').selectOption('50');
    // Computed from the total the screen just reported, never from today's
    // holder count: this role gains a holder every time the E2E harness
    // provisions a worker administrator, and an assertion that hard-coded
    // "1–39 de 39" would start failing on a Tuesday for a reason unrelated
    // to pagination — which is exactly F-29's failure profile.
    const secondSliceEnd = Math.min(total, 50);
    await expect(
      panel.getByText(new RegExp(`^1–${String(secondSliceEnd)} de ${String(total)}$`)),
    ).toBeVisible();
    expect(rosterRequests).toHaveLength(1);
    await expect(panel.getByLabel('Itens por página')).toBeVisible();

    // --- A role nobody holds ------------------------------------------
    await page.reload();
    const emptyCard = page.getByRole('button', {
      name: `Abrir detalhes do papel ${emptyRoleName}`,
      exact: false,
    });
    await expect(emptyCard).toBeVisible({ timeout: 15_000 });
    await emptyCard.click();
    const emptyPanel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await emptyPanel.getByRole('tab', { name: 'Usuários' }).click();

    await expect(emptyPanel.getByText('Nenhuma pessoa tem este papel.')).toBeVisible({
      timeout: 15_000,
    });
    // No pagination control over nothing, and no hint explaining a column
    // that is not on screen.
    await expect(emptyPanel.getByLabel('Itens por página')).toHaveCount(0);
    await expect(emptyPanel.getByText(/^Os demais papéis atribuídos à mesma pessoa\./)).toHaveCount(
      0,
    );
  });
});
