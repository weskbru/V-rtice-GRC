import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  signInAsWorkerAdmin,
  workerAdminFullName,
} from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection, riskDetailSectionPanel } from './support/risk-detail-sections';

test.describe('Assess a risk, reassess it, and read the history (US4)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real assessment journey.',
  );

  test('assesses a risk, reassesses it with different factors, and the history shows the level change with attribution', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para avaliação E2E ${uniqueSuffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência criado pelo E2E de avaliação (T119).');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await openRiskDetailSection(page, 'assessment');
    await expect(page.getByText('Este risco ainda não foi avaliado')).toBeVisible();

    await page.getByRole('button', { name: 'Registrar nova avaliação' }).click();
    await page.getByRole('button', { name: 'Risco inerente' }).click();
    await page
      .getByRole('button', {
        name: 'Probabilidade Quase certo, Impacto Catastrófico: pontuação 25, nível Crítico',
      })
      .click();
    await page.getByRole('button', { name: 'Risco residual' }).click();
    await page
      .getByRole('button', {
        name: 'Probabilidade Raro, Impacto Insignificante: pontuação 1, nível Baixo',
      })
      .click();
    await page
      .getByLabel('Justificativa')
      .fill('Avaliação inicial — nenhum controle em vigor ainda considerado.');
    await page.getByRole('button', { name: 'Registrar avaliação' }).click();

    const assessmentPanel = riskDetailSectionPanel(page, 'assessment');
    await expect(assessmentPanel.getByText('Inerente: Crítico')).toBeVisible();
    await expect(assessmentPanel.getByText('Residual: Baixo')).toBeVisible();

    await page.getByRole('button', { name: 'Registrar nova avaliação' }).click();
    await page.getByRole('button', { name: 'Risco inerente' }).click();
    await page
      .getByRole('button', {
        name: 'Probabilidade Quase certo, Impacto Catastrófico: pontuação 25, nível Crítico',
      })
      .click();
    await page.getByRole('button', { name: 'Risco residual' }).click();
    await page
      .getByRole('button', {
        name: 'Probabilidade Provável, Impacto Maior: pontuação 16, nível Crítico',
      })
      .click();
    await page
      .getByLabel('Justificativa')
      .fill('Reavaliação — controle compensatório perdeu eficácia.');
    await page.getByRole('button', { name: 'Registrar avaliação' }).click();

    await expect(assessmentPanel.getByText('Residual: Crítico')).toBeVisible();

    const historyTable = page.getByRole('table', { name: 'Histórico de avaliações' });
    await expect(historyTable.getByText('Subiu de Baixo para Crítico.')).toBeVisible();
    await expect(
      historyTable.getByText(
        'Primeira avaliação registrada — sem avaliação anterior para comparar.',
      ),
    ).toBeVisible();
    await expect(historyTable.getByText(workerAdminFullName(testInfo)).first()).toBeVisible();
    await expect(historyTable.locator('tbody tr')).toHaveCount(2);
  });
});
