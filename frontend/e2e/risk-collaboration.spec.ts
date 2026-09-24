import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  signInAsWorkerAdmin,
  workerAdminFullName,
} from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection, riskDetailSectionPanel } from './support/risk-detail-sections';

test.describe('Comment on and attach evidence to a risk (US9)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real collaboration journey.',
  );

  test('adds and withdraws a comment, uploads valid evidence, and is refused a mislabelled file', async ({
    page,
  }, testInfo) => {
    test.setTimeout(45_000);

    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para colaboração E2E ${uniqueSuffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência criado pelo E2E de colaboração (T186).');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await openRiskDetailSection(page, 'comments');
    await expect(page.getByText('Nenhum comentário registrado ainda.')).toBeVisible();

    const commentBody = `Observação registrada via E2E (${uniqueSuffix}).`;
    await page.getByLabel('Novo comentário').fill(commentBody);
    await page.getByRole('button', { name: 'Comentar' }).click();

    await expect(page.getByText(commentBody)).toBeVisible();
    await expect(page.getByText(workerAdminFullName(testInfo)).first()).toBeVisible();

    await page.getByRole('button', { name: 'Remover' }).click();
    await expect(page.getByText('Remover comentário?')).toBeVisible();
    await expect(page.getByText(/continua registrado na trilha de auditoria/)).toBeVisible();
    await page.getByRole('button', { name: 'Remover' }).click();

    await expect(page.getByText(commentBody)).toHaveCount(0);
    await expect(page.getByText('Nenhum comentário registrado ainda.')).toBeVisible();

    await openRiskDetailSection(page, 'attachments');
    const attachmentsPanel = riskDetailSectionPanel(page, 'attachments');
    await expect(attachmentsPanel.getByText('Nenhum anexo enviado ainda.')).toBeVisible();
    await expect(
      attachmentsPanel.getByText(/PDF, PNG, JPEG ou texto simples.*25 MB/),
    ).toBeVisible();

    const fileInput = page.getByLabel('Selecionar arquivo');
    await fileInput.setInputFiles({
      name: 'evidencia.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%evidência real de teste E2E (T186)\n'),
    });
    await page.getByRole('button', { name: 'Enviar arquivo' }).click();

    const uploadedLink = attachmentsPanel.getByRole('link', { name: /evidencia\.pdf/ });
    await expect(uploadedLink).toBeVisible();
    const contentHref = await uploadedLink.getAttribute('href');
    expect(contentHref).toMatch(/^\/api\/v1\/attachments\/[0-9a-fA-F-]+\/content$/);

    await fileInput.setInputFiles({
      name: 'falsificado.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('isto não é um PDF de verdade — apenas texto simples renomeado.'),
    });
    await page.getByRole('button', { name: 'Enviar arquivo' }).click();

    await expect(
      attachmentsPanel.getByText('O conteúdo do arquivo não corresponde ao tipo declarado.'),
    ).toBeVisible();
    await expect(attachmentsPanel.getByRole('link', { name: /falsificado\.pdf/ })).toHaveCount(0);
    await expect(uploadedLink).toBeVisible();

    await attachmentsPanel.getByRole('button', { name: 'Remover' }).click();
    await expect(page.getByText('Remover anexo?')).toBeVisible();
    await expect(page.getByText(/evidencia\.pdf.*não é apagado/)).toBeVisible();
    await page.getByRole('button', { name: 'Remover' }).click();

    await expect(attachmentsPanel.getByRole('link', { name: /evidencia\.pdf/ })).toHaveCount(0);
    await expect(attachmentsPanel.getByText('Nenhum anexo enviado ainda.')).toBeVisible();
  });
});
