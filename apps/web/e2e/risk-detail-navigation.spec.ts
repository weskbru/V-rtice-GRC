import { expect, test } from '@playwright/test';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signInAsWorkerAdmin,
} from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import {
  gotoRiskDetailSection,
  openRiskDetailSection,
  riskDetailGroupTablist,
  riskDetailLeafTablist,
  riskDetailSectionPanel,
  RISK_DETAIL_SECTIONS,
  type RiskDetailSectionId,
} from './support/risk-detail-sections';

import type { Page } from '@playwright/test';

test.describe('Risk detail — two-level navigation, deep link, and the edit overlay', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real risk-detail navigation.',
  );

  function isKnownF71ShellHydrationMismatch(text: string): boolean {
    return (
      text.includes(
        "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties",
      ) &&
      text.includes('DropdownMenuTrigger') &&
      text.includes('Menu da conta')
    );
  }

  async function createFixtureRisk(page: Page, label: string): Promise<string> {
    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para navegação E2E ${label} ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Descrição').fill(`Risco criado pelo E2E de navegação (${label}).`);
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    return title;
  }

  test('every one of the fifteen leaf sections is reachable through the two-level navigation and renders', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    await createFixtureRisk(page, 'quinze-secoes');

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isKnownF71ShellHydrationMismatch(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    const allSectionIds = Object.keys(RISK_DETAIL_SECTIONS) as RiskDetailSectionId[];
    expect(allSectionIds).toHaveLength(15);

    for (const sectionId of allSectionIds) {
      await openRiskDetailSection(page, sectionId);
      await expect(riskDetailSectionPanel(page, sectionId)).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test('?section=<id> opens the correct group and leaf directly, for every section', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    await createFixtureRisk(page, 'deep-link');
    const riskDetailUrl = page.url();

    for (const [sectionId, descriptor] of Object.entries(RISK_DETAIL_SECTIONS) as [
      RiskDetailSectionId,
      (typeof RISK_DETAIL_SECTIONS)[RiskDetailSectionId],
    ][]) {
      await gotoRiskDetailSection(page, riskDetailUrl, sectionId);
      await expect(riskDetailSectionPanel(page, sectionId)).toBeVisible();
      await expect(
        riskDetailGroupTablist(page).getByRole('tab', { name: descriptor.groupLabel, exact: true }),
      ).toHaveAttribute('data-state', 'active');
      if (descriptor.leafLabel) {
        await expect(
          riskDetailLeafTablist(page, descriptor.groupId)!.getByRole('tab', {
            name: descriptor.leafLabel,
            exact: true,
          }),
        ).toHaveAttribute('data-state', 'active');
      }
    }
  });

  test('an unknown ?section= value falls back silently to the first visible section, never an error', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    const title = await createFixtureRisk(page, 'secao-desconhecida');
    const riskDetailUrl = page.url();

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isKnownF71ShellHydrationMismatch(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto(`${riskDetailUrl}?section=isto-nao-existe`);

    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(riskDetailSectionPanel(page, 'overview')).toBeVisible();
    await expect(
      riskDetailGroupTablist(page).getByRole('tab', { name: 'Visão geral', exact: true }),
    ).toHaveAttribute('data-state', 'active');
    expect(consoleErrors).toEqual([]);
  });

  test('a single Back after visiting several sections leaves the risk screen entirely, landing back on the register as left', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para navegação E2E botao-voltar ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Descrição').fill('Risco criado pelo E2E de navegação (botao-voltar).');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    await page.goto('/risks');
    await page.getByRole('radio', { name: 'Ver os riscos em tabela' }).click();
    await expect(page).toHaveURL(/[?&]view=table/);
    await expect(page.getByRole('table', { name: 'Registro de riscos' })).toBeVisible({
      timeout: 15_000,
    });
    const searchLabel = 'Buscar por código, título ou descrição';
    await page.getByLabel(searchLabel).fill(uniqueSuffix);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${uniqueSuffix}`), { timeout: 5_000 });
    const registerUrl = page.url();

    const rowLink = page.getByRole('link', { name: title });
    await expect(rowLink).toBeVisible();
    await rowLink.click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await openRiskDetailSection(page, 'causes-consequences');
    await expect(riskDetailSectionPanel(page, 'causes-consequences')).toBeVisible();
    await openRiskDetailSection(page, 'assessment');
    await expect(riskDetailSectionPanel(page, 'assessment')).toBeVisible();
    await openRiskDetailSection(page, 'treatment');
    await expect(riskDetailSectionPanel(page, 'treatment')).toBeVisible();
    await openRiskDetailSection(page, 'history');
    await expect(riskDetailSectionPanel(page, 'history')).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(registerUrl);
    await expect(page.getByLabel(searchLabel)).toHaveValue(uniqueSuffix);
    await expect(page.getByRole('link', { name: title })).toBeVisible();
  });

  test('the edit panel opens, saves, and returns focus to the "Editar" trigger on close', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    const title = await createFixtureRisk(page, 'editar-painel');
    const editedTitle = `${title} (editado)`;

    await expect(riskDetailSectionPanel(page, 'overview')).toBeVisible();

    const editTrigger = page.getByRole('button', { name: 'Editar' });
    await editTrigger.click();

    const sheet = page.getByRole('dialog', { name: 'Editar risco' });
    await expect(sheet).toBeVisible();

    await sheet.getByLabel('Título').fill(editedTitle);
    await sheet.getByRole('button', { name: 'Salvar' }).click();

    await expect(sheet).toBeHidden();
    await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();
    await expect(editTrigger).toBeFocused();
  });

  test('a caller without audit:view never sees the Auditoria leaf, including via a stale deep link', async ({
    page,
  }) => {
    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco RBAC navegação E2E ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Descrição').fill('Risco do E2E que verifica a omissão de Auditoria.');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const riskDetailUrl = page.url();

    await openRiskDetailSection(page, 'history');
    await expect(
      riskDetailLeafTablist(page, 'register')!.getByRole('tab', { name: 'Auditoria' }),
    ).toHaveCount(0);

    await gotoRiskDetailSection(page, riskDetailUrl, 'audit');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(riskDetailSectionPanel(page, 'overview')).toBeVisible();
    await expect(
      riskDetailGroupTablist(page).getByRole('tab', { name: 'Visão geral', exact: true }),
    ).toHaveAttribute('data-state', 'active');
  });
});
