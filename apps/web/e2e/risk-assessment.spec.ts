import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  signInAsWorkerAdmin,
  workerAdminFullName,
} from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection, riskDetailSectionPanel } from './support/risk-detail-sections';

/**
 * T119 — E2E: assess a risk, reassess it with different factors, and read
 * the history showing the level change (US4, FR-061 to FR-068, FR-070,
 * ADR-006).
 *
 * Runs against a real backend (`apps/api`), seeded per
 * `apps/api/prisma/seed/platform.seed.ts` and
 * `apps/api/prisma/seed/methodology.seed.ts`, exactly like `auth.spec.ts`
 * and `risk-create.spec.ts` — see `support/admin-session.ts` for the shared
 * sign-in helper. Skips itself with a clear reason when
 * `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are not set.
 *
 * The scale labels used below ("Raro", "Quase certo", "Insignificante",
 * "Catastrófico", ...) and the score/level bands (LOW 1-4, MEDIUM 5-9,
 * HIGH 10-15, CRITICAL 16-25) come straight from the seeded default 5×5
 * methodology (`methodology.seed.ts`) — this spec asserts against the real
 * seeded configuration rather than inventing its own, which is also why it
 * never assumes a 5×5 shape structurally (only these specific seeded label
 * strings), matching how `AssessmentForm` itself builds from whatever the
 * active methodology returns.
 *
 * ## Accessible-name collision note (see CLAUDE.md's warning)
 *
 * `AssessmentForm` renders exactly ONE `RiskMatrix` at a time (a shared grid
 * toggled between "Risco inerente"/"Risco residual" — see the component's
 * own doc comment for why two full separately-labeled tables were
 * deliberately NOT used), so a matrix cell's accessible name
 * ("Probabilidade X, Impacto Y: pontuação N, nível Z") is unique on the page
 * at any one time and `getByRole('button', { name: ... })` never needs
 * `within(...)` scoping here. This was a considered choice, not an oversight
 * left for this spec to work around: an earlier two-matrix design would have
 * produced two same-named buttons (one per basis) simultaneously visible,
 * which is exactly the strict-mode hazard CLAUDE.md warns about — verified
 * directly, not assumed, in `assessment-form.test.tsx`.
 */
test.describe('Assess a risk, reassess it, and read the history (US4)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real assessment journey.',
  );

  test('assesses a risk, reassesses it with different factors, and the history shows the level change with attribution', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);

    // --- Create a fixture risk to assess -----------------------------------
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

    // --- Open the Assessment tab -------------------------------------------
    // 016-risk-detail-experience: "Avaliação" is now a level-2 leaf of the
    // "Análise" group — `openRiskDetailSection` clicks both levels.
    await openRiskDetailSection(page, 'assessment');
    await expect(page.getByText('Este risco ainda não foi avaliado')).toBeVisible();

    // --- First assessment: inherent CRITICAL, residual LOW -----------------
    // 016-risk-detail-experience, Área 2 (2026-09-17): "Registrar nova
    // avaliação" is now a contextual action — `AssessmentForm` itself is
    // unmodified (still renders its full matrix the instant it mounts), but
    // `RiskAssessmentSection` no longer mounts it until this reveal is
    // clicked (`risk-assessment-section.tsx`'s own `showAssessmentForm`).
    await page.getByRole('button', { name: 'Registrar nova avaliação' }).click();
    // Inherent: Quase certo (5) × Catastrófico (5) = 25 → Crítico.
    await page.getByRole('button', { name: 'Risco inerente' }).click();
    await page
      .getByRole('button', {
        name: 'Probabilidade Quase certo, Impacto Catastrófico: pontuação 25, nível Crítico',
      })
      .click();
    // Residual: Raro (1) × Insignificante (1) = 1 → Baixo.
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

    // The durable, meaningful signal is the Assessment section's own
    // content updating — not the transient success toast, which this spec
    // deliberately does not assert on (a second toast from the reassessment
    // below could still be visible when the first is checked, which would
    // make a bare `getByText` on identical toast text a strict-mode
    // collision for no real benefit — see CLAUDE.md's warning).
    //
    // Scoped to the "Avaliação" tabpanel, not a bare page-wide `getByText`:
    // once a risk carries an inherent/residual level, `EntityHeader` shows
    // the SAME "Inerente: …"/"Residual: …" text as a subtle badge (visible
    // regardless of which tab is active), so an unscoped locator is a
    // real strict-mode collision here, not a hypothetical one — reproduced
    // directly in CI (F-33, docs/deferred-findings.md) the first time this
    // suite ran against a real, freshly-seeded backend end to end.
    const assessmentPanel = riskDetailSectionPanel(page, 'assessment');
    await expect(assessmentPanel.getByText('Inerente: Crítico')).toBeVisible();
    await expect(assessmentPanel.getByText('Residual: Baixo')).toBeVisible();

    // --- Reassessment with different factors: residual rises to CRITICAL ---
    // The form auto-collapses back to its trigger on a successful submit
    // (`risk-assessment-section.tsx`'s own `onAssessed` callback) — reveal
    // it again for the second assessment.
    await page.getByRole('button', { name: 'Registrar nova avaliação' }).click();
    // Provável (4) × Maior (4) = 16 → Crítico (an increase from Baixo).
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

    // The current assessment section now reflects the SECOND assessment —
    // residual moved from "Baixo" to "Crítico". Scoped for the same reason
    // as above — the header badge now shows the same text too.
    await expect(assessmentPanel.getByText('Residual: Crítico')).toBeVisible();

    // --- History shows both assessments, newest first, with the level ------
    // change and attribution (FR-066) — nothing was overwritten (ADR-007).
    // The history table's own `<caption>` (sr-only) gives it this accessible
    // name — distinct from the assessment form's matrix caption and the
    // Assessment section's own context-matrix caption, both also `<table>`s
    // on this same tab, so this scoping is required, not optional.
    const historyTable = page.getByRole('table', { name: 'Histórico de avaliações' });
    await expect(historyTable.getByText('Subiu de Baixo para Crítico.')).toBeVisible();
    await expect(
      historyTable.getByText(
        'Primeira avaliação registrada — sem avaliação anterior para comparar.',
      ),
    ).toBeVisible();
    // Both rows attribute to the signed-in administrator.
    await expect(historyTable.getByText(workerAdminFullName(testInfo)).first()).toBeVisible();
    await expect(historyTable.locator('tbody tr')).toHaveCount(2);
  });
});
