import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  seedPassword,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';

import type { APIResponse } from '@playwright/test';

/**
 * T055/006-assets-processes — E2E of organizational scope on Assets and
 * Processes (FR-010, FR-011, SC-003, SC-003b): an actor scoped to ONE
 * organizational unit never sees another unit's assets/processes in the
 * listing (not in the body, not in the total, not in pagination), a direct
 * read of an out-of-scope record answers exactly like it does not exist,
 * and a write that would LINK a risk to an out-of-scope asset/process is
 * refused identically to a nonexistent target — with no row ever written.
 *
 * Mirrors `audit-engagement-scope.spec.ts` (T084) shape-for-shape: a fresh
 * actor is provisioned through the real `/admin/users` +
 * `/admin/organization` UI (never the shared fixture pool, AGENTS.md), and
 * the "no row written" assertions read back through the SAME endpoints the
 * real UI uses (`GET /risks/{riskId}`'s own embedded `assets`/`processes`
 * arrays — there is no standalone `GET /risks/{riskId}/assets` list
 * endpoint; `risk-controls-section.tsx`'s own header comment states this
 * explicitly) rather than a SQL count this Playwright suite has no access
 * to.
 *
 * ## Role: "Risk Manager", not "Platform Administrator"
 *
 * `platform.seed.ts`'s "Risk Manager" is `globalScope: false` and holds
 * exactly `risk:edit`/`risk:create` plus `asset:view`/`process:view` — no
 * `asset:create`/`asset:edit`/`asset:administer` at all (write authority on
 * the inventory itself is Platform-Administrator-only, per this feature's
 * own task brief). That is precisely the shape this scenario needs: an
 * actor who CAN attempt the link (holds `risk:edit` and the read
 * permission on the target's own resource) but whose ORGANIZATIONAL SCOPE,
 * not their permission set, is what must refuse the out-of-scope attempt —
 * never conflating a 403 (missing permission) with the 422/404 this
 * feature's contract specifically requires so scope can never be inferred
 * from status code (ADR-020 parts 4/5).
 */
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

    // --- Resolve the two organizational units (mirrors
    // `audit-engagement-scope.spec.ts` exactly) -----------------------------
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

    // --- Plant the OUT-OF-SCOPE asset and process under the root unit, as
    // the Worker Admin (global scope), through the real UI -----------------
    const outOfScopeAssetName = `Ativo fora do escopo E2E ${uniqueSuffix}`;
    await page.goto('/assets/new');
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    await page.getByLabel('Nome').fill(outOfScopeAssetName);
    await page
      .getByLabel('Descrição')
      .fill('Ativo plantado fora do escopo concedido, para o E2E de escopo organizacional (T055).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    // The root unit is always this picker's FIRST option (ADR-004's
    // materialized-path order) — the same choice `admin-access.spec.ts`/
    // `audit-engagement-scope.spec.ts` already make for the identical
    // reason, no scrolling required.
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

    // --- Provision the scoped actor (T175/T084's own shape): "Risk
    // Manager" (holds `risk:edit`/`risk:create` and `asset:view`/
    // `process:view` — see this file's own header comment) plus a `UNIT`
    // grant over `DIV-A-TEAM-1` ALONE ---------------------------------------
    const email = `e2e-asset-process-scope-${uniqueSuffix}@pharosgrc.local`;
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
    // The pt-BR LABEL, not the stored `Role.name` this file's header names
    // (ADR-022): `UserRolesDialog` prints every role through
    // `roleDisplayName`, so "Risk Manager" is nowhere on this screen.
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

    // --- Fresh sign-in as the new, narrowly-scoped actor -------------------
    // This account was created (and its password set) by THIS test,
    // seconds ago — known password, no guessing (D-17/research.md step 3,
    // generalized to every call site sharing the pattern).
    await signOut(page);
    await signInAsFreshlyProvisionedUser(page, email, initialPassword);
    const actorOrigin = new URL(page.url()).origin;

    // ======================================================================
    // Read leak — listing: GET /assets, GET /processes never surface the
    // root unit's inventory, not in `data`, not in `meta.total`, not across
    // pagination (FR-010, SC-003b) -----------------------------------------
    // ======================================================================
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

    // `meta.total` must count ONLY what this actor can see — a total that
    // included the out-of-scope row would leak its existence through a
    // number even if `data` itself were filtered correctly.
    const scopedAssetIdsResponse = await page.request.get(
      '/api/v1/assets?pageSize=100&orgUnitId=' + grantedUnit!.id,
    );
    expect(scopedAssetIdsResponse.ok(), await describeFailure(scopedAssetIdsResponse)).toBe(true);
    const scopedAssetsBody = (await scopedAssetIdsResponse.json()) as {
      data: readonly unknown[];
      meta: { total: number };
    };
    expect(assetListBody.meta.total).toBe(scopedAssetsBody.meta.total);

    // ======================================================================
    // Read leak — direct record read: GET /assets/{id}, GET /processes/{id}
    // answer `404`, never `403` (non-disclosure, FR-010) --------------------
    // ======================================================================
    const assetReadAttempt = await page.request.get(`/api/v1/assets/${outOfScopeAssetId}`);
    expect(assetReadAttempt.status(), await describeFailure(assetReadAttempt)).toBe(404);
    expect(assetReadAttempt.status()).not.toBe(403);

    const processReadAttempt = await page.request.get(`/api/v1/processes/${outOfScopeProcessId}`);
    expect(processReadAttempt.status(), await describeFailure(processReadAttempt)).toBe(404);
    expect(processReadAttempt.status()).not.toBe(403);

    // ======================================================================
    // Write leak — the actor plants its OWN in-scope risk (under the ONE
    // unit its grant actually covers), then attempts to link it to each
    // OUT-OF-SCOPE target: `422` naming the field, never `403`, and no row
    // written (FR-011, SC-003) ----------------------------------------------
    // ======================================================================
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

    // --- Asset link ---------------------------------------------------------
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

    // --- Process link (re-reads the ETag: the risk's version has not moved
    // since the refused asset-link attempt above touched nothing) ----------
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

/** Formats a failed `page.request` response for a test assertion message —
 * status plus body, mirroring `audit-engagement-scope.spec.ts`'s identical
 * helper. */
async function describeFailure(response: APIResponse): Promise<string> {
  if (response.ok()) return '';
  return `expected 2xx, got ${String(response.status())}: ${await response.text()}`;
}
