import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';

import type { Browser, BrowserContext, Page } from '@playwright/test';

/**
 * F1 (stabilization) — S-03/S-04/S-05/S-06: `DialogContent`
 * (`apps/web/src/components/ui/dialog.tsx`) and `ConfirmDialog`
 * (`packages/design-system/src/components/confirm-dialog.tsx`) now share one
 * focus-restoration mechanism (`useDialogFocusRestore`,
 * `packages/design-system/src/lib/use-restore-focus.ts`), and `DataTable`
 * (`packages/design-system/src/components/data-table/data-table.tsx`) no
 * longer remounts a cell just because its caller rebuilt `columns` this
 * render. This file exercises one REAL reproduction of each of the four
 * mechanisms this package fixes, against the rendered application — never a
 * synthetic harness — per CLAUDE.md §18.1.
 *
 * Mirrors `incidents.spec.ts`/`admin-roles.spec.ts`: `requireSeedCredentials`
 * guard, one shared signed-in page (`mode: 'serial'`, one
 * `signInAsWorkerAdmin` call in `beforeAll`).
 *
 * Fixture data this file creates is prefixed `[FIX-F1]`. Incidents have no
 * delete endpoint (a deliberate business rule, not an oversight — see
 * `docs/local-environment.md`/CLAUDE.md §9's "histórico deve ser
 * preservado"), and neither do report definitions
 * (`ReportController`'s own header: no delete operation exists in the
 * contract) — both are expected, intentional debris in a long-lived local
 * database, exactly like `provisionAuthJourneyAccount`'s own header
 * documents for its account. The one scenario that opens an org-unit-create
 * dialog (scenario e) never submits it — no organizational unit is created.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Dialog focus restoration and height (S-03, S-04, S-05, S-06)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise dialog focus/size behavior.',
  );

  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }, testInfo) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await signInAsWorkerAdmin(page, testInfo);
  });

  test.afterAll(async () => {
    await browserContext.close();
  });

  /**
   * (a) S-03(a): a native `autoFocus` on a field inside a dialog used to be
   * captured (in `onOpenAutoFocus`, which fires after commit) as the
   * "previous" element instead of the real trigger. `IncidentTransitionDialog`
   * carries `autoFocus` on its required "Resumo da resolução" field
   * (`incident-transition-dialog.tsx:137`) — reproduced against the real
   * IN_PROGRESS -> RESOLVED transition, both close paths (Escape, "Cancelar").
   */
  test('(a) Incident "Resolver" dialog (autoFocus field) restores focus to the "Resolver" button via Escape and via Cancelar', async () => {
    test.setTimeout(60_000);

    const suffix = Date.now().toString(36);
    const title = `[FIX-F1] Incidente ${suffix}`;

    await page.goto('/incidents/new');
    await expect(page.getByRole('heading', { name: 'Novo incidente' })).toBeVisible();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descrição')
      .fill('Incidente criado pelo agente de correção F1 para validar restauração de foco.');
    await page.getByRole('combobox', { name: 'Severidade' }).click();
    await page.getByRole('option', { name: 'Alta' }).click();
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Registrar incidente' }).click();
    await page.waitForURL(/\/incidents\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByRole('button', { name: 'Iniciar atendimento' }).click();
    await expect(page.getByText('Em andamento', { exact: true }).first()).toBeVisible();

    const resolveTrigger = page.getByRole('button', { name: 'Resolver' });

    // --- Close path 1: Escape ---------------------------------------------
    await resolveTrigger.click();
    const dialog1 = page.getByRole('dialog');
    await expect(dialog1.getByRole('heading', { name: 'Resolver este incidente?' })).toBeVisible();
    const field1 = dialog1.getByLabel('Resumo da resolução');
    // The field carries `autoFocus` — this is the exact race S-03(a) protects
    // against.
    await expect(field1).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog1).toBeHidden();
    await expect(resolveTrigger).toBeFocused();

    // --- Close path 2: the "Cancelar" button --------------------------------
    await resolveTrigger.click();
    const dialog2 = page.getByRole('dialog');
    await expect(dialog2.getByRole('heading', { name: 'Resolver este incidente?' })).toBeVisible();
    await expect(dialog2.getByLabel('Resumo da resolução')).toBeFocused();

    await dialog2.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog2).toBeHidden();
    await expect(resolveTrigger).toBeFocused();

    // The incident was never actually resolved by either close path.
    await expect(page.getByText('Em andamento', { exact: true }).first()).toBeVisible();
  });

  /**
   * (b) S-03(b): a dialog opened from a `DropdownMenuItem`'s `onSelect`
   * captures the menu ITEM (`user-admin-columns.tsx:183`, the direct
   * `onSelect={() => onEdit(user)}` pattern — never fixed with the
   * `pendingAction`/`onCloseAutoFocus` workaround `role-admin-columns.tsx`
   * uses), which unmounts during the menu's own exit animation. Focus must
   * resolve to the row's menu TRIGGER, not the vanished item.
   */
  test('(b) /admin/users row menu "Editar" restores focus to the row\'s menu trigger via Escape and via Cancelar', async () => {
    await page.goto('/admin/users', { waitUntil: 'networkidle' });
    const menuTrigger = page.getByRole('button', { name: /Ações para/ }).first();
    await expect(menuTrigger).toBeVisible();

    // --- Close path 1: Escape ---------------------------------------------
    await menuTrigger.click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const dialog1 = page.getByRole('dialog');
    await expect(dialog1.getByRole('heading', { name: 'Editar usuário' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog1).toBeHidden();
    await expect(menuTrigger).toBeFocused();

    // --- Close path 2: the "Cancelar" button --------------------------------
    await menuTrigger.click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const dialog2 = page.getByRole('dialog');
    await expect(dialog2.getByRole('heading', { name: 'Editar usuário' })).toBeVisible();

    await dialog2.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog2).toBeHidden();
    await expect(menuTrigger).toBeFocused();
  });

  /**
   * (c) S-05: `ReportCatalogView` rebuilds `columns` (a fresh `onRun`
   * closure) on every render (`report-catalog-view.tsx:87`, no `useMemo` —
   * one of the ten `DataTable` callers this pattern was found in). Clicking
   * a row's "Executar" button calls `setRunTarget`, which re-renders the
   * table with a brand-new `columns` identity in the SAME commit that opens
   * `ReportRunDialog` — before the fix, `flexRender` mounted every cell as a
   * new component and remounted the very button that was just clicked,
   * severing the captured restore target.
   *
   * `GET /reports` has no name search (`use-report-catalog-state.ts`'s own
   * header: "No `search`, no `sort`"), ordered by `code` ascending
   * (`prisma-report-definition.repository.ts:40`) — a freshly created
   * fixture sorts LAST, so this reads the real total from the API and
   * navigates straight to the final page at the largest page size the UI
   * offers, rather than assuming page 1.
   */
  test('(c) /reports "Executar" restores focus to that row\'s own button after a columns rebuild, via Escape', async () => {
    const suffix = Date.now().toString(36);
    const reportName = `[FIX-F1] Relatório ${suffix}`;
    const origin = new URL(page.url()).origin;

    const createResponse = await page.request.post('/api/v1/reports', {
      headers: { Origin: origin },
      data: {
        name: reportName,
        description: 'Relatório criado pelo agente de correção F1 para validar S-05.',
        metricKeys: ['RISK_TOTAL_BY_LEVEL'],
      },
    });
    expect(createResponse.ok(), await createResponse.text()).toBeTruthy();

    const pageSize = 100;
    const listResponse = await page.request.get(
      `/api/v1/reports?page=1&pageSize=${String(pageSize)}`,
      { headers: { Origin: origin } },
    );
    expect(listResponse.ok(), await listResponse.text()).toBeTruthy();
    const listBody = (await listResponse.json()) as { meta: { totalPages: number } };
    const lastPage = Math.max(1, listBody.meta.totalPages);

    await page.goto(`/reports?pageSize=${String(pageSize)}&page=${String(lastPage)}`, {
      waitUntil: 'networkidle',
    });
    const row = page.getByRole('row').filter({ hasText: reportName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    const runButton = row.getByRole('button', { name: 'Executar' });

    await runButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: reportName })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // The SAME row's "Executar" button — re-queried fresh, exactly as a real
    // user's next Tab/click would see it — must be the element that ends up
    // focused, not `<body>`.
    await expect(row.getByRole('button', { name: 'Executar' })).toBeFocused();
  });

  /**
   * (d) S-04: `ConfirmDialog` (34 callers) never restored focus (F-62) and
   * its confirm button carries `autoFocus` — the identical race S-03(a)
   * fixes for the plain `Dialog` primitive.
   *
   * (d1) isolates S-04 on its own: `AssetLifecycleActions`' "Desativar"
   * button (`asset-lifecycle-actions.tsx:105`) opens a `ConfirmDialog`
   * directly from a PLAIN button — no `DropdownMenu` involved. This
   * distinction matters and was found by measurement, not assumed: a
   * `ConfirmDialog` opened from a row menu (as in (d2) below) sits behind
   * Radix `DropdownMenu`'s OWN, separate, already-correct
   * default-refocus-its-trigger-on-close behavior, which independently
   * lands focus back on the menu trigger regardless of whether
   * `ConfirmDialog` itself restores anything — confirmed directly: reverting
   * S-04's fix in isolation left (d2) passing unchanged (a test that passes
   * in both states protects nothing). (d1) has no such confound, so it FAILS
   * without the fix, and is the real regression proof for S-04.
   *
   * (d2) still exercises the exact scenario the coordinator's brief named
   * (`/admin/users`, menu -> "Encerrar sessões", `UserSessionsDialog`) end to
   * end against the real UI — real, valuable consumer coverage of S-03(b)'s
   * menu-trigger resolution plus this exact `ConfirmDialog` call site — but
   * is NOT relied on alone to prove S-04, for the reason above. Both close
   * by Escape ONLY — never confirmed, so nothing is actually deactivated or
   * revoked.
   */
  test('(d1) Asset "Desativar" (plain-button ConfirmDialog) restores focus to its trigger via Escape and via Cancelar', async () => {
    const suffix = Date.now().toString(36);
    const name = `[FIX-F1] Ativo ${suffix}`;

    await page.goto('/assets/new');
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    await page.getByLabel('Nome').fill(name);
    await page
      .getByLabel('Descrição')
      .fill('Ativo criado pelo agente de correção F1 para validar S-04 isoladamente.');
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Cadastrar ativo' }).click();
    await expect(page.getByText('Ativo cadastrado.')).toBeVisible();
    await page.waitForURL(/\/assets\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

    const deactivateTrigger = page.getByRole('button', { name: 'Desativar', exact: true });

    // --- Close path 1: Escape ---------------------------------------------
    await deactivateTrigger.click();
    const dialog1 = page.getByRole('dialog');
    await expect(dialog1.getByRole('heading', { name: 'Desativar este ativo?' })).toBeVisible();
    const confirmButton1 = dialog1.getByRole('button', { name: 'Desativar', exact: true });
    // `ConfirmDialog`'s confirm button carries `autoFocus` — the S-04 race.
    await expect(confirmButton1).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog1).toBeHidden();
    await expect(deactivateTrigger).toBeFocused();

    // --- Close path 2: the "Cancelar" button --------------------------------
    await deactivateTrigger.click();
    const dialog2 = page.getByRole('dialog');
    await expect(dialog2.getByRole('heading', { name: 'Desativar este ativo?' })).toBeVisible();
    await expect(dialog2.getByRole('button', { name: 'Desativar', exact: true })).toBeFocused();

    await dialog2.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog2).toBeHidden();
    await expect(deactivateTrigger).toBeFocused();

    // Never actually deactivated by either close path.
    await expect(page.getByRole('button', { name: 'Desativar', exact: true })).toBeVisible();
  });

  test('(d2) /admin/users row menu "Encerrar sessões" restores focus to the row\'s menu trigger via Escape, without confirming', async () => {
    await page.goto('/admin/users', { waitUntil: 'networkidle' });
    const menuTrigger = page.getByRole('button', { name: /Ações para/ }).first();
    await expect(menuTrigger).toBeVisible();

    await menuTrigger.click();
    await page.getByRole('menuitem', { name: 'Encerrar sessões' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Encerrar sessões de/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(menuTrigger).toBeFocused();
  });

  /**
   * (e) S-06: `DialogContent` gained a default `max-h-[90vh] overflow-y-auto`
   * — measured beforehand (this file's owning agent, F1) against every
   * currently-implemented dialog lacking its own `max-h` at both 1280x720
   * and 390x844: none happens to overflow TODAY's actual content at either
   * size (the risk this fix closes is latent, not currently visible, for
   * this specific set of dialogs — recorded honestly in `F1-report.md`
   * rather than staged with synthetic content). What IS real and directly
   * tied to this fix, and asserted here on a genuine dialog
   * (`OrgUnitFormDialog`'s "Nova unidade" — opened, never submitted, so no
   * organizational unit is created): `DialogContent`'s own computed
   * `max-height`/`overflow-y` are bounded to the viewport, and its primary
   * action stays reachable within it, at both viewports. This fails without
   * the fix (no `max-height` rule at all, default `overflow: visible`) and
   * passes with it.
   */
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ] as const) {
    test(`(e) DialogContent bounds itself to the viewport and keeps its primary action reachable at ${String(viewport.width)}x${String(viewport.height)}`, async () => {
      await page.setViewportSize(viewport);
      await page.goto('/admin/organization', { waitUntil: 'networkidle' });

      await page.getByRole('button', { name: 'Nova unidade raiz' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Nova unidade raiz' })).toBeVisible();

      const maxHeight = await dialog.evaluate((el) => window.getComputedStyle(el).maxHeight);
      const overflowY = await dialog.evaluate((el) => window.getComputedStyle(el).overflowY);
      expect(maxHeight).not.toBe('none');
      const maxHeightPx = Number.parseFloat(maxHeight);
      expect(maxHeightPx).toBeGreaterThan(0);
      expect(maxHeightPx).toBeLessThanOrEqual(viewport.height);
      expect(['auto', 'scroll']).toContain(overflowY);

      const submitButton = dialog.getByRole('button', { name: 'Criar unidade' });
      await expect(submitButton).toBeVisible();
      const box = await submitButton.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }

      // Never submitted — closing by Escape creates nothing.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  }
});
