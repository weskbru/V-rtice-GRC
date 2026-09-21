import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';

/**
 * F-55 (`docs/deferred-findings.md`): Compliance never had an E2E of its
 * own — unlike every other business-module screen in this suite (Controles
 * has `control-detail.spec.ts`, Ativos/Processos have their own specs, and
 * so on). The screen exists and is navigable (the backend closed in
 * `specs/004-compliance-management/`, commit `8f0452d`); this is coverage
 * for what already works, not new functionality.
 *
 * Deliberately lean, per this pass's own scope: proves the one real journey
 * a caller can complete today — cadastrar um framework pela biblioteca
 * normativa, chegar ao detalhe. Versions, requirements, mapping migrations
 * and applicability are deeper screens that stay in the visual-review queue
 * (CLAUDE.md §18.1) and are NOT covered here — this spec is the seed to
 * extend there, not the final word on Compliance E2E coverage.
 */
test.describe('Compliance — biblioteca normativa: cadastro de framework (F-55)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real compliance journey.',
  );

  test('creates a framework from the register and reaches its detail page', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);

    const suffix = Date.now().toString(36);
    const frameworkName = `Framework E2E ${suffix}`;

    await page.goto('/compliance');
    await expect(page.getByRole('heading', { name: 'Biblioteca normativa' })).toBeVisible();

    await page.goto('/compliance/new');
    await expect(page.getByRole('heading', { name: 'Cadastrar framework' })).toBeVisible();

    await page.getByLabel('Nome').fill(frameworkName);
    await page
      .getByLabel('Descrição')
      .fill('Framework criado pelo E2E de cobertura do módulo de Compliance (F-55).');
    await page.getByRole('combobox', { name: /^Origem/ }).click();
    await page.getByRole('option', { name: 'Norma externa', exact: true }).click();
    await page.getByRole('button', { name: 'Cadastrar framework' }).click();

    await page.waitForURL(/\/compliance\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: frameworkName, exact: true })).toBeVisible();

    // "Versões" is a separate tab (`tablist "Seções do registro"`), not
    // rendered under "Visão geral" — measured directly against the real
    // page (a first version of this assertion, without the tab click,
    // failed with "element(s) not found").
    await page.getByRole('tab', { name: 'Versões' }).click();
    await expect(page.getByText('Nenhuma versão cadastrada')).toBeVisible();

    // Back on the register, the new framework is a real row, reachable by
    // its own accessible name — never assumed from the create response
    // alone. This local database already carries dozens of frameworks
    // (accumulated across sessions), sorted by code ascending by default,
    // so a freshly created one is not on the first page — searched for by
    // name instead of assuming pagination/sort would surface it (measured
    // directly: a first version of this assertion without the search timed
    // out on page 1 of 2).
    await page.goto('/compliance');
    await page.getByRole('searchbox', { name: 'Buscar por nome ou código' }).fill(frameworkName);
    await expect(
      page.getByRole('link', { name: new RegExp(`^Abrir o framework .*: ${frameworkName}$`) }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
