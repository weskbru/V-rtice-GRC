import { expect, test } from '@playwright/test';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signOut,
} from './support/admin-session';
import { openRiskDetailSection, riskDetailSectionPanel } from './support/risk-detail-sections';

test.describe('An analyst requests acceptance and a second user approves it (US6)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real approval journey.',
  );

  test('requests acceptance as the analyst and approves it as a different, eligible user', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para aprovação E2E ${uniqueSuffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência criado pelo E2E de aprovação (T152).');
    await page.getByRole('combobox', { name: /Categoria/ }).click();
    await page.getByRole('option').nth(1).click();
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const statusBadge = page.locator('header');
    await expect(statusBadge.getByText('Rascunho', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Aplicar: Identificado' }).click();
    await expect(
      page.getByRole('heading', { name: 'Aplicar transição para "Identificado"' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar transição' }).click();
    await expect(statusBadge.getByText('Identificado', { exact: true })).toBeVisible();

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
      .fill('Avaliação registrada para permitir a transição de status (T152).');
    await page.getByRole('button', { name: 'Registrar avaliação' }).click();
    const assessmentPanel = riskDetailSectionPanel(page, 'assessment');
    await expect(assessmentPanel.getByText('Inerente: Crítico')).toBeVisible();
    await expect(assessmentPanel.getByText('Residual: Baixo')).toBeVisible();

    await openRiskDetailSection(page, 'overview');

    await page.getByRole('button', { name: 'Aplicar: Avaliado' }).click();
    await page.getByRole('button', { name: 'Confirmar transição' }).click();
    await expect(statusBadge.getByText('Avaliado', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Solicitar aprovação: Aceito' }).click();
    await expect(
      page.getByRole('heading', { name: 'Solicitar aprovação para "Aceito"' }),
    ).toBeVisible();
    await page
      .getByLabel('Justificativa', { exact: true })
      .fill('Risco residual dentro do apetite aprovado; solicito o aceite (T152).');
    await page.getByRole('button', { name: 'Solicitar aprovação' }).click();

    await expect(statusBadge.getByText('Avaliado', { exact: true })).toBeVisible();
    await expect(page.getByText('Aguardando aprovação')).toBeVisible();
    await expect(page.getByText(/Solicitado por Fixture — Risk Analyst/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprovar' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Rejeitar' })).not.toBeVisible();

    const riskUrl = page.url();

    await signOut(page);
    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskApprover);
    await page.goto(riskUrl);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Aguardando aprovação')).toBeVisible();
    await expect(page.getByText(/Solicitado por Fixture — Risk Analyst/)).toBeVisible();
    await expect(page.getByText('Transição solicitada: para Avaliado → Aceito')).toBeVisible();
    await expect(
      page.getByText('Risco residual dentro do apetite aprovado; solicito o aceite (T152).'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Aprovar' }).click();
    const decisionDialog = page.getByRole('dialog');
    await expect(decisionDialog.getByRole('heading', { name: 'Aprovar transição' })).toBeVisible();
    await expect(decisionDialog.getByText(/Fixture — Risk Analyst/)).toBeVisible();
    await expect(
      decisionDialog.getByText(
        'Esta decisão é registrada permanentemente e não poderá ser desfeita.',
      ),
    ).toBeVisible();
    await decisionDialog
      .getByLabel('Justificativa')
      .fill('Aceite aprovado — exposição residual compatível com o apetite de risco (T152).');
    await decisionDialog.getByRole('button', { name: 'Confirmar aprovação' }).click();

    await expect(statusBadge.getByText('Aceito', { exact: true })).toBeVisible();
    await expect(page.getByText('Aguardando aprovação')).toHaveCount(0);
  });
});
