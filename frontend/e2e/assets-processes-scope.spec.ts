import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  seedPassword,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';

import type { APIResponse } from '@playwright/test';

test.describe('Organizational scope on Asset/Process listing and risk-link writes never leaks a 403 (FR-010/FR-011)', () => {
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

  test("an actor scoped to one unit never sees the other unit's inventory, and a link write against it is refused like a nonexistent target", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

    const outOfScopeAssetName = `Ativo fora do escopo E2E ${uniqueSuffix}`;
    await page.goto('/assets/new');
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    await page.getByLabel('Nome').fill(outOfScopeAssetName);
    await page
      .getByLabel('Descrição')
      .fill('Ativo plantado fora do escopo concedido, para o E2E de escopo organizacional (T055).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Cadastrar ativo' }).click();
    await page.waitForURL(/\/assets\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const outOfScopeAssetId = page.url().split('/').pop()!;

    const outOfScopeProcessName = `Processo fora do escopo E2E ${uniqueSuffix}`;
    await page.goto('/processes/new');
    await expect(page.getByRole('heading', { name: 'Novo processo' })).toBeVisible();
    await page.getByLabel('Nome').fill(outOfScopeProcessName);
    await page
      .getByLabel('Descrição')
      .fill(
        'Processo plantado fora do escopo concedido, para o E2E de escopo organizacional (T055).',
      );
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Cadastrar processo' }).click();
    await page.waitForURL(/\/processes\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const outOfScopeProcessId = page.url().split('/').pop()!;

    const email = `e2e-asset-process-scope-${uniqueSuffix}@verticegrc.local`;
    const fullName = `Usuário Escopo de Ativos/Processos E2E ${uniqueSuffix}`;
    const initialPassword = `${seedPassword}-AssetProcessScope-1`;

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
    await rolesDialog.getByText('Gestor de Riscos', { exact: true }).click();
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

    const assetListResponse = await page.request.get('/api/v1/assets?pageSize=100');
    expect(assetListResponse.ok(), await describeFailure(assetListResponse)).toBe(true);
    const assetListBody = (await assetListResponse.json()) as {
      data: readonly { id: string; orgUnit: { id: string } | null }[];
      meta: { total: number };
    };
    expect(assetListBody.data.some((asset) => asset.id === outOfScopeAssetId)).toBe(false);
    expect(
      assetListBody.data.some((asset) => asset.orgUnit?.id === rootUnit!.id),
      'no row from the root unit may appear in a unit-A-scoped listing',
    ).toBe(false);

    const processListResponse = await page.request.get('/api/v1/processes?pageSize=100');
    expect(processListResponse.ok(), await describeFailure(processListResponse)).toBe(true);
    const processListBody = (await processListResponse.json()) as {
      data: readonly { id: string; orgUnit: { id: string } | null }[];
      meta: { total: number };
    };
    expect(processListBody.data.some((process) => process.id === outOfScopeProcessId)).toBe(false);
    expect(
      processListBody.data.some((process) => process.orgUnit?.id === rootUnit!.id),
      'no row from the root unit may appear in a unit-A-scoped listing',
    ).toBe(false);

    const scopedAssetIdsResponse = await page.request.get(
      '/api/v1/assets?pageSize=100&orgUnitId=' + grantedUnit!.id,
    );
    expect(scopedAssetIdsResponse.ok(), await describeFailure(scopedAssetIdsResponse)).toBe(true);
    const scopedAssetsBody = (await scopedAssetIdsResponse.json()) as {
      data: readonly unknown[];
      meta: { total: number };
    };
    expect(assetListBody.meta.total).toBe(scopedAssetsBody.meta.total);

    const assetReadAttempt = await page.request.get(`/api/v1/assets/${outOfScopeAssetId}`);
    expect(assetReadAttempt.status(), await describeFailure(assetReadAttempt)).toBe(404);
    expect(assetReadAttempt.status()).not.toBe(403);

    const processReadAttempt = await page.request.get(`/api/v1/processes/${outOfScopeProcessId}`);
    expect(processReadAttempt.status(), await describeFailure(processReadAttempt)).toBe(404);
    expect(processReadAttempt.status()).not.toBe(403);

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    const riskTitle = `Risco do ator com escopo E2E ${uniqueSuffix}`;
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco do ator com escopo concedido, alvo dos vínculos deste E2E (T055).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: 'Division A / Team 1 (fixture)' }).click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const riskId = page.url().split('/').pop()!;

    async function readRisk(): Promise<{
      etag: string;
      assets: readonly unknown[];
      processes: readonly unknown[];
    }> {
      const response = await page.request.get(`/api/v1/risks/${riskId}`);
      expect(response.ok(), await describeFailure(response)).toBe(true);
      const etag = response.headers().etag;
      expect(etag, 'GET /risks/{riskId} must return an ETag (ADR-013)').toBeTruthy();
      const body = (await response.json()) as {
        assets: readonly unknown[];
        processes: readonly unknown[];
      };
      return { etag: etag!, assets: body.assets, processes: body.processes };
    }

    const beforeAssetLink = await readRisk();
    expect(beforeAssetLink.assets.length).toBe(0);
    const assetLinkAttempt = await page.request.post(`/api/v1/risks/${riskId}/assets`, {
      headers: { Origin: actorOrigin, 'If-Match': beforeAssetLink.etag },
      data: { id: outOfScopeAssetId },
    });
    expect(assetLinkAttempt.status(), await describeFailure(assetLinkAttempt)).toBe(422);
    expect(assetLinkAttempt.status()).not.toBe(403);
    const assetLinkBody = (await assetLinkAttempt.json()) as {
      errors?: readonly { field: string }[];
    };
    expect(assetLinkBody.errors?.some((error) => error.field === 'id')).toBe(true);
    const afterAssetLink = await readRisk();
    expect(
      afterAssetLink.assets.length,
      'no asset link row may be written on a refused attempt',
    ).toBe(beforeAssetLink.assets.length);

    const beforeProcessLink = await readRisk();
    expect(beforeProcessLink.processes.length).toBe(0);
    const processLinkAttempt = await page.request.post(`/api/v1/risks/${riskId}/processes`, {
      headers: { Origin: actorOrigin, 'If-Match': beforeProcessLink.etag },
      data: { id: outOfScopeProcessId },
    });
    expect(processLinkAttempt.status(), await describeFailure(processLinkAttempt)).toBe(422);
    expect(processLinkAttempt.status()).not.toBe(403);
    const processLinkBody = (await processLinkAttempt.json()) as {
      errors?: readonly { field: string }[];
    };
    expect(processLinkBody.errors?.some((error) => error.field === 'id')).toBe(true);
    const afterProcessLink = await readRisk();
    expect(
      afterProcessLink.processes.length,
      'no process link row may be written on a refused attempt',
    ).toBe(beforeProcessLink.processes.length);
  });
});

async function describeFailure(response: APIResponse): Promise<string> {
  if (response.ok()) return '';
  return `expected 2xx, got ${String(response.status())}: ${await response.text()}`;
}
