import { expect, test } from '@playwright/test';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signInAsWorkerAdmin,
} from './support/admin-session';

/**
 * E2E for the platform landing screen — the part no unit test can prove,
 * because the unit tests mock both endpoints: that the SERVER decides which
 * capabilities a caller receives, and that the screen composes itself from
 * that decision.
 *
 * Two identities against the same database:
 *
 * - the worker admin (Platform Administrator, GLOBAL scope) must receive the
 *   cross-domain view, including the figures that only exist in the summary's
 *   `breakdowns` (actions due soon, pending problems, indicators in alert);
 * - the Risk Analyst fixture holds `risk:view` but neither `risk:approve` nor
 *   `incident:view`/`problem:view`/`control:view`/`compliance:view`/
 *   `indicator:view`, so the cards those gate must be ABSENT for it.
 *
 * Absence assertions are always preceded by a presence assertion on the same
 * screen, so a dashboard that simply failed to load cannot pass them.
 *
 * Headings, not text: every card title is an `<h3>`, and a bare `getByText`
 * for "Riscos" would also match the sidebar link and the chart titles.
 */
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
    // A real <h3> since F-82 (docs/deferred-findings.md) — was plain text
    // (CardTitle renders a <div>) until Dashboard V2 Fase E gave the three
    // chart cards their own heading, local to DashboardChartCard.
    await expect(
      main.getByRole('heading', { name: 'Planos de ação por status', exact: true }),
    ).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Ações rápidas' })).toBeVisible();

    // The empty planned-modules heading of an earlier build must not return.
    await expect(main.getByRole('heading', { name: 'Módulos planejados' })).toHaveCount(0);
    // And no card lists individual records: nothing links to one risk. Matched
    // on a record id, not on the `/risks/` prefix — "Registrar risco"
    // legitimately points at `/risks/new`.
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
    // Presence first: the screen loaded, and it loaded THIS caller's view.
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
