import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsAdmin } from './support/admin-session';

import type { Page } from '@playwright/test';

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
    const email = `fix-f5-${suffix}@verticegrc.local`;

    const createResponse = await postFromPage(page, '/api/v1/admin/users', {
      email,
      fullName,
      initialPassword: 'Vertice-E2E-FixF5-1!',
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

      await page.getByRole('combobox', { name: 'Responsável pelo controle' }).click();
      await expect(page.getByRole('option', { name: fullName })).not.toBeVisible();

      await page.getByPlaceholder('Buscar por nome ou e-mail…').fill(fullName);
      await page.getByRole('option', { name: fullName }).click();

      await page.getByRole('button', { name: 'Cadastrar controle' }).click();
      await page.waitForURL(/\/controls\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

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
