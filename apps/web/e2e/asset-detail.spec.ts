import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection } from './support/risk-detail-sections';

/**
 * E2E for the asset detail screen (022-asset-detail-experience) — the first
 * dedicated E2E this screen has of its own Fase A-D shell. Before this
 * rodada, `asset-detail-view.tsx` had no spec of its own: `assets-
 * processes.spec.ts` already proves the create -> find -> edit -> deactivate
 * -> refused link -> reactivate journey (shared with Process, unaffected by
 * this rodada — it stays as the regression proof that those properties
 * still hold), but nothing yet proved `?section=`, the overlay edit panel,
 * or the aside's own honest count.
 *
 * One single-session journey, mirroring `control-detail.spec.ts`'s own
 * choice for the same reason: splitting this into independent tests would
 * mean repeating the whole asset-creation setup per test, and Playwright
 * tests are not guaranteed to run in file order across workers.
 *
 *   1. create an asset (ACTIVE by default — Asset has no DRAFT-like state);
 *   2. `?section=` deep link: valid, invalid (falls back silently), absent
 *      (defaults to Visão geral) — Fase A;
 *   3. the aside's own honest count: "Riscos (0)"/"Controles (0)" (a real,
 *      embedded zero, never hidden) and "Incidentes" with "Ver" (never a
 *      fabricated number) — Fase C;
 *   4. the overlay edit panel: opens, `Escape` closes it and returns focus
 *      to "Editar", the page (Situação card included) stays readable behind
 *      it, and "Cancelar" ALSO closes it without navigating away (the exact
 *      shape F-79 found missing in `ControlForm` — proven here so it never
 *      regresses, applied preemptively rather than discovered live) — Fase C;
 *   5. the real edit persists through the overlay;
 *   6. a REAL link, created through the Risk module's own contract (never
 *      this screen, which has no write path — FR-008), makes the aside's
 *      own "Riscos" count go from an honest zero to an honest one — proving
 *      the asymmetry is genuinely read from the payload, not hardcoded.
 *
 * `assets-processes.spec.ts` already proves activate/deactivate and the
 * edit form's own validation; this spec does not repeat those.
 */
test.describe('Ativo — detail: seções, overlay de edição, aside (022-asset-detail-experience)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real asset detail journey.',
  );

  test('creates an asset, deep-links every section, shows the aside’s own honest zero, edits it in an overlay (Escape and Cancelar both close it without leaving the page), and a real risk link turns the zero into a real count', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    await signInAsWorkerAdmin(page, testInfo);

    const suffix = Date.now().toString(36);
    const assetName = `Ativo E2E ${suffix}`;
    const description = 'Ativo criado pelo E2E de 022-asset-detail-experience.';

    // --- 1. Create the asset ------------------------------------------------
    await page.goto('/assets/new');
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    await page.getByLabel('Nome').fill(assetName);
    await page.getByLabel('Descrição').fill(description);
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Cadastrar ativo' }).click();
    await page.waitForURL(/\/assets\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: assetName, exact: true })).toBeVisible();

    const assetUrl = page.url();

    // --- 2. `?section=` deep link: valid, invalid, absent (Fase A) --------
    await page.goto(`${assetUrl}?section=controls`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: 'Controles', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Nenhum controle vinculado a este ativo.')).toBeVisible();

    // An id naming no visible section resolves silently to the first visible
    // one — never an error, never nothing selected.
    await page.goto(`${assetUrl}?section=nao-existe`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: 'Visão geral', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Descrição', { exact: true }).first()).toBeVisible();

    // No `?section=` at all — same default.
    await page.goto(assetUrl, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: 'Visão geral', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Descrição', { exact: true }).first()).toBeVisible();

    // --- 3. The aside's own honest asymmetry (Fase C) ----------------------
    // A freshly created asset has zero risks/controls — the aside shows the
    // REAL zero (never omitted, never hidden), and "Incidentes" carries "Ver"
    // because it is not embedded in this payload at all.
    const aside = page.getByRole('complementary', { name: 'Contexto do ativo' });
    await expect(aside.getByRole('link', { name: 'Riscos (0)' })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Controles (0)' })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Incidentes Ver' })).toBeVisible();

    // --- 4. Overlay edit: opens; Escape closes it and returns focus to
    //        "Editar"; the page (Situação card included) stays readable
    //        behind it (Fase C) --------------------------------------------
    const editButton = page.getByRole('button', { name: 'Editar' });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Two elements share the accessible name "Editar ativo" inside the
    // dialog — the sr-only `SheetTitle` (`asset-edit-panel.tsx`'s own
    // "second visible title would repeat it" choice) and `DetailPanel`'s
    // own visible header, which is ALSO a `complementary` landmark (its own
    // `<aside aria-label>`). Asserting the LANDMARK, not a bare heading
    // query, is what disambiguates them — the same "same name, different
    // role" distinction this whole rodada's own aside/quick-action links
    // rely on.
    await expect(page.getByRole('complementary', { name: 'Editar ativo' })).toBeVisible();
    // `showCloseButton={false}` (measured, Fase C — `AssetForm` fits without
    // scrolling at every supported width) — no icon-only "Fechar" here,
    // unlike Control's own overlay.
    await expect(page.getByRole('button', { name: 'Fechar' })).toHaveCount(0);
    await expect(page.getByText('Situação atual do ativo')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(editButton).toBeFocused();
    await expect(page).toHaveURL(assetUrl);

    // --- 5. "Cancelar" closes the overlay WITHOUT navigating away — the
    //        exact regression class F-79 found in `ControlForm`, applied
    //        here preemptively -------------------------------------------
    await editButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(assetUrl);
    await expect(page.getByRole('heading', { name: assetName, exact: true })).toBeVisible();

    // --- 6. The real edit persists through the overlay ---------------------
    const updatedDescription = `${description} Editado pelo E2E.`;
    await editButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Descrição').fill(updatedDescription);
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(updatedDescription)).toBeVisible();

    // --- 7. A REAL link, created through the Risk module's own contract
    //        (never this screen — FR-008), turns the aside's own "Riscos"
    //        count from an honest zero into a real one ---------------------
    const riskTitle = `Risco para aside E2E ${suffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco criado para provar a contagem real do aside do ativo (022).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: 'PharosGRC', exact: true }).click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();

    await openRiskDetailSection(page, 'processes-assets');
    await page.getByRole('combobox', { name: 'Selecionar ativo' }).click();
    await page.getByPlaceholder('Buscar ativo por nome ou código').fill(assetName);
    const assetOption = page.getByRole('option').filter({ hasText: assetName });
    await expect(assetOption).toBeVisible({ timeout: 10_000 });
    await assetOption.click();
    await page.getByRole('button', { name: 'Vincular ativo', exact: true }).click();
    await expect(page.getByText('Ativo vinculado.')).toBeVisible();

    await page.goto(assetUrl, { waitUntil: 'networkidle' });
    await expect(aside.getByRole('link', { name: 'Riscos (1)' })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Controles (0)' })).toBeVisible();
  });
});
