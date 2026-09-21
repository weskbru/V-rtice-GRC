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

/**
 * T165 — E2E: reconstruct a risk's evolution from the History and Audit
 * tabs (US7, FR-033 to FR-037, FR-105, ADR-006, ADR-007).
 *
 * Runs against a real backend, seeded per
 * `apps/api/prisma/seed/platform.seed.ts` with `SEED_DEV_FIXTURES=true` —
 * same seed dependency as `risk-approval.spec.ts` (T152). Skips itself with
 * a clear reason when `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are not set,
 * like every other spec in this directory.
 *
 * ## Why the second signed-in identity here is the Platform Administrator
 *
 * Same reasoning `risk-approval.spec.ts` already documents at length (F-15,
 * `docs/deferred-findings.md`): the seeded "Risk Analyst" and "Risk
 * Approver" fixtures sit on sibling organizational units with disjoint
 * scope grants, so no two of them can ever act on the same risk through the
 * real UI without a seed change this suite is not authorized to make. The
 * Administrator (`GLOBAL` scope, every permission) is used as the second
 * identity — genuinely different from the Analyst, and the one seeded
 * account that actually holds `audit:view` (the Analyst and Approver both
 * lack it), which this scenario specifically needs to reach the Audit tab.
 *
 * ## What this proves that `risk-approval.spec.ts` does not
 *
 * `risk-approval.spec.ts` exercises the approval JOURNEY itself. This spec
 * exercises the two READ-SIDE views US7 adds on top of that journey:
 *
 *   - **History** (`GET /risks/{riskId}/history`) merges assessments,
 *     lifecycle transitions and approvals into one chronology available to
 *     anyone who can see the risk — deliberately does NOT include the raw
 *     `risk.created` audit row (that is not one of the five entry kinds
 *     `RiskHistoryQueryService` merges).
 *   - **Audit** (`GET /risks/{riskId}/audit-events`) is the raw,
 *     permission-gated trail — INCLUDES `risk.created` and every other raw
 *     audit action, and is hidden entirely from a caller (the Analyst) who
 *     lacks `audit:view`, never merely disabled.
 *
 * Asserting both tabs' CONTENT differs (History omits `risk.created`,
 * Audit shows the raw action names verbatim) is what actually distinguishes
 * "a reviewer's narrative" from "the append-only ledger", which is the
 * entire point of US7 having two tabs rather than one.
 */
test.describe("Reconstructing a risk's evolution from the History and Audit tabs (US7)", () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real History/Audit tabs.',
  );

  test('shows a merged chronology to anyone who can see the risk, and the raw audit trail only to a caller with audit:view', async ({
    page,
  }, testInfo) => {
    // This scenario genuinely does more than the default 30s test timeout
    // budgets for — two full sign-ins plus every US4/US5/US6 step needed to
    // populate a real history (identify, assess, assess-transition,
    // request approval, decide) on top of the History/Audit reconstruction
    // itself and the `type` filter interaction. Measured at ~44s end to
    // end against a freshly started dev server; 60s leaves real headroom
    // rather than chasing a tighter budget this flow cannot honestly meet.
    test.setTimeout(60_000);

    // --- First user: the Risk Analyst creates and evolves the risk --------
    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para histórico E2E ${uniqueSuffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência criado pelo E2E de histórico e auditoria (T165).');
    // FR-055 requires a category to leave DRAFT — see `risk-approval.spec.ts`'s
    // own comment on `.nth(1)` (index 0 is the "Selecione uma categoria"
    // placeholder, not a real option).
    await page.getByRole('combobox', { name: /Categoria/ }).click();
    await page.getByRole('option').nth(1).click();
    // The Analyst's own scope (`DIV-A-TEAM-1`) leaves exactly one option here.
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const riskUrl = page.url();

    // --- Audit tab is not even offered to a caller without audit:view -----
    // Hidden by omission (FR-030) — not rendered disabled, not rendered at
    // all — see `RiskAuditSection`'s own doc comment.
    //
    // 016-risk-detail-experience: "Auditoria" only ever exists as a level-2
    // leaf of the "Registro" group, and Radix does not even MOUNT a group's
    // own leaf tablist until that group is the active one — so this
    // assertion would pass vacuously (the tab is absent because nothing
    // navigated there yet, not because the permission gate omitted it)
    // unless "Registro" is opened first. "Histórico" is always visible
    // (no permission gate), so opening IT lands inside the same "Registro"
    // leaf tablist "Auditoria" would sit in in this exact spot if this
    // caller held `audit:view`.
    await openRiskDetailSection(page, 'history');
    const registerLeafTablistWithoutAudit = riskDetailLeafTablist(page, 'register')!;
    await expect(
      registerLeafTablistWithoutAudit.getByRole('tab', { name: 'Auditoria' }),
    ).toHaveCount(0);

    // --- DRAFT -> IDENTIFIED (immediate — risk:edit) -----------------------
    await page.getByRole('button', { name: 'Aplicar: Identificado' }).click();
    await page.getByRole('button', { name: 'Confirmar transição' }).click();
    // Scoped to `<header>` (EntityHeader's own element), not a bare
    // page-wide `getByText`: 016-risk-detail-experience's lifecycle spine
    // always renders every main-spine position's label, including whichever
    // one is currently the risk's own status — so an unscoped exact-text
    // query for the CURRENT status is a real 2-element strict-mode collision
    // (badge + spine's "current" node, spot-checked directly, 2026-09-16).
    // The spine lives in the page's main content, never inside the header.
    const statusBadge = page.locator('header');
    await expect(statusBadge.getByText('Identificado', { exact: true })).toBeVisible();

    // --- Record an assessment (US4, precondition for -> ASSESSED) ----------
    await openRiskDetailSection(page, 'assessment');
    // 016-risk-detail-experience, Área 2 (2026-09-17): "Registrar nova
    // avaliação" is now a contextual action — `AssessmentForm` itself is
    // unmodified, but `RiskAssessmentSection` no longer mounts it until this
    // reveal is clicked.
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
    // Scoped to the "Avaliação" tabpanel, not a bare page-wide `getByText`:
    // once a risk carries an inherent level, `EntityHeader` shows the SAME
    // "Inerente: …" text as a subtle badge (visible regardless of which tab
    // is active), so an unscoped locator is a real strict-mode collision
    // here — reproduced directly in CI (F-33, docs/deferred-findings.md)
    // the first time this suite ran end to end.
    await expect(
      riskDetailSectionPanel(page, 'assessment').getByText('Inerente: Crítico'),
    ).toBeVisible();
    await openRiskDetailSection(page, 'overview');

    // --- IDENTIFIED -> ASSESSED (immediate — risk:assess) -------------------
    await page.getByRole('button', { name: 'Aplicar: Avaliado' }).click();
    await page.getByRole('button', { name: 'Confirmar transição' }).click();
    await expect(statusBadge.getByText('Avaliado', { exact: true })).toBeVisible();

    // --- Request acceptance (approval-gated — risk:transition only) --------
    await page.getByRole('button', { name: 'Solicitar aprovação: Aceito' }).click();
    await page
      .getByLabel('Justificativa', { exact: true })
      .fill('Risco residual dentro do apetite aprovado; solicito o aceite (T165).');
    await page.getByRole('button', { name: 'Solicitar aprovação' }).click();
    await expect(page.getByText('Aguardando aprovação')).toBeVisible();

    // ---------------------------------------------------------------------
    // History tab, as the Analyst: a merged chronology of everything above
    // — two transitions, one assessment, one approval request — WITHOUT
    // the raw `risk.created` audit row (US7's own distinction).
    // ---------------------------------------------------------------------
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

    // The F-9 recorded-instant vs. asserted-date distinction: the
    // assessment entry carries BOTH "Registrado em" (always present) AND
    // "Data informada" (only on assessments) as two separately labeled
    // facts — never merged into one ambiguous "date".
    const assessmentEntry = historyList
      .getByRole('listitem')
      .filter({ hasText: 'Nova avaliação registrada' });
    await expect(assessmentEntry.getByText('Registrado em')).toBeVisible();
    await expect(assessmentEntry.getByText('Data informada')).toBeVisible();

    // A lifecycle transition entry carries no asserted date at all — only
    // the recorded instant.
    const firstTransitionEntry = historyList
      .getByRole('listitem')
      .filter({ hasText: 'para "Identificado".' });
    await expect(firstTransitionEntry.getByText('Registrado em')).toBeVisible();
    await expect(firstTransitionEntry.getByText('Data informada')).toHaveCount(0);

    // The raw `risk.created` audit action never appears in the merged
    // History — it is not one of the five entry kinds this view merges.
    await expect(historyList.getByText('risk.created')).toHaveCount(0);

    // --- The `type` filter narrows the chronology (T170's own decision) ---
    await page.getByRole('button', { name: 'Tipo de evento' }).click();
    const typeFilterPanel = page.getByRole('group', { name: 'Tipo de evento' });
    await typeFilterPanel.getByRole('checkbox', { name: 'Aprovação' }).check();
    await expect(historyList.getByRole('listitem')).toHaveCount(1);
    await expect(
      historyList.getByText('Aprovação solicitada para a transição para "Aceito".'),
    ).toBeVisible();
    await expect(historyList.getByText(/O risco transicionou/)).toHaveCount(0);
    // Clear the filter back to the full chronology for a clean handoff.
    await typeFilterPanel.getByRole('checkbox', { name: 'Aprovação' }).uncheck();

    // ---------------------------------------------------------------------
    // Second user: the Platform Administrator (holds audit:view) decides
    // the pending approval, then reconstructs the same evolution from BOTH
    // tabs — including the parts only audit:view can see. `signOut` itself
    // waits out a lingering success toast first — see that helper's own
    // doc comment for the environmental hazard this was found to hit.
    // ---------------------------------------------------------------------
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

    // --- History as the Administrator: the same chronology, now including
    // the approval decision and the transition it triggered ---------------
    await openRiskDetailSection(page, 'history');
    const adminHistoryList = page.getByRole('list', { name: 'Histórico do risco' });
    await expect(
      adminHistoryList.getByText('Aprovação concedida — transição para "Aceito" aplicada.'),
    ).toBeVisible();
    await expect(
      adminHistoryList.getByText('O risco transicionou de "Avaliado" para "Aceito".'),
    ).toBeVisible();
    await expect(adminHistoryList.getByText('risk.created')).toHaveCount(0);

    // --- Audit tab: offered to the Administrator (audit:view), and shows
    // the raw, technical trail — including `risk.created`, never merged
    // into the History view above ------------------------------------------
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
    // Every action shown here succeeded — outcome is conveyed as visible
    // text (never colour alone, FR-091).
    await expect(auditList.getByText('Sucesso').first()).toBeVisible();
    // The requester's real name is attributed on the raw trail too, not
    // just in the friendlier History view.
    await expect(auditList.getByText(/Fixture — Risk Analyst/).first()).toBeVisible();

    // ---------------------------------------------------------------------
    // Product owner UAT finding: a changed field on the raw trail must read
    // as a sentence a risk manager understands — a pt-BR field label
    // ("Categoria"), never a database column name ("categoryId"), and a
    // resolved value (the category's own name), never a raw UUID. The
    // regression that matters is specifically inside the before/after diff
    // — `entityId`/`correlationId` are technical identifiers shown verbatim
    // by design (CLAUDE.md §11.1) and are deliberately NOT covered by this
    // assertion.
    // ---------------------------------------------------------------------
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
