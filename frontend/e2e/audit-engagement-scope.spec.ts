import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  seedPassword,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';

import type { APIResponse, Page } from '@playwright/test';

test.describe('Organizational scope on the five new pairs never leaks a 403 (FR-014/FR-015/FR-018)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real organizational-scope journey.',
  );

  let createdUserFullName: string | undefined;

  test.afterEach(async ({ browser }, testInfo) => {
    if (!createdUserFullName) return;
    const cleanupContext = await browser.newContext();
    try {
      const cleanupPage = await cleanupContext.newPage();
      await signInAsWorkerAdmin(cleanupPage, testInfo);
      await cleanupPage.goto('/admin/users');
      await cleanupPage.getByLabel('Buscar usuários').fill(createdUserFullName);
      const row = cleanupPage.getByRole('row').filter({ hasText: createdUserFullName });
      await row.getByRole('button', { name: /Ações para/ }).click();
      await cleanupPage.getByRole('menuitem', { name: 'Desativar' }).click();
      const statusDialog = cleanupPage.getByRole('dialog');
      await statusDialog.getByRole('button', { name: 'Desativar', exact: true }).click();
      await expect(
        cleanupPage.getByText('Usuário desativado e suas sessões foram encerradas.'),
      ).toBeVisible();
    } finally {
      await cleanupContext.close();
      createdUserFullName = undefined;
    }
  });

  test('an actor scoped to one unit gets 404/422-naming-the-field on all five pairs, never 403, and nothing is written', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    function dateOnly(daysFromNow: number): string {
      const date = new Date();
      date.setDate(date.getDate() + daysFromNow);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const orgUnitsResponse = await page.request.get('/api/v1/org-units');
    expect(orgUnitsResponse.ok(), await describeFailure(orgUnitsResponse)).toBe(true);
    const orgUnits = (await orgUnitsResponse.json()) as readonly {
      id: string;
      code: string;
      name: string;
    }[];
    const rootUnit = orgUnits.find((unit) => unit.code === 'ROOT');
    const grantedUnit = orgUnits.find((unit) => unit.code === 'DIV-A-TEAM-1');
    expect(rootUnit, 'the always-seeded root unit must exist').toBeDefined();
    expect(grantedUnit, 'DIV-A-TEAM-1 must exist — run with SEED_DEV_FIXTURES=true').toBeDefined();

    const outOfScopeControlName = `Controle fora do escopo E2E ${uniqueSuffix}`;
    await page.goto('/controls/new');
    await expect(page.getByRole('heading', { name: 'Novo controle' })).toBeVisible();
    await page.getByLabel('Nome').fill(outOfScopeControlName);
    await page
      .getByLabel('Descrição')
      .fill(
        'Controle plantado fora do escopo concedido, para o E2E de escopo organizacional (T084).',
      );
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Cadastrar controle' }).click();
    await page.waitForURL(/\/controls\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const outOfScopeControlId = page.url().split('/').pop()!;

    const outOfScopeRiskTitle = `Risco fora do escopo E2E ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(outOfScopeRiskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco plantado fora do escopo concedido, para o E2E de escopo organizacional (T084).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const outOfScopeRiskId = page.url().split('/').pop()!;

    const outOfScopeOrigin = new URL(page.url()).origin;

    const outOfScopeEngagementResponse = await page.request.post('/api/v1/audits', {
      headers: { Origin: outOfScopeOrigin },
      data: {
        objective: `Engajamento fora do escopo E2E ${uniqueSuffix}`,
        periodStart: dateOnly(-7),
        periodEnd: dateOnly(90),
        orgUnitId: rootUnit!.id,
        leadAuditorUserId: await resolveOwnUserId(page),
      },
    });
    expect(
      outOfScopeEngagementResponse.ok(),
      await describeFailure(outOfScopeEngagementResponse),
    ).toBe(true);
    const outOfScopeAuditId = ((await outOfScopeEngagementResponse.json()) as { id: string }).id;

    const outOfScopeFindingResponse = await page.request.post('/api/v1/findings', {
      headers: { Origin: outOfScopeOrigin },
      data: {
        orgUnitId: rootUnit!.id,
        title: `Achado fora do escopo E2E ${uniqueSuffix}`,
        description: 'Achado plantado fora do escopo concedido (T084).',
        category: 'NONCONFORMITY',
        origin: 'INTERNAL_ASSESSMENT',
        severity: 'LOW',
        priority: 'LOW',
        ownerUserId: await resolveOwnUserId(page),
        identifiedOn: dateOnly(0),
      },
    });
    expect(outOfScopeFindingResponse.ok(), await describeFailure(outOfScopeFindingResponse)).toBe(
      true,
    );
    const outOfScopeFindingId = ((await outOfScopeFindingResponse.json()) as { id: string }).id;

    const email = `e2e-audit-scope-${uniqueSuffix}@verticegrc.local`;
    const fullName = `Usuário Escopo de Auditoria E2E ${uniqueSuffix}`;
    const initialPassword = `${seedPassword}-AuditScope-1`;

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();
    await page.getByRole('button', { name: 'Novo usuário' }).click();
    await expect(page.getByRole('heading', { name: 'Novo usuário' })).toBeVisible();
    await page.getByLabel('Nome completo').fill(fullName);
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha inicial').fill(initialPassword);
    await page.getByRole('button', { name: 'Criar usuário' }).click();
    await expect(page.getByText('Usuário criado com sucesso.')).toBeVisible();
    createdUserFullName = fullName;

    await page.getByLabel('Buscar usuários').fill(email);
    await expect(page.getByText(email)).toBeVisible();

    const userRow = page.getByRole('row').filter({ hasText: fullName });
    await userRow.getByRole('button', { name: /Ações para/ }).click();
    await page.getByRole('menuitem', { name: 'Papéis' }).click();
    const rolesDialog = page.getByRole('dialog');
    await expect(rolesDialog.getByRole('heading', { name: `Papéis de ${fullName}` })).toBeVisible();
    await rolesDialog.getByText('Líder de Auditoria', { exact: true }).click();
    await rolesDialog.getByRole('button', { name: 'Salvar papéis' }).click();
    await expect(page.getByText('Papéis atualizados com sucesso.')).toBeVisible();

    await page.goto('/admin/organization');
    await expect(page.getByRole('heading', { name: 'Estrutura organizacional' })).toBeVisible();
    await page.getByRole('button', { name: /^Division A \/ Team 1/ }).click();
    await page.getByLabel('Buscar usuário').fill(fullName);
    await page.getByRole('button', { name: new RegExp(fullName) }).click();
    await expect(page.getByRole('heading', { name: `Escopo de ${fullName}` })).toBeVisible();
    await page.getByRole('button', { name: 'Conceder escopo' }).click();
    await expect(page.getByText('Escopo concedido com sucesso.')).toBeVisible();

    await signOut(page);
    await signInAsFreshlyProvisionedUser(page, email, initialPassword);
    const actorOrigin = new URL(page.url()).origin;
    const actorUserId = await resolveOwnUserId(page);

    const inScopeEngagementResponse = await page.request.post('/api/v1/audits', {
      headers: { Origin: actorOrigin },
      data: {
        objective: `Engajamento do ator com escopo E2E ${uniqueSuffix}`,
        periodStart: dateOnly(-7),
        periodEnd: dateOnly(90),
        orgUnitId: grantedUnit!.id,
        leadAuditorUserId: actorUserId,
      },
    });
    expect(inScopeEngagementResponse.ok(), await describeFailure(inScopeEngagementResponse)).toBe(
      true,
    );
    const inScopeAuditId = ((await inScopeEngagementResponse.json()) as { id: string }).id;

    const inScopeFindingResponse = await page.request.post('/api/v1/findings', {
      headers: { Origin: actorOrigin },
      data: {
        orgUnitId: grantedUnit!.id,
        title: `Achado do ator com escopo E2E ${uniqueSuffix}`,
        description: 'Achado do ator com escopo concedido, alvo dos vínculos deste E2E (T084).',
        category: 'NONCONFORMITY',
        origin: 'INTERNAL_ASSESSMENT',
        severity: 'LOW',
        priority: 'LOW',
        ownerUserId: actorUserId,
        identifiedOn: dateOnly(0),
      },
    });
    expect(inScopeFindingResponse.ok(), await describeFailure(inScopeFindingResponse)).toBe(true);
    const inScopeFindingId = ((await inScopeFindingResponse.json()) as { id: string }).id;

    const scopeCountBefore = await countScopeControlEntries(page, inScopeAuditId);
    const scopeAttempt = await page.request.post(
      `/api/v1/audits/${inScopeAuditId}/scope/controls`,
      {
        headers: { Origin: actorOrigin },
        data: { controlId: outOfScopeControlId },
      },
    );
    expect(scopeAttempt.status(), await describeFailure(scopeAttempt)).toBe(422);
    expect(scopeAttempt.status()).not.toBe(403);
    const scopeBody = (await scopeAttempt.json()) as { errors?: readonly { field: string }[] };
    expect(scopeBody.errors?.some((e) => e.field === 'controlId')).toBe(true);
    const scopeCountAfter = await countScopeControlEntries(page, inScopeAuditId);
    expect(scopeCountAfter, 'no scope row may be written on a refused attempt').toBe(
      scopeCountBefore,
    );

    const findingControlsCountBefore = await countLinks(
      page,
      `/api/v1/findings/${inScopeFindingId}/controls?includeWithdrawn=true`,
    );
    const findingControlAttempt = await page.request.post(
      `/api/v1/findings/${inScopeFindingId}/controls`,
      { headers: { Origin: actorOrigin }, data: { controlId: outOfScopeControlId } },
    );
    expect(findingControlAttempt.status(), await describeFailure(findingControlAttempt)).toBe(422);
    expect(findingControlAttempt.status()).not.toBe(403);
    const findingControlBody = (await findingControlAttempt.json()) as {
      errors?: readonly { field: string }[];
    };
    expect(findingControlBody.errors?.some((e) => e.field === 'controlId')).toBe(true);
    const findingControlsCountAfter = await countLinks(
      page,
      `/api/v1/findings/${inScopeFindingId}/controls?includeWithdrawn=true`,
    );
    expect(
      findingControlsCountAfter,
      'no finding-control link may be written on a refused attempt',
    ).toBe(findingControlsCountBefore);

    const findingRisksCountBefore = await countLinks(
      page,
      `/api/v1/findings/${inScopeFindingId}/risks?includeWithdrawn=true`,
    );
    const findingRiskAttempt = await page.request.post(
      `/api/v1/findings/${inScopeFindingId}/risks`,
      { headers: { Origin: actorOrigin }, data: { riskId: outOfScopeRiskId } },
    );
    expect(findingRiskAttempt.status(), await describeFailure(findingRiskAttempt)).toBe(422);
    expect(findingRiskAttempt.status()).not.toBe(403);
    const findingRiskBody = (await findingRiskAttempt.json()) as {
      errors?: readonly { field: string }[];
    };
    expect(findingRiskBody.errors?.some((e) => e.field === 'riskId')).toBe(true);
    const findingRisksCountAfter = await countLinks(
      page,
      `/api/v1/findings/${inScopeFindingId}/risks?includeWithdrawn=true`,
    );
    expect(findingRisksCountAfter, 'no finding-risk link may be written on a refused attempt').toBe(
      findingRisksCountBefore,
    );

    const auditReadAttempt = await page.request.get(`/api/v1/audits/${outOfScopeAuditId}`);
    expect(auditReadAttempt.status(), await describeFailure(auditReadAttempt)).toBe(404);
    expect(auditReadAttempt.status()).not.toBe(403);

    const findingReadAttempt = await page.request.get(`/api/v1/findings/${outOfScopeFindingId}`);
    expect(findingReadAttempt.status(), await describeFailure(findingReadAttempt)).toBe(404);
    expect(findingReadAttempt.status()).not.toBe(403);
  });
});

async function resolveOwnUserId(page: Page): Promise<string> {
  const response = await page.request.get('/api/v1/auth/session');
  expect(response.ok(), await describeFailure(response)).toBe(true);
  return ((await response.json()) as { user: { id: string } }).user.id;
}

async function countScopeControlEntries(page: Page, auditId: string): Promise<number> {
  const response = await page.request.get(`/api/v1/audits/${auditId}/scope`);
  expect(response.ok(), await describeFailure(response)).toBe(true);
  const entries = (await response.json()) as readonly { targetType: string }[];
  return entries.filter((entry) => entry.targetType === 'CONTROL').length;
}

async function countLinks(page: Page, path: string): Promise<number> {
  const response = await page.request.get(path);
  expect(response.ok(), await describeFailure(response)).toBe(true);
  const links = (await response.json()) as readonly unknown[];
  return links.length;
}

async function describeFailure(response: APIResponse): Promise<string> {
  if (response.ok()) return '';
  return `expected 2xx, got ${String(response.status())}: ${await response.text()}`;
}
