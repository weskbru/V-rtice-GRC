import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { openRiskDetailSection } from './support/risk-detail-sections';

import type { APIResponse, Locator, Page } from '@playwright/test';

test.describe('Audit engagement: created -> scoped -> started -> finding -> remediation -> closure -> links (US1-US3)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real audit engagement journey.',
  );

  test('records an engagement end to end, through the real UI, with one hybrid evidence-link step', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const riskTitle = `Risco para engajamento de auditoria E2E ${uniqueSuffix}`;
    const evidenceTitle = `Evidência de engajamento de auditoria E2E ${uniqueSuffix}`;
    const engagementObjective = `Engajamento de auditoria E2E ${uniqueSuffix}`;
    const findingTitle = `Achado de engajamento de auditoria E2E ${uniqueSuffix}`;

    function dateOnly(daysFromNow: number): string {
      const date = new Date();
      date.setDate(date.getDate() + daysFromNow);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco criado para hospedar o achado do E2E de engajamento de auditoria (T083).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: 'Division A / Team 1 (fixture)' }).click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    const riskId = page.url().split('/').pop()!;

    await openRiskDetailSection(page, 'evidence');
    await expect(page.getByText('Nenhuma evidência vinculada ainda.')).toBeVisible();
    await page.getByRole('button', { name: 'Nova evidência' }).click();
    await expect(page.getByRole('heading', { name: 'Registrar evidência' })).toBeVisible();
    await page.getByLabel('Título').fill(evidenceTitle);
    await page.getByRole('combobox', { name: /Tipo/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Procedência/ }).click();
    await page.getByRole('option').first().click();
    await page
      .getByLabel('Observação', { exact: true })
      .fill('Evidência registrada para o fechamento do achado do E2E de auditoria (T083).');
    await page.getByRole('button', { name: 'Registrar e vincular' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(evidenceTitle)).toBeVisible();

    await page.goto('/audits/new');
    await expect(
      page.getByRole('heading', { name: 'Novo engajamento de auditoria' }),
    ).toBeVisible();
    await page.getByLabel('Objetivo').fill(engagementObjective);
    await page.getByLabel('Início do período').fill(dateOnly(-7));
    await page.getByLabel('Fim do período').fill(dateOnly(90));
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: 'Division A / Team 1 (fixture)' }).click();
    await page.getByRole('combobox', { name: /Auditor responsável/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Abrir engajamento' }).click();
    await page.waitForURL(/\/audits\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: engagementObjective })).toBeVisible();

    await page.getByRole('tab', { name: 'Escopo' }).click();
    await expect(page.getByText('Nenhum item no escopo deste engajamento ainda.')).toBeVisible();
    await page.getByRole('tab', { name: 'Controle' }).click();
    await page.getByRole('combobox', { name: 'Controle' }).click();
    const scopeControl = await pickFirstNameCodeOption(page);
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByText(`${scopeControl.code} — ${scopeControl.name}`)).toBeVisible();

    const startButton = page.getByRole('button', { name: 'Iniciar engajamento' });
    await expect(startButton).toBeEnabled({ timeout: 10_000 });
    await startButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Iniciar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Em execução', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Achados' }).click();
    await page.getByRole('button', { name: 'Registrar achado' }).click();
    await expect(page.getByRole('heading', { name: 'Registrar achado' })).toBeVisible();
    await page.getByLabel('Título').fill(findingTitle);
    await page
      .getByLabel('Descrição')
      .fill('Deficiência de controle identificada pelo engajamento de auditoria E2E (T083).');
    await page.getByRole('combobox', { name: /Categoria/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Origem/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Severidade/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Prioridade/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(findingTitle)).toBeVisible();

    const auditId = /\/audits\/([0-9a-fA-F-]+)/.exec(page.url())![1]!;
    const findingsResponse = await page.request.get(
      `/api/v1/audits/${auditId}/findings?page=1&pageSize=100`,
    );
    expect(findingsResponse.ok(), await describeFailure(findingsResponse)).toBe(true);
    const findingsPage = (await findingsResponse.json()) as {
      data: readonly { id: string; title: string }[];
    };
    const findingId = findingsPage.data.find((item) => item.title === findingTitle)?.id;
    expect(
      findingId,
      'the just-created finding must be findable via GET /audits/{id}/findings',
    ).toBeDefined();

    const evidenceListResponse = await page.request.get(
      `/api/v1/evidence?subjectType=RISK&subjectId=${riskId}&pageSize=100`,
    );
    expect(evidenceListResponse.ok(), await describeFailure(evidenceListResponse)).toBe(true);
    const evidencePage = (await evidenceListResponse.json()) as {
      items: readonly { id: string; title: string }[];
    };
    const evidenceId = evidencePage.items.find((item) => item.title === evidenceTitle)?.id;
    expect(
      evidenceId,
      'the just-created evidence must be findable via GET /evidence',
    ).toBeDefined();

    const linkResponse = await page.request.post(`/api/v1/evidence/${evidenceId}/links`, {
      headers: { Origin: new URL(page.url()).origin },
      data: {
        subjectType: 'FINDING',
        subjectId: findingId,
        note: 'Vínculo criado via hybrid setup (T083) — sem superfície de UI para este passo.',
      },
    });
    expect(linkResponse.ok(), await describeFailure(linkResponse)).toBe(true);

    await page.goto(`/risks/${riskId}`);
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    await openRiskDetailSection(page, 'findings');
    const findingCard = page.getByRole('listitem').filter({ hasText: findingTitle });
    await expect(findingCard).toBeVisible();
    await expect(findingCard.getByText('Aberto', { exact: true })).toBeVisible();

    await expandFinding(findingCard, findingTitle);
    await findingCard.getByRole('button', { name: 'Mover para remediação' }).click();
    const remediationDialog = page.getByRole('dialog');
    await expect(remediationDialog).toBeVisible();
    await remediationDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(remediationDialog).toBeHidden();
    await expect(findingCard.getByText('Em remediação', { exact: true })).toBeVisible();

    await findingCard.getByRole('button', { name: 'Encerrar' }).click();
    const closeDialog = page.getByRole('dialog');
    await expect(closeDialog.getByRole('heading', { name: 'Encerrar achado' })).toBeVisible();
    await expect(closeDialog.getByText('Encerrar um achado agora exige evidência')).toHaveCount(0);
    await closeDialog
      .getByLabel('Justificativa')
      .fill('Remediação concluída e evidenciada — encerrado pelo E2E de auditoria (T083).');
    await closeDialog.getByRole('button', { name: 'Encerrar' }).click();
    await expect(closeDialog).toBeHidden();
    await expect(findingCard.getByText('Encerrado', { exact: true })).toBeVisible();

    await findingCard.getByRole('combobox', { name: 'Selecionar controle' }).click();
    const linkedControl = await pickFirstNameCodeOption(page);
    await findingCard.getByRole('button', { name: 'Vincular controle' }).click();
    await expect(findingCard.getByText(linkedControl.name, { exact: true })).toBeVisible();
    await expect(findingCard.getByText(linkedControl.code, { exact: true })).toBeVisible();

    await findingCard.getByRole('combobox', { name: 'Selecionar risco' }).click();
    const linkedRisk = await pickFirstNameCodeOption(page);
    await findingCard.getByRole('button', { name: 'Vincular risco' }).click();
    await expect(findingCard.getByText(linkedRisk.name, { exact: true })).toBeVisible();
    await expect(findingCard.getByText(linkedRisk.code, { exact: true })).toBeVisible();
  });
});

async function expandFinding(findingCard: Locator, title: string): Promise<void> {
  await findingCard.getByRole('button', { name: new RegExp(title) }).click();
}

async function pickFirstNameCodeOption(page: Page): Promise<{ name: string; code: string }> {
  const firstOption: Locator = page.getByRole('option').first();
  await expect(firstOption).toBeVisible({ timeout: 10_000 });
  const spans = firstOption.locator('span.truncate');
  const name = (await spans.first().textContent())!.trim();
  const code = (await spans.nth(1).textContent())!.trim();
  if (!name || !code) {
    throw new Error(`Unexpected option shape: name="${name}", code="${code}"`);
  }
  await firstOption.click();
  return { name, code };
}

async function describeFailure(response: APIResponse): Promise<string> {
  if (response.ok()) return '';
  return `expected 2xx, got ${String(response.status())}: ${await response.text()}`;
}
