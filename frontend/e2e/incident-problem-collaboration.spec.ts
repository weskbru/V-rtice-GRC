import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { openIncidentDetailSection } from './support/incident-detail-sections';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openProblemDetailSection } from './support/problem-detail-sections';

test.describe.configure({ mode: 'serial' });

test.describe('Comment on, attach a file to, and link evidence to an Incident and a Problem (§19.10)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real collaboration journey.',
  );

  test('Incident: comment, attachment and evidence all persist across a reload', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Incidente para colaboração E2E ${uniqueSuffix}`;

    await page.goto('/incidents/new');
    await expect(page.getByRole('heading', { name: 'Novo incidente' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill(
        'Incidente criado pelo E2E de colaboração (§19.10) para validar comentários, anexos e evidência.',
      );
    await page.getByRole('combobox', { name: 'Severidade' }).click();
    await page.getByRole('option', { name: 'Alta' }).click();
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Registrar incidente' }).click();
    await page.waitForURL(/\/incidents\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    const evidenceTitle = `Evidência do incidente E2E ${uniqueSuffix}`;
    await openIncidentDetailSection(page, 'evidence');
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
      .fill('Prova do que aconteceu, anexada ao incidente (§19.10).');
    await page.getByRole('button', { name: 'Registrar e vincular' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(evidenceTitle)).toBeVisible();

    await openIncidentDetailSection(page, 'attachments');
    const attachmentsPanel = page.getByRole('tabpanel', { name: 'Anexos' });
    await expect(attachmentsPanel.getByText('Nenhum anexo enviado ainda.')).toBeVisible();
    await page.getByLabel('Selecionar arquivo').setInputFiles({
      name: 'evidencia-incidente.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%evidência real de teste E2E (§19.10, incidente)\n'),
    });
    await page.getByRole('button', { name: 'Enviar arquivo' }).click();
    const attachmentLink = attachmentsPanel.getByRole('link', { name: /evidencia-incidente\.pdf/ });
    await expect(attachmentLink).toBeVisible();

    await openIncidentDetailSection(page, 'comments');
    await expect(page.getByText('Nenhum comentário registrado ainda.')).toBeVisible();
    const commentBody = `Investigação registrada via E2E (${uniqueSuffix}, incidente).`;
    await page.getByLabel('Novo comentário').fill(commentBody);
    await page.getByRole('button', { name: 'Comentar' }).click();
    await expect(page.getByText(commentBody)).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await openIncidentDetailSection(page, 'evidence');
    await expect(page.getByText(evidenceTitle)).toBeVisible();

    await openIncidentDetailSection(page, 'attachments');
    await expect(
      page
        .getByRole('tabpanel', { name: 'Anexos' })
        .getByRole('link', { name: /evidencia-incidente\.pdf/ }),
    ).toBeVisible();

    await openIncidentDetailSection(page, 'comments');
    await expect(page.getByText(commentBody)).toBeVisible();
  });

  test('Problem: comment, attachment and evidence all persist across a reload', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Problema para colaboração E2E ${uniqueSuffix}`;

    await page.goto('/problems/new');
    await expect(page.getByRole('heading', { name: 'Novo problema' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill(
        'Problema criado pelo E2E de colaboração (§19.10) para validar comentários, anexos e evidência.',
      );
    await page.getByRole('combobox', { name: 'Severidade' }).click();
    await page.getByRole('option', { name: 'Alta' }).click();
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Registrar problema' }).click();
    await page.waitForURL(/\/problems\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    const evidenceTitle = `Evidência do problema E2E ${uniqueSuffix}`;
    await openProblemDetailSection(page, 'evidence');
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
      .fill('Prova da causa raiz, anexada ao problema (§19.10).');
    await page.getByRole('button', { name: 'Registrar e vincular' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(evidenceTitle)).toBeVisible();

    await openProblemDetailSection(page, 'attachments');
    const attachmentsPanel = page.getByRole('tabpanel', { name: 'Anexos' });
    await expect(attachmentsPanel.getByText('Nenhum anexo enviado ainda.')).toBeVisible();
    await page.getByLabel('Selecionar arquivo').setInputFiles({
      name: 'analise-problema.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%evidência real de teste E2E (§19.10, problema)\n'),
    });
    await page.getByRole('button', { name: 'Enviar arquivo' }).click();
    const attachmentLink = attachmentsPanel.getByRole('link', { name: /analise-problema\.pdf/ });
    await expect(attachmentLink).toBeVisible();

    await openProblemDetailSection(page, 'comments');
    await expect(page.getByText('Nenhum comentário registrado ainda.')).toBeVisible();
    const commentBody = `Causa raiz em análise via E2E (${uniqueSuffix}, problema).`;
    await page.getByLabel('Novo comentário').fill(commentBody);
    await page.getByRole('button', { name: 'Comentar' }).click();
    await expect(page.getByText(commentBody)).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await openProblemDetailSection(page, 'evidence');
    await expect(page.getByText(evidenceTitle)).toBeVisible();

    await openProblemDetailSection(page, 'attachments');
    await expect(
      page
        .getByRole('tabpanel', { name: 'Anexos' })
        .getByRole('link', { name: /analise-problema\.pdf/ }),
    ).toBeVisible();

    await openProblemDetailSection(page, 'comments');
    await expect(page.getByText(commentBody)).toBeVisible();
  });
});
