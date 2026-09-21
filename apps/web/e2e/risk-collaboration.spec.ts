import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  signInAsWorkerAdmin,
  workerAdminFullName,
} from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection, riskDetailSectionPanel } from './support/risk-detail-sections';

/**
 * T186 — E2E: comment on and attach evidence to a risk (US9, FR-095 to
 * FR-100, FR-102, US9 AS3, US9 AS4).
 *
 * Runs against a real backend (`apps/api`), seeded per
 * `apps/api/prisma/seed/platform.seed.ts`. Skips itself with a clear reason
 * when `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are not set, exactly like
 * every other spec in this directory. Signs in via `signInAsWorkerAdmin`
 * (F-16, `docs/deferred-findings.md`) — a worker-private account, not the
 * single shared seeded administrator every spec used to race over under
 * concurrent workers.
 *
 * ## Files are built in-memory, never read from disk
 *
 * `page.setInputFiles` accepts a `{ name, mimeType, buffer }` triple
 * directly — no fixture file on disk is needed. The VALID upload's buffer
 * genuinely starts with the PDF magic bytes (`%PDF-`) and is declared as
 * `application/pdf`, so the server's magic-byte sniffing
 * (`magic-bytes.ts`) agrees with the declared type and accepts it — this is
 * the "genuinely valid small file whose bytes match its declared type" the
 * task requires, not merely a `.pdf`-named file. The REJECTED upload is the
 * opposite: plain ASCII text declared as `application/pdf` — the server
 * sniffs `text/plain` from the actual bytes, disagrees with the declared
 * `application/pdf`, and refuses with `422` before anything is stored
 * (FR-097, US9 AS3) — this is a deliberate, user-facing feature (a
 * mislabelled file is caught), not an incidental error case, so this spec
 * asserts the exact server-authored pt-BR refusal reason surfaces verbatim,
 * not a generic failure message.
 */
test.describe('Comment on and attach evidence to a risk (US9)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real collaboration journey.',
  );

  test('adds and withdraws a comment, uploads valid evidence, and is refused a mislabelled file', async ({
    page,
  }, testInfo) => {
    test.setTimeout(45_000);

    await signInAsWorkerAdmin(page, testInfo);

    // --- Create a fixture risk to collaborate on ---------------------------
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

    // -----------------------------------------------------------------------
    // Comments (FR-095, FR-098, FR-100, FR-102)
    // -----------------------------------------------------------------------
    // 016-risk-detail-experience: "Comentários" is now a level-2 leaf of the
    // "Registro" group — `openRiskDetailSection` clicks both levels.
    await openRiskDetailSection(page, 'comments');
    await expect(page.getByText('Nenhum comentário registrado ainda.')).toBeVisible();

    const commentBody = `Observação registrada via E2E (${uniqueSuffix}).`;
    await page.getByLabel('Novo comentário').fill(commentBody);
    await page.getByRole('button', { name: 'Comentar' }).click();

    await expect(page.getByText(commentBody)).toBeVisible();
    await expect(page.getByText(workerAdminFullName(testInfo)).first()).toBeVisible();

    // Withdrawing is confirmed before it happens, and states plainly that
    // the comment is retained in the audit trail, not erased (FR-102).
    await page.getByRole('button', { name: 'Remover' }).click();
    await expect(page.getByText('Remover comentário?')).toBeVisible();
    await expect(page.getByText(/continua registrado na trilha de auditoria/)).toBeVisible();
    // Radix marks the rest of the page inert while the dialog is open, so
    // this is now the ONE remaining "Remover" match — the dialog's own
    // confirm button.
    await page.getByRole('button', { name: 'Remover' }).click();

    await expect(page.getByText(commentBody)).toHaveCount(0);
    await expect(page.getByText('Nenhum comentário registrado ainda.')).toBeVisible();

    // -----------------------------------------------------------------------
    // Attachments (FR-096 to FR-100, FR-102, US9 AS3, US9 AS4)
    // -----------------------------------------------------------------------
    // "Anexos" is also a level-2 leaf of "Registro" — same group as
    // "Comentários" above, so only the leaf click is needed this time.
    await openRiskDetailSection(page, 'attachments');
    // Scoped to the tabpanel, not the bare page: a refusal's message is
    // shown BOTH as a persistent inline error inside this panel AND as a
    // transient `sonner` toast in the corner (`feedback.error`) — two
    // legitimately different pieces of UI carrying the same text, not a
    // naming collision to fix in the component.
    const attachmentsPanel = riskDetailSectionPanel(page, 'attachments');
    await expect(attachmentsPanel.getByText('Nenhum anexo enviado ainda.')).toBeVisible();
    // The allow-list and size limit are stated BEFORE any file is chosen —
    // never only after a refusal (US9 AS3).
    await expect(
      attachmentsPanel.getByText(/PDF, PNG, JPEG ou texto simples.*25 MB/),
    ).toBeVisible();

    // --- Valid evidence: declared type agrees with the actual bytes --------
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

    // --- Rejected evidence: a .pdf-named file whose bytes are plain text —
    // the server's magic-byte sniffing catches the mismatch and refuses
    // before anything is stored (FR-097, US9 AS3). The server's own
    // pt-BR refusal reason is surfaced verbatim, never a generic message.
    await fileInput.setInputFiles({
      name: 'falsificado.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('isto não é um PDF de verdade — apenas texto simples renomeado.'),
    });
    await page.getByRole('button', { name: 'Enviar arquivo' }).click();

    await expect(
      attachmentsPanel.getByText('O conteúdo do arquivo não corresponde ao tipo declarado.'),
    ).toBeVisible();
    // Never stored: the mislabelled file never appears in the list.
    await expect(attachmentsPanel.getByRole('link', { name: /falsificado\.pdf/ })).toHaveCount(0);
    // The genuinely valid upload from before is unaffected by the refusal.
    await expect(uploadedLink).toBeVisible();

    // --- Withdrawing the valid attachment is confirmed, and states plainly
    // that it is retained in the audit trail, not erased (FR-102) ----------
    await attachmentsPanel.getByRole('button', { name: 'Remover' }).click();
    await expect(page.getByText('Remover anexo?')).toBeVisible();
    await expect(page.getByText(/evidencia\.pdf.*não é apagado/)).toBeVisible();
    // Radix marks the rest of the page inert while the dialog is open, so
    // this is now the ONE remaining "Remover" match — the dialog's own
    // confirm button.
    await page.getByRole('button', { name: 'Remover' }).click();

    await expect(attachmentsPanel.getByRole('link', { name: /evidencia\.pdf/ })).toHaveCount(0);
    await expect(attachmentsPanel.getByText('Nenhum anexo enviado ainda.')).toBeVisible();
  });
});
