import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';

/**
 * E2E for the control detail screen (021-control-detail-experience) — the
 * first dedicated E2E this screen has ever had. Before this rodada,
 * `control-detail-view.tsx` had zero E2E coverage of its own; the unit
 * suites mock the API on both sides and cannot prove a real journey through
 * a real backend.
 *
 * One long, single-session journey (mirrors `action-plan.spec.ts`'s own
 * choice, for the same reason: splitting this into independent tests would
 * mean either repeating the whole control-creation setup per test or
 * sharing state between tests, and Playwright tests are not guaranteed to
 * run in file order across workers). Everything this rodada actually
 * changed gets proven against a real server, in the order a real user would
 * hit it:
 *
 *   1. create a control (DRAFT, no owner — deliberately, to exercise the
 *      HAS_OWNER pendency below);
 *   2. `?section=` deep link: valid, invalid (falls back silently), absent
 *      (defaults to Visão geral) — Fase A;
 *   3. the overlay edit panel: opens, `Escape` closes it and returns focus
 *      to "Editar", the page (Ciclo de vida included) stays readable behind
 *      it — Fase C;
 *   4. **F-79**: "Cancelar" inside the overlay closes it WITHOUT navigating
 *      away from `/controls/{id}` — the exact regression this rodada found
 *      and fixed;
 *   5. the lifecycle card: DRAFT -> ACTIVE is offered but DISABLED with its
 *      own pendency bullet while unowned; saving an owner through the
 *      overlay clears the pendency; the transition then succeeds and the
 *      track updates — Fase B;
 *   6. registering a verification once the control is ACTIVE (server-
 *      enforced, `assertControlAcceptsNewAssessment`) — unchanged by this
 *      rodada, still proven end-to-end;
 *   7. the Vínculos picker behind its own intent button — Fase D;
 *   8. Evidências stays reachable as a fourth section.
 *
 * ## Why a control is created here rather than reused
 *
 * This local database's own seeded controls (`CTL-2026-0001` onward) are
 * all `DRAFT` with no owner and no assessment history (measured during this
 * same rodada's Fase B/D rendered verification) — convenient for some
 * assertions but not enough on their own: this journey needs to drive a
 * REAL transition into `ACTIVE` and back out through a fresh assessment,
 * which would permanently alter a shared seeded record with no way to
 * revert it (`docs/local-environment.md`'s own discipline against leaving
 * fixture debris). A control created by this test, in this test's own run,
 * is the only record whose lifecycle this spec is free to move.
 */
test.describe('Controle — detail: seções, overlay de edição, ciclo de vida (021-control-detail-experience)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real control detail journey.',
  );

  test('creates a control, deep-links every section, edits it in an overlay (Escape and Cancelar both close it without leaving the page — F-79), clears a lifecycle pendency and transitions to Ativo, registers a verification, and links/unlinks a process behind the gated picker', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    await signInAsWorkerAdmin(page, testInfo);

    const suffix = Date.now().toString(36);
    const controlName = `Controle E2E ${suffix}`;

    // --- 1. Create the control — DRAFT, no owner --------------------------
    await page.goto('/controls/new');
    await expect(page.getByRole('heading', { name: 'Novo controle' })).toBeVisible();
    await page.getByLabel('Nome').fill(controlName);
    await page
      .getByLabel('Descrição')
      .fill('Controle criado pelo E2E de 021-control-detail-experience.');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Cadastrar controle' }).click();
    await page.waitForURL(/\/controls\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: controlName, exact: true })).toBeVisible();

    const controlUrl = page.url();

    // --- 2. Visão geral: the three cards, honestly empty where nothing is
    //        set yet ------------------------------------------------------
    await expect(page.getByText('Rascunho', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Não avaliado', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Nenhuma verificação atestada até o momento.')).toBeVisible();

    // DRAFT -> ACTIVE is offered (control:edit) but DISABLED with its own
    // pendency bullet — the control has no owner yet (HAS_OWNER, D-6). The
    // real, server-computed reason a caller cannot yet act, not a disabled
    // control with no explanation.
    await expect(page.getByRole('button', { name: 'Aplicar: Ativo' })).toBeDisabled();
    await expect(
      page.getByText('O controle precisa ter um dono definido para entrar em operação.'),
    ).toBeVisible();

    // --- 3. `?section=` deep link: valid, invalid, absent (Fase A) --------
    // `CardTitle` (`@/components/ui/card`) is a plain `<div>`, never a
    // heading element (`problem-relationships-section.tsx`'s own doc
    // comment on why) — every assertion against a card's own title below
    // reads it as text, not as `role: 'heading'`.
    await page.goto(`${controlUrl}?section=assessments`, { waitUntil: 'networkidle' });
    await expect(page.getByText('Registrar verificação', { exact: true }).first()).toBeVisible();
    // The server refuses new assessments on a non-ACTIVE control — the
    // proactive notice is visible before the caller ever tries and gets
    // refused (CLAUDE.md §18.11), unchanged by this rodada.
    await expect(
      page.getByText(
        'Este controle não está ativo — apenas controles ativos aceitam novas verificações.',
      ),
    ).toBeVisible();

    // An id naming no visible section resolves silently to the first
    // visible one — never an error, never nothing selected.
    await page.goto(`${controlUrl}?section=nao-existe`, { waitUntil: 'networkidle' });
    await expect(page.getByText('Descrição', { exact: true }).first()).toBeVisible();

    // No `?section=` at all — same default.
    await page.goto(controlUrl, { waitUntil: 'networkidle' });
    await expect(page.getByText('Descrição', { exact: true }).first()).toBeVisible();

    // --- 4. Overlay edit: opens; Escape closes it and returns focus to
    //        "Editar"; the page stays readable behind it (Fase C) ---------
    const editButton = page.getByRole('button', { name: 'Editar' });
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Altere os dados cadastrais do controle.')).toBeVisible();
    // The Sheet keeps its default close button here (unlike Action's own
    // panel) — `ControlForm` has its own "Cancelar", but neither one was
    // reachable without scrolling before this rodada measured it, so the
    // `X` stays as the one affordance guaranteed visible on open.
    await expect(page.getByRole('button', { name: 'Fechar' })).toBeVisible();
    await expect(page.getByText('Ciclo de vida')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(editButton).toBeFocused();
    await expect(page).toHaveURL(controlUrl);

    // --- 5. F-79: "Cancelar" closes the overlay WITHOUT navigating away —
    //        the exact regression this rodada found and fixed ------------
    await editButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(controlUrl);
    await expect(page.getByRole('heading', { name: controlName, exact: true })).toBeVisible();

    // --- 6. The real edit: give the control an owner, through the overlay,
    //        persists ------------------------------------------------------
    await editButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Responsável pelo controle' }).click();
    const firstOwnerOption = page.getByRole('option').first();
    await firstOwnerOption.waitFor({ state: 'visible', timeout: 10_000 });
    // `.innerText()`, not `.textContent()`: the option renders the user's
    // name and e-mail as separate block-level lines with no whitespace
    // character between them in the DOM's own text flow — `textContent()`
    // glues them into one unbroken string ("NomeSobrenomeemail@..."),
    // which never matches anything actually painted on screen.
    // `innerText()` respects the rendered line break, so splitting on `\n`
    // and keeping the first line is the user's own display name, exactly
    // as `ControlDetail.owner.fullName` renders it after saving.
    const ownerName = (await firstOwnerOption.innerText()).split('\n')[0]?.trim() ?? '';
    await firstOwnerOption.click();
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(dialog).toBeHidden();
    // Positive assertion, never a blanket "Não definido" is gone" — Natureza
    // and Tipo were deliberately left unset at creation (step 1) and still
    // honestly read "Não definido" in the same "Detalhes do controle" card;
    // only Responsável changed.
    if (ownerName) {
      await expect(page.getByText(ownerName, { exact: false }).first()).toBeVisible();
    }

    // --- 7. Lifecycle: the HAS_OWNER pendency from step 2 is gone now that
    //        an owner is set; apply the transition and watch the track
    //        update (Fase B). "Aplicar: Descontinuado"'s OWN pendency
    //        (HAS_JUSTIFICATION, always unmet in this preview per
    //        `GetControlLifecycleUseCase`'s own documented contract) is
    //        untouched and still shown — this assertion is scoped to the
    //        specific HAS_OWNER sentence, never a blanket "no pendency
    //        text anywhere", which would be false the moment a second
    //        transition's own honest pendency exists on the same card. ---
    const applyActive = page.getByRole('button', { name: 'Aplicar: Ativo' });
    await expect(applyActive).toBeEnabled();
    await expect(
      page.getByText('O controle precisa ter um dono definido para entrar em operação.'),
    ).toHaveCount(0);

    await applyActive.click();
    const transitionDialog = page.getByRole('dialog');
    await expect(
      transitionDialog.getByRole('heading', { name: 'Aplicar transição: Ativo' }),
    ).toBeVisible();
    await transitionDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(transitionDialog).toBeHidden();

    await expect(page.getByText('Ativo', { exact: true }).first()).toBeVisible();
    // `ControlLifecycleTrackView` renders BOTH the below-`sm` vertical
    // layout and the `sm`+ horizontal one in the DOM at once, toggled with
    // responsive `hidden` classes rather than conditionally mounted (its
    // own doc comment) — an unscoped `getByText(...).first()` at a wide
    // viewport can resolve to the OTHER copy's own (CSS-hidden) node, which
    // is exactly what happened here on the first run of this spec. Scoped
    // to the one `<ol>` that CSS actually renders at this viewport.
    const visibleTrack = page.locator(
      'ol[aria-label="Posições do ciclo de vida do controle"]:visible',
    );
    await expect(visibleTrack.getByText('Concluído', { exact: true })).toBeVisible();
    await expect(visibleTrack.getByText('Atual', { exact: true })).toBeVisible();

    // --- 8. Now ACTIVE, a real verification can be registered -------------
    await page.getByRole('tab', { name: 'Verificações' }).click();
    await expect(
      page.getByText(
        'Este controle não está ativo — apenas controles ativos aceitam novas verificações.',
      ),
    ).toHaveCount(0);

    await page.getByRole('combobox', { name: 'Resultado' }).click();
    await page.getByRole('option', { name: 'Efetivo', exact: true }).click();
    await page
      .getByLabel('Conclusão')
      .fill('Verificação registrada pelo E2E — acessos revisados sem inconsistências.');
    await page.getByRole('button', { name: 'Registrar verificação', exact: true }).click();
    await expect(
      page.getByText('Verificação registrada pelo E2E — acessos revisados sem inconsistências.'),
    ).toBeVisible();

    // --- 9. Vínculos: the picker stays behind an intent button until
    //        clicked — the empty state never hides it (Fase D) ------------
    await page.getByRole('tab', { name: 'Vínculos' }).click();
    await expect(page.getByText('Nenhum processo vinculado a este controle.')).toBeVisible();
    const linkProcessTrigger = page.getByRole('button', { name: 'Vincular processo' });
    await expect(linkProcessTrigger).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Selecionar processo' })).toHaveCount(0);

    await linkProcessTrigger.click();
    const processCombo = page.getByRole('combobox', { name: 'Selecionar processo' });
    await expect(processCombo).toBeVisible();
    await processCombo.click();
    const firstProcessOption = page.getByRole('option').first();
    await firstProcessOption.waitFor({ state: 'visible', timeout: 10_000 });
    // `.innerText()`, not `.textContent()` — see the owner-picker capture
    // above for why: the option's name/code render as separate lines with
    // no whitespace between them in the DOM's own text flow.
    const linkedProcessName = (await firstProcessOption.innerText()).split('\n')[0]?.trim() ?? '';
    await firstProcessOption.click();
    await page.getByRole('button', { name: 'Vincular processo', exact: true }).click();
    await expect(page.getByText('Nenhum processo vinculado a este controle.')).toHaveCount(0);
    if (linkedProcessName) {
      await expect(page.getByText(linkedProcessName, { exact: false }).first()).toBeVisible();
    }

    // Unlink it — back to the empty state, the picker gated again.
    await page.getByRole('button', { name: 'Desvincular' }).first().click();
    const unlinkDialog = page.getByRole('dialog');
    await expect(
      unlinkDialog.getByRole('heading', { name: 'Desvincular processo?' }),
    ).toBeVisible();
    await unlinkDialog.getByRole('button', { name: 'Desvincular' }).click();
    await expect(unlinkDialog).toBeHidden();
    await expect(page.getByText('Nenhum processo vinculado a este controle.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vincular processo' })).toBeVisible();

    // --- 10. Evidências stays reachable as a fourth section ---------------
    await page.getByRole('tab', { name: 'Evidências' }).click();
    await expect(page.getByText('Evidência', { exact: true }).first()).toBeVisible();
  });
});
