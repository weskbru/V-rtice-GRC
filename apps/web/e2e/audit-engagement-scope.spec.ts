import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  seedPassword,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';

import type { APIResponse, Page } from '@playwright/test';

/**
 * T084 — E2E of organizational scope on the five new pairs
 * 005-audit-findings introduces (quickstart.md §8, FR-014/FR-015/FR-018,
 * SC-006): with an actor whose scope does NOT cover the target's
 * organizational unit, each of `POST /audits/{id}/scope/controls`,
 * `POST /findings/{id}/controls`, `POST /findings/{id}/risks`,
 * `GET /audits/{id}` and `GET /findings/{id}` must answer exactly like the
 * target does not exist — never `403`, which would disclose it does.
 *
 * ## Fresh actor via the real API, never the shared fixture pool (AGENTS.md)
 *
 * The seeded "Audit Lead" role IS unit-scoped by construction
 * (`platform.seed.ts` gives it no `globalScope: true`), and its dev-fixture
 * user (`fixture-audit-lead@pharosgrc.local`) would work mechanically — but
 * AGENTS.md's own testing rule is explicit: E2E isolation comes from FRESH
 * fixtures created through the real API, never a shared mutable account
 * pool (a shared pool is exactly what produced F-16's login race and
 * F-34's 37 orphaned users). This spec instead follows `admin-access.spec
 * .ts`'s (T175) own established shape: an administrator provisions a brand
 * new user through the real `/admin/users` UI, grants it "Audit Lead", and
 * grants a `UNIT` scope over `DIV-A-TEAM-1` alone — then signs in as that
 * exact user for the five checks. The created user is deactivated in
 * `afterEach`, mirroring T175's own teardown rationale.
 *
 * ## Why the org-unit-less `FIXTURE-CONTROL-1` is NOT used as an
 * out-of-scope control
 *
 * `Control.orgUnitId` is nullable, and a NULL org unit reads as "out of
 * scope" for ANY non-`GLOBAL` actor (`link-control.usecase.ts`'s own
 * `isControlWithinScope`) — mechanically enough to produce the same `422`,
 * but it would not actually prove "a control of ANOTHER organizational
 * unit is refused", only "a control with NO organizational unit is
 * refused" — a materially weaker claim. Controls Management (Phase 2)
 * shipped its own `POST /controls` since `FIXTURE-CONTROL-1` was seeded,
 * so this spec instead plants a REAL control under the root organizational
 * unit — genuinely a different unit from the one the actor's grant covers,
 * verified directly against the running database (41 of 42 seeded/created
 * controls already carry a real `orgUnitId`) rather than assumed.
 *
 * ## The three "no row written" assertions go through the same API the UI
 * uses, never a direct database query
 *
 * This is a Playwright E2E suite with no database connection of its own —
 * "before" and "after" row counts are read back through
 * `GET /audits/{id}/scope`, `GET /findings/{id}/controls?includeWithdrawn=
 * true` and `GET /findings/{id}/risks?includeWithdrawn=true`, the exact
 * same reads the real UI performs, rather than a SQL count this suite has
 * no access to. Equally rigorous: a write that silently succeeded despite
 * the `422` would show up here as a new row in the very same list the
 * application itself renders.
 */
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

    // --- Resolve the two organizational units this spec needs: the root
    // (always outside a `UNIT` grant on a descendant — never itself a
    // descendant, FR-025b) and "Division A / Team 1 (fixture)" (the unit
    // the new user's grant will cover) -------------------------------------
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

    // --- Plant every OUT-OF-SCOPE target under the root unit, as the
    // Worker Admin (global scope) ------------------------------------------
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
    // The root unit is always this picker's FIRST option (ADR-004's
    // materialized-path order) — the same choice `admin-access.spec.ts`
    // already makes for the identical reason, no scrolling required.
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

    // --- Provision the scoped actor (T181-T183's own shape, admin-access
    // .spec.ts) — "Audit Lead" (holds every write permission this spec
    // attempts) plus a `UNIT` grant over `DIV-A-TEAM-1` ALONE -------------
    const email = `e2e-audit-scope-${uniqueSuffix}@pharosgrc.local`;
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
    // The pt-BR LABEL, not the stored `Role.name` this file's header names
    // (ADR-022): `UserRolesDialog` prints every role through
    // `roleDisplayName`, so "Audit Lead" is nowhere on this screen.
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

    // --- Fresh sign-in as the new, narrowly-scoped actor -------------------
    // This account was created (and its password set) by THIS test,
    // seconds ago — known password, no guessing (D-17/research.md step 3,
    // generalized to every call site sharing the pattern).
    await signOut(page);
    await signInAsFreshlyProvisionedUser(page, email, initialPassword);
    const actorOrigin = new URL(page.url()).origin;
    const actorUserId = await resolveOwnUserId(page);

    // --- The actor plants its OWN in-scope engagement and finding, under
    // the ONE unit its grant actually covers — these are the {id}s the
    // three write attempts below target, so a refusal proves the ATTACHED
    // target is out of scope, not the container itself ---------------------
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

    // ======================================================================
    // Pair 1 — Audit -> Control (scope): POST /audits/{id}/scope/controls
    // ======================================================================
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

    // ======================================================================
    // Pair 2 — Finding -> Control: POST /findings/{id}/controls
    // ======================================================================
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

    // ======================================================================
    // Pair 3 — Finding -> Risk: POST /findings/{id}/risks
    // ======================================================================
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

    // ======================================================================
    // Pair 4 — the engagement itself: GET /audits/{id}
    // ======================================================================
    const auditReadAttempt = await page.request.get(`/api/v1/audits/${outOfScopeAuditId}`);
    expect(auditReadAttempt.status(), await describeFailure(auditReadAttempt)).toBe(404);
    expect(auditReadAttempt.status()).not.toBe(403);

    // ======================================================================
    // Pair 5 — the finding itself: GET /findings/{id}
    // ======================================================================
    const findingReadAttempt = await page.request.get(`/api/v1/findings/${outOfScopeFindingId}`);
    expect(findingReadAttempt.status(), await describeFailure(findingReadAttempt)).toBe(404);
    expect(findingReadAttempt.status()).not.toBe(403);
  });
});

/** `GET /auth/session` — the currently signed-in user's own id, shared
 * cookie session (mirrors `grc-foundation.spec.ts`'s identical helper). */
async function resolveOwnUserId(page: Page): Promise<string> {
  const response = await page.request.get('/api/v1/auth/session');
  expect(response.ok(), await describeFailure(response)).toBe(true);
  return ((await response.json()) as { user: { id: string } }).user.id;
}

/** `GET /audits/{id}/scope` is the union of all three scope-link kinds,
 * unfiltered by the API (`AuditScopeSection`'s own client-side filtering by
 * `targetType` mirrored here) — counts only the `CONTROL` entries, since
 * that is the one kind this spec's refused attempt could have written. */
async function countScopeControlEntries(page: Page, auditId: string): Promise<number> {
  const response = await page.request.get(`/api/v1/audits/${auditId}/scope`);
  expect(response.ok(), await describeFailure(response)).toBe(true);
  const entries = (await response.json()) as readonly { targetType: string }[];
  return entries.filter((entry) => entry.targetType === 'CONTROL').length;
}

/** Counts the links a `GET .../controls|risks?includeWithdrawn=true` list
 * returns — `includeWithdrawn=true` so a withdraw-then-relink could never
 * hide a row this assertion should have caught. */
async function countLinks(page: Page, path: string): Promise<number> {
  const response = await page.request.get(path);
  expect(response.ok(), await describeFailure(response)).toBe(true);
  const links = (await response.json()) as readonly unknown[];
  return links.length;
}

/** Formats a failed `page.request` response for a test assertion message —
 * status plus body, mirroring `grc-foundation.spec.ts`'s identical helper. */
async function describeFailure(response: APIResponse): Promise<string> {
  if (response.ok()) return '';
  return `expected 2xx, got ${String(response.status())}: ${await response.text()}`;
}
