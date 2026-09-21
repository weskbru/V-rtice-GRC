import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsAdmin } from './support/admin-session';

import type { Page } from '@playwright/test';

/**
 * S-10 (CONSOLIDATED.md P1; A7-F10, A5-F02, A1-report.md's "74 entradas
 * quase idênticas" note) — end-to-end proof that the owner picker on a real
 * form finds a real user beyond `GET /users`'s old fixed `pageSize=100`
 * first page, via search.
 *
 * The dev database already carries more than 100 users (this audit's own
 * finding). Rather than relying on this fixture's alphabetical rank among
 * whatever already exists (fragile against unrelated seed churn), this
 * spec proves the actual defect directly: a user created just now, findable
 * ONLY by searching for their name (never by opening the picker unsearched
 * — `Control Owner` picker's own `onSearch('')` first page will not
 * contain them, since this account is deliberately given no organizational
 * unit and a name no unsearched alphabetical/creation-order page is
 * guaranteed to include), is found and can be saved as a control's owner.
 *
 * Cleanup: the fixture user is deactivated (`PUT /admin/users/{id}/status`)
 * at the end — there is no hard delete for users (business rule), so
 * deactivation is what "a plataforma permite" for cleanup.
 */

test.describe('S-10 — seletor de usuário busca no servidor', () => {
  requireSeedCredentials(
    'user-picker-search.spec.ts requires SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD.',
  );

  test('um usuário [FIX-F5] criado agora é encontrado por busca e salvo como dono de um controle', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await signInAsAdmin(page);

    const suffix = randomUUID().slice(0, 8);
    const fullName = `[FIX-F5] Usuário Além da Página 100 ${suffix}`;
    const email = `fix-f5-${suffix}@pharosgrc.local`;

    const createResponse = await postFromPage(page, '/api/v1/admin/users', {
      email,
      fullName,
      // No `primaryOrgUnitId` — the assignment rule (`AssignmentLineService`)
      // includes "active users with no primary organizational unit at all",
      // so this fixture is assignable to a control under ANY unit, without
      // needing to match the control's own unit.
      initialPassword: 'Pharos-E2E-FixF5-1!',
    });
    expect(createResponse.status, await describeFailure(createResponse)).toBe(201);
    const created = (await createResponse.json()) as { id: string };
    const userId = created.id;

    try {
      await page.goto('/controls/new');
      await expect(page.getByRole('heading', { name: 'Novo controle' })).toBeVisible();

      const controlName = `[FIX-F5] Controle E2E ${suffix}`;
      await page.getByLabel('Nome').fill(controlName);
      await page
        .getByLabel('Descrição')
        .fill('Controle plantado pelo E2E de S-10 (busca do seletor de responsável).');

      await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
      await page.getByRole('option').first().click();

      // The owner picker's OWN unsearched first page (opened, no query
      // typed) must not already show this brand-new fixture — otherwise
      // this spec would not be proving search at all.
      await page.getByRole('combobox', { name: 'Responsável pelo controle' }).click();
      await expect(page.getByRole('option', { name: fullName })).not.toBeVisible();

      await page.getByPlaceholder('Buscar por nome ou e-mail…').fill(fullName);
      await page.getByRole('option', { name: fullName }).click();

      await page.getByRole('button', { name: 'Cadastrar controle' }).click();
      await page.waitForURL(/\/controls\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

      // The created control's own detail page shows the saved owner's name
      // — proof the selection was actually submitted and persisted, not
      // just accepted by the picker's own local state.
      await expect(page.getByText(fullName)).toBeVisible();
    } finally {
      const deactivateResponse = await putFromPage(page, `/api/v1/admin/users/${userId}/status`, {
        status: 'INACTIVE',
        reason: '[FIX-F5] limpeza do E2E de S-10 (user-picker-search.spec.ts).',
      });
      expect(deactivateResponse.status, await describeFailure(deactivateResponse)).toBe(200);
    }
  });
});

interface InPageFetchResult {
  readonly status: number;
  readonly text: string;
}

/**
 * Same-origin, in-page `fetch` — mirrors `support/admin-session.ts`'s own
 * private `fetchFromPage` (not exported) exactly, and for the identical
 * reason: `page.request` does not carry the `Origin` header
 * `CsrfMiddleware` requires on a mutation, so a request built that way is
 * refused `403` regardless of a valid session cookie.
 */
async function fetchFromPage(
  page: Page,
  path: string,
  method: string,
  body: unknown,
): Promise<InPageFetchResult> {
  return page.evaluate(
    async ({ path: requestPath, method: requestMethod, body: requestBody }) => {
      const response = await fetch(requestPath, {
        method: requestMethod,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      return { status: response.status, text: await response.text() };
    },
    { path, method, body },
  );
}

async function postFromPage(
  page: Page,
  path: string,
  body: unknown,
): Promise<{ status: number; json: () => Promise<unknown> }> {
  const result = await fetchFromPage(page, path, 'POST', body);
  return { status: result.status, json: () => Promise.resolve(JSON.parse(result.text) as unknown) };
}

async function putFromPage(page: Page, path: string, body: unknown): Promise<{ status: number }> {
  const result = await fetchFromPage(page, path, 'PUT', body);
  return { status: result.status };
}

async function describeFailure(response: {
  status: number;
  json?: () => Promise<unknown>;
}): Promise<string> {
  const body = response.json ? await response.json().catch(() => undefined) : undefined;
  return `unexpected status ${String(response.status)}${body ? `: ${JSON.stringify(body)}` : ''}`;
}
