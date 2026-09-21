import { expect, test } from '@playwright/test';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signOut,
} from './support/admin-session';
import { openRiskDetailSection, riskDetailSectionPanel } from './support/risk-detail-sections';

/**
 * T152 — E2E: an analyst requests acceptance and a second user approves it
 * (US6, FR-029/FR-029a-d, FR-079 to FR-085, ADR-006).
 *
 * Runs against a real backend (`apps/api`), seeded per
 * `apps/api/prisma/seed/platform.seed.ts` with `SEED_DEV_FIXTURES=true` —
 * both `fixture-risk-analyst@pharosgrc.local` (first sign-in) and
 * `fixture-risk-approver@pharosgrc.local` (second sign-in, see below) —
 * exactly like `risk-treatment.spec.ts` already relies on that seed's
 * `FIXTURE-CONTROL-1` row. Skips itself with a clear reason when
 * `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are not set, like every other
 * spec in this directory.
 *
 * ## The SECOND user is the real seeded "Risk Approver" fixture (F-15 fix)
 *
 * This used to be impossible, and was worked around with the Platform
 * Administrator instead — documented at length here at the time
 * (`docs/deferred-findings.md` F-15). `seedDevFixtures`
 * (`apps/api/prisma/seed/platform.seed.ts`) round-robinned its fixture
 * users across four org units; by that indexing, "Risk Analyst" and "Risk
 * Approver" landed on SIBLING units with disjoint `ScopeResolverService`
 * visibility — no `orgUnitId` either could see a risk under together, so
 * the two named role fixtures could never be used together through the
 * real UI. F-15's fix changed exactly that: `seedDevFixtures` now carves
 * out `SHARED_ANALYST_APPROVER_UNIT_ROLE_NAMES` and places BOTH "Risk
 * Analyst" and "Risk Approver" on the SAME unit (`DIV-A-TEAM-1`) instead of
 * following the generic round-robin, specifically so this scenario is
 * administrable — every other fixture role keeps the round-robin
 * unaffected. This spec is that fix's own consumer: a seed correction
 * nobody exercises is intention, not capability.
 *
 * The Analyst and the Approver still have genuinely disjoint PERMISSION
 * sets (the Analyst holds `risk:transition` but not `risk:approve`; the
 * Approver holds `risk:approve` but not `risk:transition`) — segregation of
 * duties by permission, now exercised by the actual named pair the product
 * ships, not a substitute.
 *
 * ## Assessment matrix cells
 *
 * Reuses the exact same seeded default 5×5 methodology cells already
 * verified by `risk-assessment.spec.ts` (T119) — inherent
 * Quase certo × Catastrófico (25, Crítico), residual Raro × Insignificante
 * (1, Baixo). The specific levels reached are irrelevant to this scenario
 * (acceptance is not gated on any particular level); reusing already-proven
 * cell labels avoids inventing new ones this spec would have to verify
 * itself.
 */
test.describe('An analyst requests acceptance and a second user approves it (US6)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real approval journey.',
  );

  test('requests acceptance as the analyst and approves it as a different, eligible user', async ({
    page,
  }) => {
    // T165 finding: this flow (two sign-ins, a full draft-to-acceptance
    // journey) was measured running consistently at ~30.2s against the
    // default 30s test timeout on this machine — right at the boundary
    // even before T165 touched `signOut` (`support/admin-session.ts`),
    // which this spec depends on. 60s leaves real headroom rather than
    // this test's pass/fail turning on incidental system load.
    test.setTimeout(60_000);

    // --- First user: the Risk Analyst creates and prepares the risk --------
    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);

    const uniqueSuffix = Date.now().toString(36);
    const title = `Risco para aprovação E2E ${uniqueSuffix}`;

    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência criado pelo E2E de aprovação (T152).');
    // FR-055 requires a category, in addition to title/description/org
    // unit/owner, to ever leave DRAFT (`findDraftCompletenessGaps`) — the
    // other E2E specs never select one because none of them attempt a
    // lifecycle transition; this one does, so it must. `.nth(1)`, not
    // `.first()`: the category select's own first option is the "Selecione
    // uma categoria" placeholder value (`NONE_SELECT_VALUE`), not a real
    // category — unlike the required org-unit/owner selects below, which
    // carry no such placeholder item.
    await page.getByRole('combobox', { name: /Categoria/ }).click();
    await page.getByRole('option').nth(1).click();
    // The Analyst's own org-unit scope (`DIV-A-TEAM-1`) leaves exactly one
    // option here — see this file's own doc comment above.
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    // Scoped to `<header>` (EntityHeader's own element), not a bare
    // page-wide `getByText`: 016-risk-detail-experience's lifecycle spine
    // (`RiskLifecycleSpineView`) renders every main-spine position's label
    // ALWAYS, including whichever one is currently the risk's own status —
    // so once the badge and the spine's "current" node agree (which they
    // always do, by construction), an unscoped exact-text query for the
    // CURRENT status is a real 2-element strict-mode collision (spot-checked
    // directly, 2026-09-16). The spine lives in the page's main content,
    // never inside the header, so this scoping is what survives every
    // status this test transitions through, not just this first one.
    const statusBadge = page.locator('header');
    await expect(statusBadge.getByText('Rascunho', { exact: true })).toBeVisible();

    // --- DRAFT -> IDENTIFIED (T160's action bar, immediate — risk:edit) ----
    await page.getByRole('button', { name: 'Aplicar: Identificado' }).click();
    await expect(
      page.getByRole('heading', { name: 'Aplicar transição para "Identificado"' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar transição' }).click();
    await expect(statusBadge.getByText('Identificado', { exact: true })).toBeVisible();

    // --- Record an assessment (US4, precondition for -> ASSESSED) ----------
    // 016-risk-detail-experience: "Avaliação" is now a level-2 leaf of the
    // "Análise" group — `openRiskDetailSection` clicks both levels.
    await openRiskDetailSection(page, 'assessment');
    await expect(page.getByText('Este risco ainda não foi avaliado')).toBeVisible();
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
    await page
      .getByLabel('Justificativa')
      .fill('Avaliação registrada para permitir a transição de status (T152).');
    await page.getByRole('button', { name: 'Registrar avaliação' }).click();
    // Scoped to the "Avaliação" tabpanel, not a bare page-wide `getByText`:
    // once a risk carries an inherent/residual level, `EntityHeader` shows
    // the SAME "Inerente: …"/"Residual: …" text as a subtle badge (visible
    // regardless of which tab is active), so an unscoped locator is a real
    // strict-mode collision here — reproduced directly in CI (F-33,
    // docs/deferred-findings.md) the first time this suite ran end to end.
    const assessmentPanel = riskDetailSectionPanel(page, 'assessment');
    await expect(assessmentPanel.getByText('Inerente: Crítico')).toBeVisible();
    await expect(assessmentPanel.getByText('Residual: Baixo')).toBeVisible();

    // Back to a tab with no "Justificativa" field of its own,
    // before opening the next transition dialog — not required for
    // correctness (Radix marks the rest of the page `aria-hidden` while a
    // dialog is open, so the assessment form's own field would already be
    // excluded from accessible-name queries), but avoids relying on that.
    await openRiskDetailSection(page, 'overview');

    // --- IDENTIFIED -> ASSESSED (immediate — risk:assess) -------------------
    await page.getByRole('button', { name: 'Aplicar: Avaliado' }).click();
    await page.getByRole('button', { name: 'Confirmar transição' }).click();
    await expect(statusBadge.getByText('Avaliado', { exact: true })).toBeVisible();

    // --- Request acceptance (approval-gated — risk:transition only) --------
    await page.getByRole('button', { name: 'Solicitar aprovação: Aceito' }).click();
    await expect(
      page.getByRole('heading', { name: 'Solicitar aprovação para "Aceito"' }),
    ).toBeVisible();
    await page
      .getByLabel('Justificativa', { exact: true })
      .fill('Risco residual dentro do apetite aprovado; solicito o aceite (T152).');
    await page.getByRole('button', { name: 'Solicitar aprovação' }).click();

    // The risk stays in ASSESSED (FR-029c — a pending condition, not a
    // state) and now carries the pending-approval indicator (T162).
    await expect(statusBadge.getByText('Avaliado', { exact: true })).toBeVisible();
    await expect(page.getByText('Aguardando aprovação')).toBeVisible();
    await expect(page.getByText(/Solicitado por Fixture — Risk Analyst/)).toBeVisible();
    // Analyst does not hold `risk:approve` — the decide controls are never
    // offered, regardless of who requested (FR-029a's own UI rule).
    await expect(page.getByRole('button', { name: 'Aprovar' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Rejeitar' })).not.toBeVisible();

    const riskUrl = page.url();

    // --- Second user: the real seeded Risk Approver decides (F-15 fix) -----
    // A genuinely different signed-in identity — see this file's own header
    // comment for why this is now the named "Risk Approver" fixture rather
    // than the Platform Administrator substitute this spec used before.
    // `/login` redirects an already-authenticated session straight to
    // `/dashboard`, so the Analyst is signed out explicitly first — a real
    // sign-out-then-sign-in on the same `page`, not a client-side transition
    // carrying over the Analyst's session.
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

    // The Approver is not the requester and holds `risk:approve` — the
    // decide controls ARE offered here (FR-029a's other half).
    await page.getByRole('button', { name: 'Aprovar' }).click();
    // Scoped to the open dialog: the requester's name legitimately appears
    // several times at once on this screen for different reasons (the
    // risk's own "Gestor" metadata and Overview field, the lifecycle card's
    // own pending-approval summary, AND this dialog's own description) —
    // three distinct, correctly-labeled contexts, not a naming defect
    // (under-specified locator, fixed HERE with `getByRole('dialog')`
    // scoping, per CLAUDE.md's accessible-name-collision warning — never by
    // renaming any of the three).
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

    // The gated transition was applied (FR-029c) and the pending condition
    // cleared — durable state, not the transient success toast.
    await expect(statusBadge.getByText('Aceito', { exact: true })).toBeVisible();
    await expect(page.getByText('Aguardando aprovação')).toHaveCount(0);
  });
});
