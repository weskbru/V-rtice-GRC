import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { SEEDED_ROOT_ORG_UNIT_NAME, selectSeededRootOrgUnit } from './support/org-units';
import { openRiskDetailSection } from './support/risk-detail-sections';

import type { Page, TestInfo } from '@playwright/test';

/**
 * T054/006-assets-processes — E2E (Playwright) of the complete Asset and
 * Process journeys, through the real UI: cadastrar -> encontrar no
 * inventário/catálogo (filtro e busca) -> editar -> desativar -> confirmar
 * recusa de vínculo novo -> reativar. One shared, parameterized journey
 * (`runFullJourney`) rather than two near-duplicate files — Asset and
 * Process are deliberately the SAME shape (FR-020, CLAUDE.md §18.12); a
 * parameterized driver is what makes that symmetry impossible to drift
 * silently, the same reasoning `risk-controls-section.tsx`'s own
 * `RelationshipSubsection` already gives for folding three near-identical
 * relationship kinds into one component.
 *
 * Every string below is a literal, hardcoded pt-BR string matching
 * `apps/web/src/lib/messages/{assets,processes}.ts` — never imported from
 * that module, exactly like every other spec in this directory: a test
 * that imported the very catalog it is meant to verify would prove nothing
 * about what a real user actually sees.
 *
 * ## Why the link-refusal step goes through the real UI picker, not a
 * hybrid `page.request` call
 *
 * `RiskControlsSection`'s asset/process pickers are the `SearchablePicker`
 * (Front H, D-17, CLAUDE.md §18.12) — server-side search as the user
 * types, never a flat unsearched first page. This spec types the
 * just-deactivated fixture's own generated CODE into the picker's search
 * box before looking for its option, rather than assuming the fixture
 * lands on whatever unsearched page the picker would otherwise show first
 * — the same defect `audit-engagement.spec.ts`'s own header comment and
 * `risk-treatment.spec.ts` both records paying for once this suite's
 * catalog grew past a single page (40+ rows from repeated E2E/UI-capture
 * runs). Searching by CODE, not `.first()`, is still required here (unlike
 * that file's own `.first()` choice) because the refusal must be provably
 * about THIS asset/process, not merely "something".
 */
test.describe('Asset and Process: cadastro -> inventário/catálogo -> edição -> desativação -> recusa de vínculo -> reativação (US1-US3)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real asset/process journey.',
  );

  interface DomainFixture {
    readonly kind: 'ativo' | 'processo';
    readonly registerPath: string;
    readonly newPath: string;
    readonly pageHeading: string;
    readonly createFormHeading: string;
    readonly submitCreateLabel: string;
    readonly saveLabel: string;
    readonly editAction: string;
    readonly searchLabel: string;
    readonly codePattern: RegExp;
    readonly createSuccessText: string;
    readonly updateSuccessText: string;
    readonly deactivateAction: string;
    readonly deactivateConfirmTitle: string;
    readonly deactivateSuccessText: string;
    readonly reactivateAction: string;
    readonly reactivateConfirmTitle: string;
    readonly reactivateSuccessText: string;
    readonly cardSelectLabel: (code: string, name: string) => string;
    readonly linkPickerLabel: string;
    /** Front H: the `SearchablePicker`'s own search-input placeholder,
     * matching `apps/web/src/lib/messages/risks.ts` literally — used to
     * locate the search box and type the fixture's own code into it,
     * rather than assuming the fixture is on the picker's unsearched
     * first page. */
    readonly linkPickerSearchPlaceholder: string;
    /** Front H: the `SearchablePicker`'s own trigger accessible name
     * (`pickerAriaLabel`) — deliberately DIFFERENT from `linkPickerLabel`
     * above (the adjacent "Vincular" button's own label), now that they
     * are two distinct controls, confirmed by rendered inspection against
     * a real worktree build of this component. */
    readonly linkPickerAriaLabel: string;
    readonly linkGenericErrorText: string;
    readonly linkSuccessText: string;
    readonly linkEmptyText: string;
    readonly overviewNoDescription: string;
  }

  const ASSET: DomainFixture = {
    kind: 'ativo',
    registerPath: '/assets',
    newPath: '/assets/new',
    pageHeading: 'Ativos',
    createFormHeading: 'Novo ativo',
    submitCreateLabel: 'Cadastrar ativo',
    saveLabel: 'Salvar alterações',
    editAction: 'Editar',
    searchLabel: 'Buscar ativos',
    codePattern: /^AST-\d{4}-\d+$/,
    createSuccessText: 'Ativo cadastrado.',
    updateSuccessText: 'Ativo atualizado.',
    deactivateAction: 'Desativar',
    deactivateConfirmTitle: 'Desativar este ativo?',
    deactivateSuccessText: 'Ativo desativado.',
    reactivateAction: 'Reativar',
    reactivateConfirmTitle: 'Reativar este ativo?',
    reactivateSuccessText: 'Ativo reativado.',
    cardSelectLabel: (code, name) => `Abrir ativo ${code} — ${name}`,
    linkPickerLabel: 'Vincular ativo',
    linkPickerSearchPlaceholder: 'Buscar ativo por nome ou código',
    linkPickerAriaLabel: 'Selecionar ativo',
    linkGenericErrorText: 'Não foi possível vincular o ativo. Tente novamente.',
    linkSuccessText: 'Ativo vinculado.',
    linkEmptyText: 'Nenhum ativo vinculado a este risco.',
    overviewNoDescription: 'Sem descrição.',
  };

  const PROCESS: DomainFixture = {
    kind: 'processo',
    registerPath: '/processes',
    newPath: '/processes/new',
    pageHeading: 'Processos',
    createFormHeading: 'Novo processo',
    submitCreateLabel: 'Cadastrar processo',
    saveLabel: 'Salvar alterações',
    editAction: 'Editar',
    searchLabel: 'Buscar processos',
    codePattern: /^PRC-\d{4}-\d+$/,
    createSuccessText: 'Processo cadastrado.',
    updateSuccessText: 'Processo atualizado.',
    deactivateAction: 'Desativar',
    deactivateConfirmTitle: 'Desativar este processo?',
    deactivateSuccessText: 'Processo desativado.',
    reactivateAction: 'Reativar',
    reactivateConfirmTitle: 'Reativar este processo?',
    reactivateSuccessText: 'Processo reativado.',
    cardSelectLabel: (code, name) => `Abrir processo ${code} — ${name}`,
    linkPickerLabel: 'Vincular processo',
    linkPickerSearchPlaceholder: 'Buscar processo por nome ou código',
    linkPickerAriaLabel: 'Selecionar processo',
    linkGenericErrorText: 'Não foi possível vincular o processo. Tente novamente.',
    linkSuccessText: 'Processo vinculado.',
    linkEmptyText: 'Nenhum processo vinculado a este risco.',
    overviewNoDescription: 'Sem descrição.',
  };

  async function runFullJourney(
    page: Page,
    testInfo: TestInfo,
    domain: DomainFixture,
  ): Promise<void> {
    test.setTimeout(90_000);

    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const name = `${domain.kind === 'ativo' ? 'Ativo' : 'Processo'} E2E ${uniqueSuffix}`;
    const description = `Descrição inicial do ${domain.kind} E2E (T054), sufixo ${uniqueSuffix}.`;

    // ------------------------------------------------------------------
    // 1) Cadastrar (create), through the real "/new" form
    // ------------------------------------------------------------------
    await page.goto(domain.newPath);
    await expect(page.getByRole('heading', { name: domain.createFormHeading })).toBeVisible();
    await page.getByLabel('Nome').fill(name);
    await page.getByLabel('Descrição').fill(description);
    await selectSeededRootOrgUnit(page);
    const orgUnitName = SEEDED_ROOT_ORG_UNIT_NAME;
    await page.getByRole('button', { name: domain.submitCreateLabel }).click();

    await expect(page.getByText(domain.createSuccessText)).toBeVisible();
    await page.waitForURL(new RegExp(`${domain.registerPath}/[0-9a-fA-F-]+$`), {
      timeout: 15_000,
    });
    const entityId = page.url().split('/').pop()!;
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

    // `.first()` — 022-asset-detail-experience Fase A gave the asset detail
    // screen a breadcrumb ("Ativos › AST-…"), which renders the SAME code
    // string a second time as its own text node, ahead of the header's own
    // code badge in DOM order. Both carry the identical value, so `.first()`
    // is a safe disambiguation, not a narrowing of what this assertion
    // proves — Process's own detail screen (untouched by that rodada) still
    // has exactly one match, and `.first()` is a no-op there.
    const codeLocator = page.getByText(domain.codePattern).first();
    await expect(codeLocator).toBeVisible();
    const code = (await codeLocator.textContent())!.trim();
    expect(code).toMatch(domain.codePattern);

    // ------------------------------------------------------------------
    // 2) Encontrar no inventário/catálogo — busca e filtro (find, filter,
    //    search)
    // ------------------------------------------------------------------
    await page.goto(domain.registerPath);
    await expect(page.getByRole('heading', { name: domain.pageHeading })).toBeVisible();

    // Search by name.
    await page.getByLabel(domain.searchLabel).fill(name);
    const cardLink = page.getByRole('link', { name: domain.cardSelectLabel(code, name) });
    await expect(cardLink).toBeVisible({ timeout: 15_000 });

    // Clear the search and filter by the SAME organizational unit instead
    // — the card must still be discoverable through this second, distinct
    // filter path. The filter controls now rest behind the "Filtros"
    // disclosure (the shared register chrome), so this opens it first: the
    // filters are one click away, not gone.
    await page.getByLabel(domain.searchLabel).fill('');
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: orgUnitName, exact: true }).click();

    /*
     * F-72 / F-29 — order by most-recently-updated BEFORE asserting the card.
     *
     * This step used to assert the card straight after applying the filter,
     * and that assertion was on a ratchet. The register's defaults are page
     * size 25 and `code` ASCENDING (`use-asset-catalog-state.ts` /
     * `use-process-register-state.ts`); the search above narrows to one row,
     * but filtering by the SEEDED ROOT unit narrows to almost nothing, because
     * that is where practically every fixture record this suite has ever
     * created lives. Measured in this development database on 2026-09-14:
     * **113 assets and 97 processes in "PharosGRC"**, and the record this test
     * had just created was `AST-2026-0192` — page 5 of 5. Nothing was wrong
     * with the filter; the card was four pages away.
     *
     * That also corrects the classification this failure carried. It was
     * recorded as "only fails in a long session" (F-72,
     * `specs/015-roles-permissions-surface/STATE.md` §20.2) — it is not: it is
     * monotonic in how much the shared database has accumulated (F-70), and it
     * became permanent the day the root unit passed 25 records. A full run
     * merely reached it after the accessibility fixture had added two more.
     *
     * Ordering by "Última atualização — decrescente" is a real control on this
     * screen and a real user path (the record was created seconds ago), and it
     * makes the assertion depend on the filter doing its job rather than on
     * the inventory staying small. It does NOT weaken what is being proved:
     * the card must still be reachable with the SEARCH BOX EMPTY and only the
     * organizational-unit filter applied, which is the whole point of this
     * second path.
     */
    await page.getByRole('combobox', { name: 'Ordenar por' }).click();
    await page.getByRole('option', { name: 'Última atualização — decrescente' }).click();

    await expect(page.getByRole('link', { name: domain.cardSelectLabel(code, name) })).toBeVisible({
      timeout: 15_000,
    });
    // The search box really is empty — otherwise this would be the first
    // path over again under a different name.
    await expect(page.getByLabel(domain.searchLabel)).toHaveValue('');

    // Follow the card into the detail screen — this is the "found in the
    // catalogue" outcome the two filters above were proving.
    await page.getByRole('link', { name: domain.cardSelectLabel(code, name) }).click();
    await page.waitForURL(new RegExp(`${domain.registerPath}/${entityId}$`));
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

    // ------------------------------------------------------------------
    // 3) Editar (edit)
    // ------------------------------------------------------------------
    const updatedDescription = `${description} Editado pelo E2E.`;
    await page.getByRole('button', { name: domain.editAction }).click();
    await page.getByLabel('Descrição').fill(updatedDescription);
    await page.getByRole('button', { name: domain.saveLabel }).click();
    await expect(page.getByText(domain.updateSuccessText)).toBeVisible();
    await expect(page.getByText(updatedDescription)).toBeVisible();

    // ------------------------------------------------------------------
    // 4) Desativar (deactivate) — never deletion (FR-012): the record
    //    stays fully legible afterward.
    // ------------------------------------------------------------------
    await page.getByRole('button', { name: domain.deactivateAction, exact: true }).click();
    const deactivateDialog = page.getByRole('dialog');
    await expect(
      deactivateDialog.getByRole('heading', { name: domain.deactivateConfirmTitle }),
    ).toBeVisible();
    await deactivateDialog
      .getByRole('button', { name: domain.deactivateAction, exact: true })
      .click();
    await expect(deactivateDialog).toBeHidden();
    await expect(page.getByText(domain.deactivateSuccessText)).toBeVisible();
    // Two badges render "Inativo" at once — the header's own StatusBadge
    // and the overview tab's "Situação" field — so `.first()` disambiguates
    // exactly like the reactivation assertion below already does.
    await expect(page.getByText('Inativo', { exact: true }).first()).toBeVisible();
    // Still fully readable (FR-012) — the same heading and code as before.
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByText(updatedDescription)).toBeVisible();

    // ------------------------------------------------------------------
    // 5) Confirmar recusa de vínculo novo (a NEW link is refused while
    //    inactive) — through a fresh risk's own "Processos e Ativos" leaf
    //    (016-risk-detail-experience moved this out of "Controles", R-6),
    //    the real UI surface for this link (see this file's own header
    //    comment on why the specific fixture is targeted by CODE, not
    //    `.first()`).
    // ------------------------------------------------------------------
    const riskTitle = `Risco para recusa de vínculo E2E ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill(`Risco criado para provar a recusa de vínculo com ${domain.kind} inativo (T054).`);
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: orgUnitName, exact: true }).click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const riskId = page.url().split('/').pop()!;
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();

    // 016-risk-detail-experience, R-6: Processos/Ativos moved OUT of
    // "Controles" (which shows only controls now) into their own
    // "Processos e Ativos" leaf under "Relacionamentos" — same endpoints,
    // same permissions, only the label/grouping changed.
    await openRiskDetailSection(page, 'processes-assets');
    await page.getByRole('combobox', { name: domain.linkPickerAriaLabel }).click();
    // Front H: search by the fixture's own code — never assume it lands
    // on the picker's unsearched first page (this file's own header
    // comment).
    await page.getByPlaceholder(domain.linkPickerSearchPlaceholder).fill(code);
    const inactiveOption = page.getByRole('option').filter({ hasText: code });
    await expect(inactiveOption).toBeVisible({ timeout: 10_000 });
    await inactiveOption.click();
    await page.getByRole('button', { name: domain.linkPickerLabel }).click();
    await expect(page.getByText(domain.linkGenericErrorText)).toBeVisible();
    // Refused, not silently ignored — the relationship section still shows
    // its empty state, and the deactivated fixture's own name never
    // appears as a LINKED ROW.
    //
    // Scoped to `role=row` (2026-09-11, CI-found): this used to assert the
    // name appears NOWHERE on the whole page, which held only because the
    // old `<Select>` discarded its selection on a failed attempt.
    // `SearchablePicker` deliberately does not — a refused link's own
    // trigger keeps showing what the user tried (`searchable-picker.tsx`'s
    // own header comment, "a caller-controlled `value`") — so the
    // deactivated fixture's name is now legitimately on screen once,
    // inside the picker, after this exact refusal. That is correct
    // behaviour, not the defect this assertion exists to catch — the
    // defect it protects against is a refused link ending up as a real
    // TABLE ROW, so scoping to `role=row` says precisely that and nothing
    // broader, and holds equally whether the table renders at all (zero
    // links) or not.
    await expect(page.getByText(domain.linkEmptyText)).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0);

    // ------------------------------------------------------------------
    // 6) Reativar (reactivate)
    // ------------------------------------------------------------------
    await page.goto(`${domain.registerPath}/${entityId}`);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: domain.reactivateAction, exact: true }).click();
    const reactivateDialog = page.getByRole('dialog');
    await expect(
      reactivateDialog.getByRole('heading', { name: domain.reactivateConfirmTitle }),
    ).toBeVisible();
    await reactivateDialog
      .getByRole('button', { name: domain.reactivateAction, exact: true })
      .click();
    await expect(reactivateDialog).toBeHidden();
    await expect(page.getByText(domain.reactivateSuccessText)).toBeVisible();
    await expect(page.getByText('Ativo', { exact: true }).first()).toBeVisible();

    // A link now succeeds — proving the refusal above was genuinely about
    // the inactive situation, not some other defect.
    await page.goto(`/risks/${riskId}`);
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    await openRiskDetailSection(page, 'processes-assets');
    await page.getByRole('combobox', { name: domain.linkPickerAriaLabel }).click();
    // Front H: same reasoning as the refusal step above — search by code.
    await page.getByPlaceholder(domain.linkPickerSearchPlaceholder).fill(code);
    const activeOption = page.getByRole('option').filter({ hasText: code });
    await expect(activeOption).toBeVisible({ timeout: 10_000 });
    await activeOption.click();
    await page.getByRole('button', { name: domain.linkPickerLabel }).click();
    await expect(page.getByText(domain.linkSuccessText)).toBeVisible();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }

  test('asset: create -> find -> edit -> deactivate -> refused link -> reactivate', async ({
    page,
  }, testInfo) => {
    await runFullJourney(page, testInfo, ASSET);
  });

  test('process: create -> find -> edit -> deactivate -> refused link -> reactivate', async ({
    page,
  }, testInfo) => {
    await runFullJourney(page, testInfo, PROCESS);
  });
});
