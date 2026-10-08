import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import {
  requireSeedCredentials,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';

test.describe('Administration — roles and permissions (/admin/roles)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the roles administration screen.',
  );

  const PLATFORM_ADMIN_STORED = 'Platform Administrator';
  const PLATFORM_ADMIN_LABEL = 'Administrador da Plataforma';
  const RISK_MANAGER_LABEL = 'Gestor de Riscos';
  const platformAdminCard = new RegExp(`^Abrir detalhes do papel ${PLATFORM_ADMIN_LABEL}`);

  const FIXTURE_PREFIX = 'e2e015r';

  function fixtureRoleName(): string {
    return `${FIXTURE_PREFIX} Papel de verificação ${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  let createdRoleIds: string[] = [];

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

  test.afterEach(async ({ page, baseURL }, testInfo) => {
    const ids = createdRoleIds;
    createdRoleIds = [];

    const userId = restrictedUserToRestore;
    restrictedUserToRestore = null;

    if (userId !== null) {
      await signOut(page).catch(() => undefined);
      await signInAsWorkerAdmin(page, testInfo);

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
      if (!deleted.ok()) {
        throw new Error(
          `Cleanup failed to delete fixture role ${id}: ${String(deleted.status())} ` +
            `${await deleted.text()}`,
        );
      }
    }
  });

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

  test('the four indicators come from the summary endpoint, and the first three filter while the fourth does not', async ({
    page,
  }) => {
    const indicators = page.getByRole('region', { name: 'Resumo de papéis e permissões' });
    await expect(indicators).toBeVisible();

    const systemIndicator = page.getByRole('button', {
      name: 'Mostrar somente os papéis do sistema',
    });
    const customIndicator = page.getByRole('button', {
      name: 'Mostrar somente os papéis personalizados',
    });
    const allIndicator = page.getByRole('button', { name: 'Mostrar todos os papéis' });

    await expect(systemIndicator).toHaveAttribute('aria-pressed', 'false');

    await systemIndicator.click();
    await expect(systemIndicator).toHaveAttribute('aria-pressed', 'true');
    await expect(systemIndicator.getByText('Filtro aplicado')).toBeVisible();
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();

    await customIndicator.click();
    await expect(customIndicator).toHaveAttribute('aria-pressed', 'true');
    await expect(systemIndicator).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeHidden();

    await allIndicator.click();
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();

    await expect(indicators.getByText('Usuários com papéis')).toBeVisible();
    await expect(page.getByRole('button', { name: /Usuários com papéis/ })).toHaveCount(0);
  });

  test('search narrows the list by name and the results line says how many of the total are left', async ({
    page,
  }) => {
    await page.getByLabel('Buscar papéis').fill(PLATFORM_ADMIN_STORED);

    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: new RegExp(`^Abrir detalhes do papel ${RISK_MANAGER_LABEL}`),
      }),
    ).toBeHidden();
    await expect(page.getByText(/^1 de \d+ papéis$/)).toBeVisible();

    await page.getByLabel('Buscar papéis').fill(PLATFORM_ADMIN_LABEL);
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();
    await expect(page.getByText(/^1 de \d+ papéis$/)).toBeVisible();

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
    await apiCreateRole(page.request, baseURL, {
      name: roleName,
      description: 'Papel de verificação da fase 015: alcança apenas o módulo Riscos.',
      permissionIdentifiers: ['risk:view'],
    });
    await page.reload();
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible({
      timeout: 15_000,
    });

    const fixtureCard = page.getByRole('button', {
      name: `Abrir detalhes do papel ${roleName}`,
      exact: false,
    });
    await expect(fixtureCard).toBeVisible();

    const filtersToggle = page.getByRole('button', { name: /^Filtros/ });
    await expect(filtersToggle).toHaveAttribute('aria-expanded', 'false');
    await filtersToggle.click();
    await expect(filtersToggle).toHaveAttribute('aria-expanded', 'true');

    const moduleFilter = page.getByRole('combobox', { name: 'Módulo' });

    await moduleFilter.click();
    await page.getByRole('option', { name: 'Riscos', exact: true }).click();
    await expect(fixtureCard).toBeVisible();

    await moduleFilter.click();
    await page.getByRole('option', { name: 'Compliance', exact: true }).click();
    await expect(fixtureCard).toBeHidden();
    await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();

    await filtersToggle.click();
    await expect(filtersToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(moduleFilter).toHaveCount(0);
    const moduleChip = page.getByRole('button', { name: 'Remover filtro: Módulo: Compliance' });
    await expect(moduleChip).toBeVisible();
    await expect(filtersToggle).toContainText('1');

    await moduleChip.click();
    await expect(fixtureCard).toBeVisible();
  });

  test('selecting a role opens the panel beside the list, which stays operable, and closing it returns focus to the card', async ({
    page,
    browserName,
  }) => {
    const card = page.getByRole('button', { name: platformAdminCard });
    await card.click();

    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: PLATFORM_ADMIN_LABEL })).toBeVisible();

    await expect(page).toHaveURL(/\/admin\/roles/);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('aria-current', 'true');
    await expect(card.getByText('Papel selecionado')).toBeVisible();

    await panel.getByRole('button', { name: 'Fechar detalhes do papel' }).click();
    await expect(panel).toBeHidden();
    await expectMouseFocusReturn(page, card, browserName);
  });

  test('the panel opens from the keyboard and closes with Escape, returning focus to the card (scenarios 10 and 11)', async ({
    page,
  }) => {
    const card = page.getByRole('button', { name: platformAdminCard });

    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');

    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();

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

    await expect(panel.getByText('Como este papel concede acesso')).toBeVisible();
    await expect(
      panel.getByText('Não há herança entre papéis: um papel nunca recebe permissões de outro.'),
    ).toBeVisible();
    expect(await panel.textContent()).not.toMatch(/herdad/i);

    await expect(panel.getByRole('heading', { name: /^Riscos/ })).toBeVisible();
    await expect(panel.getByText('risk:view', { exact: true })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Expandir todos' }).click();
    await expect(panel.getByText('risk:view', { exact: true })).toHaveCount(0);

    const identifiersToggle = panel.getByRole('button', { name: 'Ver identificadores técnicos' });
    await expect(identifiersToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(panel.getByText('Nome técnico:')).toHaveCount(0);

    await identifiersToggle.click();
    await expect(panel.getByText('risk:view', { exact: true }).first()).toBeVisible();
    await expect(panel.getByText('role:administer', { exact: true }).first()).toBeVisible();
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

    await expect(panel.getByRole('heading', { name: 'Pessoas com este papel' })).toBeVisible();
    await expect(panel.getByText(/pessoas? têm? este papel/)).toBeVisible();
    await expect(panel.getByText(/@/).first()).toBeVisible({ timeout: 15_000 });

    await expect(panel.getByRole('heading', { name: 'Escopo organizacional' })).toBeVisible();
    await expect(
      panel.getByText(/O escopo organizacional é concedido por usuário, não por este papel\./),
    ).toBeVisible();

    expect(await panel.textContent()).not.toMatch(/herdad/i);
  });

  test('a protected (system) role opens as a read-only definition, with no save to press (FR-031, F-68)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: platformAdminCard }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });

    await expect(
      panel.getByText(
        'Nome, descrição e permissões são definidos pela plataforma e não podem ser alterados aqui.',
      ),
    ).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Editar papel' })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Ver definição' }).click();
    await expect(panel.getByText('Definição do papel', { exact: true })).toBeVisible();

    await expect(
      panel.getByText(
        'Este papel é definido pela plataforma. Nome, descrição e permissões são mantidos pelo ' +
          'próprio sistema e não podem ser alterados aqui.',
      ),
    ).toBeVisible();

    const nameField = panel.getByLabel('Nome');
    await expect(nameField).toHaveAttribute('readonly', '');
    await expect(nameField).toHaveValue(PLATFORM_ADMIN_STORED);
    await expect(panel.getByText('Papel do sistema: o nome não pode ser alterado.')).toBeVisible();

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

    const moduleToggle = panel.getByRole('checkbox').first();
    await expect(moduleToggle).toBeDisabled();

    await expect(panel.getByRole('button', { name: 'Salvar alterações' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);

    const back = panel.getByRole('button', { name: 'Voltar', exact: true });
    await expect(back).toBeInViewport();
    await back.click();

    await expect(panel.getByRole('button', { name: 'Ver definição' })).toBeVisible();
    await expect(panel.getByText('Definição do papel', { exact: true })).toHaveCount(0);
  });

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
    const card = page.getByRole('button', {
      name: `Abrir detalhes do papel ${roleName}`,
      exact: false,
    });
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Personalizado')).toBeVisible();

    await panel.getByRole('button', { name: 'Editar papel' }).click();
    const description = panel.getByLabel('Descrição');
    await expect(description).toBeEnabled();
    await description.fill('Alteração que NÃO deve ser gravada.');
    await expect(panel.getByText('A descrição foi alterada.')).toBeVisible();

    await panel.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Descartar alterações' }).click();
    await expect(panel.getByRole('button', { name: 'Editar papel' })).toBeVisible();

    const afterCancel = await page.request.get(`/api/v1/admin/roles/${created.id}`);
    expect(((await afterCancel.json()) as { description: string }).description).toBe(
      'Papel de verificação da fase 015: edição dentro do painel.',
    );

    await panel.getByRole('button', { name: 'Editar papel' }).click();
    const controlsToggle = panel.getByRole('checkbox', {
      name: 'Selecionar todas as permissões de Controles',
    });
    await expect(controlsToggle).toBeVisible({ timeout: 15_000 });
    await expect(controlsToggle).toHaveAttribute('aria-checked', 'false');

    const risksToggle = panel.getByRole('checkbox', {
      name: 'Selecionar todas as permissões de Riscos',
    });
    await expect(risksToggle).toHaveAttribute('aria-checked', 'mixed');

    await risksToggle.click();
    await expect(risksToggle).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByText('Todas selecionadas')).toBeVisible();

    await expect(panel.getByText(/permissões? a acrescentar$/)).toBeVisible();
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

  test('a session holding role:administer but NOT user:administer sees no personal data at all (scenario 1)', async ({
    page,
    baseURL,
  }) => {
    const restrictedEmail = 'verificacao-015@pharosgrc.local';
    const restrictedPassword = 'Pharos-Verificacao-015-1!';

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

    await signOut(page);
    await signInAsFreshlyProvisionedUser(page, restrictedEmail, restrictedPassword);
    await openRolesScreen(page);

    await page.getByRole('button', { name: platformAdminCard }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    await panel.getByRole('tab', { name: 'Usuários' }).click();

    await expect(panel.getByText('Relação de pessoas indisponível')).toBeVisible();
    await expect(panel.getByText(/pessoas? têm? este papel/)).toBeVisible();
    await expect(
      panel.getByText(/exige a permissão de administração de usuários \(user:administer\)/),
    ).toBeVisible();

    const markup = await page.content();
    expect(markup).not.toContain('@example.local');
    expect(markup).not.toContain('Pessoas com este papel');
    await expect(panel.getByRole('heading', { name: 'Escopo organizacional' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Gerenciar escopo organizacional' })).toHaveCount(
      0,
    );
  });

  test('no horizontal page scroll from 1920 down to 390, and below xl the panel is an overlay that traps focus and closes with Escape (scenarios 12 and 13)', async ({
    page,
    browserName,
  }) => {
    for (const width of [1920, 1440, 1280, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: platformAdminCard })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal page overflow at ${String(width)}px`).toBeLessThanOrEqual(1);
    }

    const card = page.getByRole('button', { name: platformAdminCard });
    await card.click();

    const overlay = page.getByRole('dialog');
    await expect(overlay).toBeVisible();
    const panel = overlay.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    await expectMouseFocusReturn(page, card, browserName);

    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const overlayOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overlayOverflow).toBeLessThanOrEqual(1);
  });

  test('the server refuses a system role rename regardless of what the client sends (FR-033)', async ({
    page,
    baseURL,
  }) => {
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

    const after = await page.request.get(`/api/v1/admin/roles/${systemRole!.id}`);
    const stored = (await after.json()) as { name: string; description: string };
    expect(stored.name).toBe(PLATFORM_ADMIN_STORED);
    expect(stored.description).toBe(systemRole!.description);
  });

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

    const newRoleButton = page.getByRole('button', { name: 'Novo papel' });
    await newRoleButton.click();

    const panel = page.getByRole('complementary', { name: 'Novo papel' });
    await expect(panel).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await expect(panel.getByRole('heading', { name: 'Sem nome ainda' })).toBeVisible();
    await expect(panel.getByText(/^Papéis criados aqui são sempre personalizados/)).toBeVisible();

    await expect(panel.getByText('Pendente: Um nome, de até 100 caracteres')).toHaveCount(1);
    await expect(panel.getByText('Pendente: Ao menos uma permissão selecionada')).toHaveCount(1);
    await expect(
      panel.getByText('Nenhuma permissão selecionada — o papel ainda não concede nada.'),
    ).toBeVisible();

    await panel.getByRole('button', { name: 'Criar papel' }).click();
    await expect(panel.getByText('Informe o nome do papel.')).toBeVisible();
    await expect(panel.getByText('Informe uma descrição do papel.')).toBeVisible();
    await expect(panel.getByText('Selecione ao menos uma permissão.')).toBeVisible();

    await panel.getByLabel('Nome').fill(roleName);
    await panel
      .getByLabel('Descrição')
      .fill('Papel de verificação da fase de E2E: criação pelo painel.');
    await expect(panel.getByText('Informe o nome do papel.')).toHaveCount(0);
    await expect(panel.getByRole('heading', { name: roleName })).toBeVisible();
    await expect(panel.getByText('Atendido: Um nome, de até 100 caracteres')).toHaveCount(1);

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

    const permissionSearch = panel.getByLabel('Buscar permissão');
    await permissionSearch.fill('control:test');
    await expect(panel.getByText(/^1 de \d+ permissões$/)).toBeVisible();
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

    await panel.getByRole('button', { name: 'Criar papel' }).click();
    await expect(page.getByText('Papel criado com sucesso.')).toBeVisible();
    const createdId = await rememberCreatedRole(page, roleName);

    await expect(page.getByRole('complementary', { name: 'Novo papel' })).toHaveCount(0);
    const detail = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('heading', { name: roleName })).toBeVisible();
    await expect(detail.getByText('Personalizado')).toBeVisible();

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

    await panel.getByRole('button', { name: 'Criar papel' }).click();
    await expect(panel.getByText('Já existe um papel com esse nome.')).toBeVisible();
    await expect(page.getByText('Papel criado com sucesso.')).toHaveCount(0);

    await panel.getByRole('button', { name: 'Cancelar' }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Descartar o novo papel?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Continuar preenchendo' }).click();
    await expect(panel.getByLabel('Nome')).toHaveValue(takenName);

    await panel.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Descartar', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Novo papel' })).toHaveCount(0);

    await expectMouseFocusReturn(page, newRoleButton, browserName);

    const list = await page.request.get('/api/v1/admin/roles?page=1&pageSize=100');
    const named = ((await list.json()) as { data: { name: string }[] }).data.filter(
      (role) => role.name === takenName,
    );
    expect(named).toHaveLength(1);
  });

  test('the Users tab pages through the holders of a role, one request per page turn, and a role nobody holds says so', async ({
    page,
    baseURL,
  }) => {
    const emptyRoleName = fixtureRoleName();
    await apiCreateRole(page.request, baseURL, {
      name: emptyRoleName,
      description: 'Papel de verificação: criado sem nenhum titular.',
      permissionIdentifiers: ['risk:view'],
    });

    await page.getByRole('button', { name: platformAdminCard }).click();
    const panel = page.getByRole('complementary', { name: 'Detalhes do papel' });
    await expect(panel).toBeVisible();
    await panel.getByRole('tab', { name: 'Usuários' }).click();
    await expect(panel.getByText(/@/).first()).toBeVisible({ timeout: 15_000 });

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

    rosterRequests.length = 0;
    await panel.getByLabel('Itens por página').selectOption('50');
    const secondSliceEnd = Math.min(total, 50);
    await expect(
      panel.getByText(new RegExp(`^1–${String(secondSliceEnd)} de ${String(total)}$`)),
    ).toBeVisible();
    expect(rosterRequests).toHaveLength(1);
    await expect(panel.getByLabel('Itens por página')).toBeVisible();

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
    await expect(emptyPanel.getByLabel('Itens por página')).toHaveCount(0);
    await expect(emptyPanel.getByText(/^Os demais papéis atribuídos à mesma pessoa\./)).toHaveCount(
      0,
    );
  });
});
