import { expect, test } from '@playwright/test';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signInAsWorkerAdmin,
} from './support/admin-session';

test.describe('Dashboard — composed from what the server lets each caller see', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real dashboard composition.',
  );

  test('a broadly-permissioned caller gets the cross-domain view', async ({ page }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'O que requer atenção agora' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Visão dos módulos' })).toBeVisible();

    for (const heading of [
      'Aprovações pendentes',
      'Ações atrasadas',
      'Ações vencendo em breve',
      'Incidentes abertos',
      'Problemas pendentes',
      'Indicadores em alerta',
      'Riscos',
      'Planos de Ação',
      'Incidentes',
      'Problemas',
      'Controles',
      'Compliance',
      'Auditoria',
      'Indicadores',
    ]) {
      await expect(main.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await expect(
      main.getByRole('heading', { name: 'Planos de ação por status', exact: true }),
    ).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Ações rápidas' })).toBeVisible();

    await expect(main.getByRole('heading', { name: 'Módulos planejados' })).toHaveCount(0);
    const recordLinks = await main
      .locator('a[href]')
      .evaluateAll((anchors) =>
        anchors
          .map((anchor) => anchor.getAttribute('href') ?? '')
          .filter((href) => /^\/risks\/[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(href)),
      );
    expect(recordLinks).toEqual([]);
  });

  test('a risk analyst receives no card for a capability it cannot read', async ({ page }) => {
    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Riscos para revisão' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Riscos', exact: true })).toBeVisible();

    for (const absent of [
      'Aprovações pendentes',
      'Incidentes abertos',
      'Problemas pendentes',
      'Indicadores em alerta',
      'Incidentes',
      'Problemas',
      'Controles',
      'Compliance',
      'Indicadores',
    ]) {
      await expect(main.getByRole('heading', { name: absent, exact: true })).toHaveCount(0);
    }

    await expect(main.getByText('Sem visibilidade')).toHaveCount(0);
    await expect(main.getByRole('link', { name: 'Registrar incidente' })).toHaveCount(0);
  });
});
