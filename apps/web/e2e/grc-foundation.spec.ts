import { expect, test } from '@playwright/test';

import { loadWebEnv } from '../src/lib/env';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';
import { openRiskDetailSection } from './support/risk-detail-sections';

import type { APIResponse, Locator, Page } from '@playwright/test';

test.describe('Evidence -> link -> action -> finding -> closure with segregation of duties (US1/US2/US3)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real shared-GRC-foundation journey.',
  );

  test('links evidence to a risk and a finding, remediates via an action, and enforces segregation of duties on closure', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const { APP_ORIGIN } = loadWebEnv();
    const uniqueSuffix = Date.now().toString(36);
    const riskTitle = `Risco para fundação GRC E2E ${uniqueSuffix}`;
    const evidenceTitle = `Evidência de fundação GRC E2E ${uniqueSuffix}`;
    const findingTitle = `Achado de fundação GRC E2E ${uniqueSuffix}`;
    const actionTitle = `Ação de remediação GRC E2E ${uniqueSuffix}`;

    function futureDateOnly(daysFromNow: number): string {
      const date = new Date();
      date.setDate(date.getDate() + daysFromNow);
      return date.toISOString().slice(0, 10);
    }

    await signInAsWorkerAdmin(page, testInfo);

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco criado pelo E2E de fundação GRC compartilhada (T080).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: 'Division A / Team 1 (fixture)' }).click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill('Fixture — Compliance Manager');
    await page.getByRole('option', { name: /^Fixture — Compliance Manager / }).click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    const riskUrl = page.url();
    const riskId = riskUrl.split('/').pop()!;

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
      .fill('Relatório de verificação anexado ao risco (T080).');
    await page.getByRole('button', { name: 'Registrar e vincular' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(evidenceTitle)).toBeVisible();

    await openRiskDetailSection(page, 'findings');
    await page.getByRole('button', { name: 'Novo achado' }).click();
    await expect(page.getByRole('heading', { name: 'Registrar achado' })).toBeVisible();
    await page.getByLabel('Título').fill(findingTitle);
    await page
      .getByLabel('Descrição')
      .fill('Deficiência de controle identificada durante o E2E de fundação GRC (T080).');
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

    const sessionResponse = await page.request.get('/api/v1/auth/session');
    expect(sessionResponse.ok()).toBe(true);
    const adminUserId = ((await sessionResponse.json()) as { user: { id: string } }).user.id;

    const evidenceListResponse = await page.request.get(
      `/api/v1/evidence?subjectType=RISK&subjectId=${riskId}&pageSize=100`,
    );
    expect(evidenceListResponse.ok()).toBe(true);
    const evidencePage = (await evidenceListResponse.json()) as {
      items: readonly { id: string; title: string }[];
    };
    const evidenceId = evidencePage.items.find((item) => item.title === evidenceTitle)?.id;
    expect(
      evidenceId,
      'the just-created evidence must be findable via GET /evidence',
    ).toBeDefined();

    const riskOrgUnitId = await getRiskOrgUnitId(page, riskId);
    const findingListResponse = await page.request.get(
      `/api/v1/findings?orgUnitId=${riskOrgUnitId}&pageSize=100`,
    );
    expect(findingListResponse.ok()).toBe(true);
    const findingPage = (await findingListResponse.json()) as {
      items: readonly { id: string; title: string }[];
    };
    const findingId = findingPage.items.find((item) => item.title === findingTitle)?.id;
    expect(findingId, 'the just-created finding must be findable via GET /findings').toBeDefined();

    const linkResponse = await page.request.post(`/api/v1/evidence/${evidenceId}/links`, {
      headers: { Origin: APP_ORIGIN },
      data: {
        subjectType: 'FINDING',
        subjectId: findingId,
        note: 'Vínculo criado via hybrid setup (T080) — sem superfície de UI para este passo.',
      },
    });
    expect(linkResponse.ok(), await describeFailure(linkResponse)).toBe(true);

    const createActionResponse = await page.request.post('/api/v1/actions', {
      headers: { Origin: APP_ORIGIN },
      data: {
        originType: 'FINDING',
        originId: findingId,
        title: actionTitle,
        description: 'Ação de remediação criada via hybrid setup (T080) — sem superfície de UI.',
        responsibleUserId: adminUserId,
        dueOn: futureDateOnly(7),
      },
    });
    expect(createActionResponse.ok(), await describeFailure(createActionResponse)).toBe(true);

    await page.goto('/actions');
    await expect(page.getByRole('heading', { name: 'Planos de Ação' })).toBeVisible();
    await page.getByRole('radio', { name: 'Ver as ações em tabela' }).click();
    await expect(page).toHaveURL(/[?&]view=table/);
    await expect(
      page.getByRole('table', { name: 'Lista de ações do plano de ação visíveis no seu escopo' }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Itens por página').selectOption('100');

    const actionRow = page.getByRole('row').filter({ hasText: actionTitle });
    await expect(actionRow).toBeVisible();
    await expect(actionRow.getByText('Aberta', { exact: true })).toBeVisible();

    await actionRow.getByRole('button', { name: 'Ações' }).click();
    await page.getByRole('menuitem', { name: 'Iniciar' }).click();
    await expect(actionRow.getByText('Em andamento', { exact: true })).toBeVisible();

    await actionRow.getByRole('button', { name: 'Ações' }).click();
    await page.getByRole('menuitem', { name: 'Concluir' }).click();
    await expect(actionRow.getByText('Concluída', { exact: true })).toBeVisible();

    await page.goto(riskUrl);
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    await openRiskDetailSection(page, 'findings');
    const findingCard = page.getByRole('listitem').filter({ hasText: findingTitle });
    await expandFinding(findingCard, findingTitle);
    await findingCard.getByRole('button', { name: 'Encerrar' }).click();

    const closeDialog = page.getByRole('dialog');
    await expect(closeDialog.getByRole('heading', { name: 'Encerrar achado' })).toBeVisible();
    await closeDialog.getByRole('button', { name: 'Encerrar' }).click();
    await expect(
      closeDialog.getByText(
        'Quem executou a remediação não pode encerrar o achado. Peça que outra pessoa com ' +
          'permissão de encerramento realize esta ação.',
      ),
    ).toBeVisible();
    await expect(closeDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(closeDialog).toBeHidden();
    await expect(findingCard.getByText('Aberto', { exact: true })).toBeVisible();

    await signOut(page);
    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskApprover);
    await page.goto(riskUrl);
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    await openRiskDetailSection(page, 'findings');
    const findingCardAsApprover = page.getByRole('listitem').filter({ hasText: findingTitle });
    await expandFinding(findingCardAsApprover, findingTitle);
    await findingCardAsApprover.getByRole('button', { name: 'Encerrar' }).click();

    const secondCloseDialog = page.getByRole('dialog');
    await expect(secondCloseDialog.getByRole('heading', { name: 'Encerrar achado' })).toBeVisible();
    await secondCloseDialog.getByRole('button', { name: 'Encerrar' }).click();
    await expect(secondCloseDialog).toBeHidden();

    await expect(findingCardAsApprover.getByText('Encerrado', { exact: true })).toBeVisible();
    await expect(findingCardAsApprover.getByRole('button', { name: 'Encerrar' })).toHaveCount(0);
  });
});

async function expandFinding(findingCard: Locator, title: string): Promise<void> {
  await findingCard.getByRole('button', { name: new RegExp(title) }).click();
}

async function getRiskOrgUnitId(page: Page, riskId: string): Promise<string> {
  const response = await page.request.get(`/api/v1/risks/${riskId}`);
  expect(response.ok()).toBe(true);
  const risk = (await response.json()) as { orgUnit: { id: string } };
  return risk.orgUnit.id;
}

async function describeFailure(response: APIResponse): Promise<string> {
  if (response.ok()) return '';
  return `expected 2xx, got ${String(response.status())}: ${await response.text()}`;
}
