import { expect, test } from '@playwright/test';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';
import {
  openRiskDetailSection,
  riskDetailLeafTablist,
  riskDetailSectionPanel,
} from './support/risk-detail-sections';

test.describe("Reconstructing a risk's evolution from the History and Audit tabs (US7)", () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real History/Audit tabs.',
  );

  test('shows a merged chronology to anyone who can see the risk, and the raw audit trail only to a caller with audit:view', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);

    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para histórico E2E ${uniqueSuffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência criado pelo E2E de histórico e auditoria (T165).');
    await page.getByRole('combobox', { name: /Categoria/ }).click();
    await page.getByRole('option').nth(1).click();
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const riskUrl = page.url();

    await openRiskDetailSection(page, 'history');
    const registerLeafTablistWithoutAudit = riskDetailLeafTablist(page, 'register')!;
    await expect(
      registerLeafTablistWithoutAudit.getByRole('tab', { name: 'Auditoria' }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Aplicar: Identificado' }).click();
    await page.getByRole('button', { name: 'Confirmar transição' }).click();
    const statusBadge = page.locator('header');
    await expect(statusBadge.getByText('Identificado', { exact: true })).toBeVisible();

    await openRiskDetailSection(page, 'assessment');
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
    await page.getByRole('button', { name: 'Registrar avaliação' }).click();
    await expect(
      riskDetailSectionPanel(page, 'assessment').getByText('Inerente: Crítico'),
    ).toBeVisible();
    await openRiskDetailSection(page, 'overview');

    await page.getByRole('button', { name: 'Aplicar: Avaliado' }).click();
    await page.getByRole('button', { name: 'Confirmar transição' }).click();
    await expect(statusBadge.getByText('Avaliado', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Solicitar aprovação: Aceito' }).click();
    await page
      .getByLabel('Justificativa', { exact: true })
      .fill('Risco residual dentro do apetite aprovado; solicito o aceite (T165).');
    await page.getByRole('button', { name: 'Solicitar aprovação' }).click();
    await expect(page.getByText('Aguardando aprovação')).toBeVisible();

    await openRiskDetailSection(page, 'history');
    const historyList = page.getByRole('list', { name: 'Histórico do risco' });
    await expect(historyList).toBeVisible();

    await expect(
      historyList.getByText('O risco transicionou de "Rascunho" para "Identificado".'),
    ).toBeVisible();
    await expect(
      historyList.getByText('O risco transicionou de "Identificado" para "Avaliado".'),
    ).toBeVisible();
    await expect(
      historyList.getByText(/Nova avaliação registrada — risco residual Baixo/),
    ).toBeVisible();
    await expect(
      historyList.getByText('Aprovação solicitada para a transição para "Aceito".'),
    ).toBeVisible();

    const assessmentEntry = historyList
      .getByRole('listitem')
      .filter({ hasText: 'Nova avaliação registrada' });
    await expect(assessmentEntry.getByText('Registrado em')).toBeVisible();
    await expect(assessmentEntry.getByText('Data informada')).toBeVisible();

    const firstTransitionEntry = historyList
      .getByRole('listitem')
      .filter({ hasText: 'para "Identificado".' });
    await expect(firstTransitionEntry.getByText('Registrado em')).toBeVisible();
    await expect(firstTransitionEntry.getByText('Data informada')).toHaveCount(0);

    await expect(historyList.getByText('risk.created')).toHaveCount(0);

    await page.getByRole('button', { name: 'Tipo de evento' }).click();
    const typeFilterPanel = page.getByRole('group', { name: 'Tipo de evento' });
    await typeFilterPanel.getByRole('checkbox', { name: 'Aprovação' }).check();
    await expect(historyList.getByRole('listitem')).toHaveCount(1);
    await expect(
      historyList.getByText('Aprovação solicitada para a transição para "Aceito".'),
    ).toBeVisible();
    await expect(historyList.getByText(/O risco transicionou/)).toHaveCount(0);
    await typeFilterPanel.getByRole('checkbox', { name: 'Aprovação' }).uncheck();

    await signOut(page);
    await signInAsWorkerAdmin(page, testInfo);
    await page.goto(riskUrl);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByRole('button', { name: 'Aprovar' }).click();
    const decisionDialog = page.getByRole('dialog');
    await decisionDialog
      .getByLabel('Justificativa')
      .fill('Aceite aprovado — exposição residual compatível com o apetite de risco (T165).');
    await decisionDialog.getByRole('button', { name: 'Confirmar aprovação' }).click();
    await expect(statusBadge.getByText('Aceito', { exact: true })).toBeVisible();

    await openRiskDetailSection(page, 'history');
    const adminHistoryList = page.getByRole('list', { name: 'Histórico do risco' });
    await expect(
      adminHistoryList.getByText('Aprovação concedida — transição para "Aceito" aplicada.'),
    ).toBeVisible();
    await expect(
      adminHistoryList.getByText('O risco transicionou de "Avaliado" para "Aceito".'),
    ).toBeVisible();
    await expect(adminHistoryList.getByText('risk.created')).toHaveCount(0);

    await expect(
      riskDetailLeafTablist(page, 'register')!.getByRole('tab', { name: 'Auditoria', exact: true }),
    ).toBeVisible();
    await openRiskDetailSection(page, 'audit');
    const auditList = page.getByRole('list', { name: 'Trilha de auditoria' });
    await expect(auditList).toBeVisible();

    await expect(auditList.getByText('risk.created')).toBeVisible();
    await expect(auditList.getByText('risk.transitioned').first()).toBeVisible();
    await expect(auditList.getByText('risk.assessed')).toBeVisible();
    await expect(auditList.getByText('risk.approval_requested')).toBeVisible();
    await expect(auditList.getByText('risk.approval_approved')).toBeVisible();
    await expect(auditList.getByText('Sucesso').first()).toBeVisible();
    await expect(auditList.getByText(/Fixture — Risk Analyst/).first()).toBeVisible();

    const riskCreatedEntry = auditList.getByRole('listitem').filter({ hasText: 'risk.created' });
    const changedFields = riskCreatedEntry
      .locator('div')
      .filter({ hasText: 'Campos alterados' })
      .first();
    await expect(changedFields.getByText('Categoria:')).toBeVisible();
    await expect(changedFields.getByText('categoryId:')).toHaveCount(0);
    const changedFieldsText = await changedFields.innerText();
    expect(changedFieldsText).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });
});
