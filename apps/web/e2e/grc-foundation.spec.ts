import { expect, test } from '@playwright/test';

import { loadWebEnv } from '../src/lib/env';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';
import { openRiskDetailSection } from './support/risk-detail-sections';

import type { APIResponse, Locator, Page } from '@playwright/test';

/**
 * T080 — E2E Playwright of the critical shared-GRC-foundation flow:
 * evidence -> link -> action -> finding -> closure with segregation of
 * duties (002-shared-grc-foundation, US1/US2/US3, FR-023 to FR-031,
 * Invariants A2/F1/F2).
 *
 * Runs against a real backend (`apps/api`), seeded per
 * `apps/api/prisma/seed/platform.seed.ts` with `SEED_DEV_FIXTURES=true`.
 * Skips itself with a clear reason when `SEED_ADMIN_EMAIL`/
 * `SEED_ADMIN_PASSWORD` are not set, exactly like every other spec in this
 * directory (F-33, `docs/deferred-findings.md`).
 *
 * ## A real, reported UI gap this spec works AROUND rather than papering over
 *
 * There is currently NO rendered UI anywhere in the app to (a) link an
 * `Evidence` record to a `Finding` subject, or (b) create an `Action` with
 * `originType: FINDING` — `EvidencePanel` is only ever mounted with
 * `subjectType="RISK"` (the risk detail page), and the one "create action"
 * flow that exists is the risk-treatment plan's own, which always creates
 * `originType: RISK_TREATMENT`. `FindingsPanel` shows only aggregate
 * counts (`openActionCount`/`evidenceCount`) for a finding — no "link
 * evidence" or "create action" affordance. This is a real product gap
 * (worth recording, not a defect this task is chartered to fix — no new
 * endpoint/table/column/enum/UI is in scope for Phase 6 polish).
 *
 * This spec is therefore a deliberate, documented HYBRID: every step that
 * has a real rendered UI surface drives that UI exactly as a user would
 * (evidence creation+linking to a RISK via `EvidencePanel`, finding
 * creation via `FindingsPanel`, the finding close/reopen dialogs, action
 * transitions via "Minhas ações"). Only the two steps with no UI surface —
 * linking the evidence to the FINDING subject, and creating the
 * FINDING-origin action — go through `page.request`, which shares the
 * browser context's cookies (including the httpOnly session cookie) with
 * `page`, so it authenticates as whichever identity is currently signed
 * in. State-changing calls set `Origin` to `APP_ORIGIN` themselves
 * (`csrf.middleware.ts` rejects any POST/PATCH/etc. whose `Origin` —
 * falling back to `Referer` — does not match it; a browser's own
 * same-origin requests send this automatically, `page.request` does not).
 *
 * ## Why the identities are "Worker Admin" then "Risk Approver fixture",
 * not "Risk Analyst" then "Risk Approver fixture" as first read
 *
 * This was investigated, not assumed — mirroring `risk-approval.spec.ts`'s
 * own documented substitution.
 *
 * Creating a FINDING-origin action requires BOTH `action:create` AND
 * `finding:edit` on the actor (`FindingActionOriginAccessor
 * .resolveEditableOrigin`, FR-031) — checked against whoever is signed in
 * when the `page.request` call fires. The seeded "Risk Analyst" role
 * (the obvious "analyst-type identity" for step 1) holds `finding:create`/
 * `finding:edit` but NOT `action:create` (`platform.seed.ts`'s own comment
 * on that role: creating a RISK_TREATMENT-origin action requires
 * `risk:treat`, which Risk Analyst deliberately lacks — and the seed script
 * grants no separate FINDING-origin carve-out). Only "Risk Manager" and
 * "Platform Administrator" hold `action:create`. "Risk Manager"'s seeded
 * organizational unit has no scope overlap with "Risk Approver"'s (round-
 * robin assignment vs. the "Risk Analyst"/"Risk Approver" shared-unit
 * fixture — see F-15, `docs/deferred-findings.md`), so a risk/finding
 * created in Risk Manager's own scope would be invisible to Risk Approver
 * (`ScopeResolverService` expands a `UNIT` grant to that unit plus
 * descendants only, never ancestors or siblings) — the exact same
 * disjoint-scope problem `risk-approval.spec.ts` already found and
 * documented for the Analyst/Approver pairing used incorrectly.
 *
 * The Worker Admin pool account (`signInAsWorkerAdmin`, F-16) is `GLOBAL`
 * scope with every permission, including `action:create`, `finding:edit`
 * and `finding:close` — it plays BOTH "the person who creates everything
 * and does the remediation work" AND "the person who is then correctly
 * REFUSED when they try to close their own finding" (Invariant F2 is a
 * business rule enforced independently of role: whoever is the
 * `responsibleUserId` of a COMPLETED action linked to a finding may not
 * close it, even a Platform Administrator — `finding.entity.ts
 * #assertCloserNotResponsibleForCompletedAction`). It explicitly creates
 * the risk under "Division A / Team 1 (fixture)" (`DIV-A-TEAM-1`) — the
 * ONE unit the seed script's F-15 fix deliberately keeps shared between the
 * "Risk Analyst" and "Risk Approver" fixtures — so the SECOND, genuinely
 * different identity that finally closes the finding (`FIXTURE_USER_EMAIL
 * .riskApprover`, real `finding:close`, never the responsible party for
 * this action) can actually see it.
 */
test.describe('Evidence -> link -> action -> finding -> closure with segregation of duties (US1/US2/US3)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real shared-GRC-foundation journey.',
  );

  test('links evidence to a risk and a finding, remediates via an action, and enforces segregation of duties on closure', async ({
    page,
  }, testInfo) => {
    // Two full sign-ins, a risk/evidence/finding creation sequence, two
    // `page.request` setup calls, an action lifecycle, and two finding
    // close attempts — a longer critical-path journey than
    // `risk-approval.spec.ts`'s own 60s (T152's own measured ~30.2s for a
    // shorter, single-sign-in-pair flow), so 90s leaves real headroom
    // rather than this test's pass/fail turning on incidental system load.
    test.setTimeout(90_000);

    const { APP_ORIGIN } = loadWebEnv();
    const uniqueSuffix = Date.now().toString(36);
    const riskTitle = `Risco para fundação GRC E2E ${uniqueSuffix}`;
    const evidenceTitle = `Evidência de fundação GRC E2E ${uniqueSuffix}`;
    const findingTitle = `Achado de fundação GRC E2E ${uniqueSuffix}`;
    const actionTitle = `Ação de remediação GRC E2E ${uniqueSuffix}`;

    function futureDateOnly(daysFromNow: number): string {
      const date = new Date();
      date.setDate(date.getDate() + daysFromNow);
      return date.toISOString().slice(0, 10);
    }

    // --- First identity: the Worker Admin creates everything and later
    // plays the remediator who gets correctly refused (see this file's own
    // header comment for why) -----------------------------------------------
    await signInAsWorkerAdmin(page, testInfo);

    // --- Create a risk under the ONE unit shared by the Analyst/Approver
    // fixtures (F-15), so the Approver identity can see it later ------------
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco criado pelo E2E de fundação GRC compartilhada (T080).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: 'Division A / Team 1 (fixture)' }).click();
    // Picked BY NAME, never `.first()`: the assignment line of
    // `DIV-A-TEAM-1` (`assignment-line.ts`) is only itself, its ancestors
    // (`DIV-A`, root) and its descendants — never a sibling unit — and this
    // local database's own long-lived debris (an "E2E Auth Journey" account
    // `auth.spec.ts`'s `provisionAuthJourneyAccount` recreates, and never
    // deletes, on every run) sorts ahead of every fixture user in the
    // "Gestor do risco" combobox's own listing. `.first()` therefore
    // silently picked that debris account instead of a manager who actually
    // belongs to `DIV-A-TEAM-1`'s line, and `POST /api/v1/risks` correctly
    // refused the pair with the same 422 `ownerNotAssignable` this file's
    // own header already documents for the org-unit side — the exact same
    // class of defect `selectSeededRootOrgUnit` (./support/org-units.ts)
    // exists to eliminate, now on the manager picker instead of the org-unit
    // picker.
    //
    // "Fixture — Risk Analyst"/"Fixture — Risk Approver" are NOT usable
    // here despite `platform.seed.ts`'s `SHARED_ANALYST_APPROVER_UNIT_ROLE_
    // NAMES` (the F-15 fix) forcing both onto `DIV-A-TEAM-1` in the SEED
    // CODE today: verified directly against this run's own database (read-
    // only Prisma query against `User.primaryOrgUnitId`), this long-lived
    // local database still carries BOTH fixture users' `primaryOrgUnitId`
    // from an OLDER seed run that predates that fix, because the seed
    // script's own `user.upsert` passes `update: {}` — an existing row's
    // `primaryOrgUnitId` is never touched on re-seed, only a freshly
    // created row gets the current code's placement. Both accumulated an
    // ADDITIONAL `OrgScopeGrant` on `DIV-A-TEAM-1` from a later re-seed
    // (`ensureUnitScopeGrant` only ever adds grants, never removes one), so
    // their organizational SCOPE does cover this unit — which is why the
    // Risk Approver identity can still find and close the finding later in
    // this same test — but `assertUserAssignable` here checks `User.
    // primaryOrgUnitId` against the assignment line, not scope grants, and
    // neither user's `primaryOrgUnitId` is `DIV-A-TEAM-1`, its parent
    // `DIV-A`, or the root. "Fixture — Compliance Manager" was confirmed by
    // the same direct query to carry `primaryOrgUnitId === DIV-A-TEAM-1`
    // itself, unconditionally in this unit's assignment line, and is not an
    // identity this test otherwise signs in as or asserts on.
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    // S-10 — the manager picker now searches the directory server-side
    // (`UserPicker`); this fixture is exactly the kind of entry the
    // "E2E Auth Journey" debris (sorting ahead of it alphabetically, and
    // never cleaned up — this file's own comment above) could push off an
    // unsearched first page, so this searches by name rather than assuming
    // it survives unsearched. Each option's accessible name is "fullName
    // email" (`SearchablePicker`'s own accname fix), so the exact match is
    // anchored at the START of that string, not the whole thing.
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill('Fixture — Compliance Manager');
    await page.getByRole('option', { name: /^Fixture — Compliance Manager / }).click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    const riskUrl = page.url();
    const riskId = riskUrl.split('/').pop()!;

    // --- US1: register an evidence and link it to the risk, through
    // `EvidencePanel`'s real "Nova evidência" flow --------------------------
    // 016-risk-detail-experience regrouped this into a two-level navigation
    // (Evidência is a leaf under "Relacionamentos") — a flat one-click
    // `getByRole('tab', ...)` can no longer resolve it (found running this
    // spec in isolation: a 90s timeout on this exact click, 2026-09-16).
    await openRiskDetailSection(page, 'evidence');
    await expect(page.getByText('Nenhuma evidência vinculada ainda.')).toBeVisible();
    await page.getByRole('button', { name: 'Nova evidência' }).click();
    await expect(page.getByRole('heading', { name: 'Registrar evidência' })).toBeVisible();
    await page.getByLabel('Título').fill(evidenceTitle);
    await page.getByRole('combobox', { name: /Tipo/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Procedência/ }).click();
    await page.getByRole('option').first().click();
    // Substance requirement (evidenceMessages.form.substanceHint): a
    // reference URL or an observation is required — the observation field
    // ("Observação", NOT the link-scoped "Observação do vínculo" field
    // further down the same form) is filled here.
    await page
      .getByLabel('Observação', { exact: true })
      .fill('Relatório de verificação anexado ao risco (T080).');
    await page.getByRole('button', { name: 'Registrar e vincular' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(evidenceTitle)).toBeVisible();

    // --- US3: register a finding via `FindingsPanel`'s real "Novo achado"
    // flow, in the same organizational unit -----------------------------
    // No empty-state assertion here (unlike the Evidence tab above): this
    // panel is scoped by the risk's ORGANIZATIONAL UNIT, not by this one
    // risk (`findings-panel.tsx`'s own header — this phase models no
    // persisted Finding-to-Risk relationship), and "Division A / Team 1
    // (fixture)" is a shared fixture unit other spec runs may have already
    // left findings in — the panel showing pre-existing findings here is
    // expected, not a defect.
    // Same reason as the "Evidência" fix above — "Achados" is also a leaf
    // under "Relacionamentos" now.
    await openRiskDetailSection(page, 'findings');
    await page.getByRole('button', { name: 'Novo achado' }).click();
    await expect(page.getByRole('heading', { name: 'Registrar achado' })).toBeVisible();
    await page.getByLabel('Título').fill(findingTitle);
    await page
      .getByLabel('Descrição')
      .fill('Deficiência de controle identificada durante o E2E de fundação GRC (T080).');
    await page.getByRole('combobox', { name: /Categoria/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Origem/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Severidade/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Prioridade/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(findingTitle)).toBeVisible();

    // --- Hybrid setup steps with no rendered UI surface (see this file's
    // own header comment): resolve the admin's own user id, the just-
    // created evidence/finding ids (read-only `GET`s, no CSRF concern),
    // then link the evidence to the FINDING subject and create the
    // FINDING-origin action, both via `page.request` sharing this page's
    // own session cookie ------------------------------------------------
    const sessionResponse = await page.request.get('/api/v1/auth/session');
    expect(sessionResponse.ok()).toBe(true);
    const adminUserId = ((await sessionResponse.json()) as { user: { id: string } }).user.id;

    const evidenceListResponse = await page.request.get(
      `/api/v1/evidence?subjectType=RISK&subjectId=${riskId}&pageSize=100`,
    );
    expect(evidenceListResponse.ok()).toBe(true);
    const evidencePage = (await evidenceListResponse.json()) as {
      items: readonly { id: string; title: string }[];
    };
    const evidenceId = evidencePage.items.find((item) => item.title === evidenceTitle)?.id;
    expect(
      evidenceId,
      'the just-created evidence must be findable via GET /evidence',
    ).toBeDefined();

    const riskOrgUnitId = await getRiskOrgUnitId(page, riskId);
    const findingListResponse = await page.request.get(
      `/api/v1/findings?orgUnitId=${riskOrgUnitId}&pageSize=100`,
    );
    expect(findingListResponse.ok()).toBe(true);
    const findingPage = (await findingListResponse.json()) as {
      items: readonly { id: string; title: string }[];
    };
    const findingId = findingPage.items.find((item) => item.title === findingTitle)?.id;
    expect(findingId, 'the just-created finding must be findable via GET /findings').toBeDefined();

    const linkResponse = await page.request.post(`/api/v1/evidence/${evidenceId}/links`, {
      headers: { Origin: APP_ORIGIN },
      data: {
        subjectType: 'FINDING',
        subjectId: findingId,
        note: 'Vínculo criado via hybrid setup (T080) — sem superfície de UI para este passo.',
      },
    });
    expect(linkResponse.ok(), await describeFailure(linkResponse)).toBe(true);

    const createActionResponse = await page.request.post('/api/v1/actions', {
      headers: { Origin: APP_ORIGIN },
      data: {
        originType: 'FINDING',
        originId: findingId,
        title: actionTitle,
        description: 'Ação de remediação criada via hybrid setup (T080) — sem superfície de UI.',
        responsibleUserId: adminUserId,
        dueOn: futureDateOnly(7),
      },
    });
    expect(createActionResponse.ok(), await describeFailure(createActionResponse)).toBe(true);

    // --- US2: complete the remediation through the REAL "Minhas ações" UI,
    // as the responsible party (still the Worker Admin) ---------------------
    await page.goto('/actions');
    await expect(page.getByRole('heading', { name: 'Planos de Ação' })).toBeVisible();
    // `/actions` now opens on the CARD view by default (CLAUDE.md §18.12,
    // `MyActionsView`'s own header) — this step is about the action
    // LIFECYCLE (starting/completing it), which this spec still proves
    // through the real UI, and `getByRole('row')`/`Itens por página` below
    // only exist once the register is in table view. Switches to it first,
    // mirroring `risk-register.spec.ts`'s own `switchToTableView` idiom;
    // this is not an assertion about which view is correct.
    await page.getByRole('radio', { name: 'Ver as ações em tabela' }).click();
    await expect(page).toHaveURL(/[?&]view=table/);
    await expect(
      page.getByRole('table', { name: 'Lista de ações do plano de ação visíveis no seu escopo' }),
    ).toBeVisible({ timeout: 15_000 });
    // Bumps rows-per-page to this screen's own maximum so the newly created
    // action (`GET /actions` orders by `dueOn` ascending, not creation
    // order — `prisma-action.repository.ts`) is not stranded on a later
    // page behind unrelated actions this long-lived worker account has
    // accumulated across other spec runs.
    await page.getByLabel('Itens por página').selectOption('100');

    const actionRow = page.getByRole('row').filter({ hasText: actionTitle });
    await expect(actionRow).toBeVisible();
    await expect(actionRow.getByText('Aberta', { exact: true })).toBeVisible();

    await actionRow.getByRole('button', { name: 'Ações' }).click();
    await page.getByRole('menuitem', { name: 'Iniciar' }).click();
    await expect(actionRow.getByText('Em andamento', { exact: true })).toBeVisible();

    await actionRow.getByRole('button', { name: 'Ações' }).click();
    await page.getByRole('menuitem', { name: 'Concluir' }).click();
    await expect(actionRow.getByText('Concluída', { exact: true })).toBeVisible();

    // --- US3/Invariant F2: the SAME Worker Admin — the responsible party
    // for the now-COMPLETED action — attempts to close the finding and is
    // correctly REFUSED (403), via the real `FindingCloseDialog` UI ---------
    await page.goto(riskUrl);
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    await openRiskDetailSection(page, 'findings');
    // `findings-panel.tsx` renders each finding as one `<li>` (implicit
    // `listitem` role) — the SAME row-scoping idiom `risk-treatment.spec.ts`
    // and `admin-access.spec.ts` already establish for `getByRole('row')`.
    const findingCard = page.getByRole('listitem').filter({ hasText: findingTitle });
    await expandFinding(findingCard, findingTitle);
    await findingCard.getByRole('button', { name: 'Encerrar' }).click();

    const closeDialog = page.getByRole('dialog');
    await expect(closeDialog.getByRole('heading', { name: 'Encerrar achado' })).toBeVisible();
    // Invariant F1 is already satisfied by the COMPLETED action above, so
    // the justification is deliberately left blank — this attempt must
    // fail on THIS invariant (F2, segregation of duties), not F1.
    await closeDialog.getByRole('button', { name: 'Encerrar' }).click();
    await expect(
      closeDialog.getByText(
        'Quem executou a remediação não pode encerrar o achado. Peça que outra pessoa com ' +
          'permissão de encerramento realize esta ação.',
      ),
    ).toBeVisible();
    // The refusal keeps the dialog open and the finding open — never a
    // silent partial success.
    await expect(closeDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(closeDialog).toBeHidden();
    await expect(findingCard.getByText('Aberto', { exact: true })).toBeVisible();

    // --- Second, genuinely different identity: the Risk Approver fixture
    // (real `finding:close`, never the responsible party for this action,
    // scoped to the SAME "Division A / Team 1 (fixture)" unit) closes the
    // finding successfully -----------------------------------------------
    await signOut(page);
    await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskApprover);
    await page.goto(riskUrl);
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    await openRiskDetailSection(page, 'findings');
    const findingCardAsApprover = page.getByRole('listitem').filter({ hasText: findingTitle });
    await expandFinding(findingCardAsApprover, findingTitle);
    await findingCardAsApprover.getByRole('button', { name: 'Encerrar' }).click();

    const secondCloseDialog = page.getByRole('dialog');
    await expect(secondCloseDialog.getByRole('heading', { name: 'Encerrar achado' })).toBeVisible();
    await secondCloseDialog.getByRole('button', { name: 'Encerrar' }).click();
    await expect(secondCloseDialog).toBeHidden();

    // Durable state, not the transient success toast — the finding's own
    // status badge now reads "Encerrado" (findingsMessages.statusLabels.CLOSED).
    await expect(findingCardAsApprover.getByText('Encerrado', { exact: true })).toBeVisible();
    await expect(findingCardAsApprover.getByRole('button', { name: 'Encerrar' })).toHaveCount(0);
  });
});

/**
 * 016-risk-detail-experience, Área 5 (2026-09-17) — every finding row is now
 * a collapsed `DisclosureGroup` by default: only status/severity fold into
 * the toggle's own accessible name (code + title), and `DisclosureGroup`
 * UNMOUNTS everything else — including "Encerrar"/"Reabrir" and the
 * link/unlink affordances — while collapsed (`findings-panel.tsx`'s own
 * header comment). Mirrors `findings-panel.test.tsx`'s own `expandFinding`
 * helper, and `audit-engagement.spec.ts`'s identical E2E-side copy. Each
 * fresh page load (a `page.goto`, or a different signed-in identity) starts
 * collapsed again — this is called once per load that needs it, not once
 * per test.
 */
async function expandFinding(findingCard: Locator, title: string): Promise<void> {
  await findingCard.getByRole('button', { name: new RegExp(title) }).click();
}

/** Reads a risk's own `orgUnit.id` via `GET /risks/{id}` — used only to
 * scope the `GET /findings?orgUnitId=` hybrid lookup below to the SAME
 * unit `FindingsPanel` itself queries (`findings-panel.tsx`'s own header:
 * this phase has no persisted Finding-to-Risk relationship, so the panel,
 * and this lookup, both scope by organizational unit instead). */
async function getRiskOrgUnitId(page: Page, riskId: string): Promise<string> {
  const response = await page.request.get(`/api/v1/risks/${riskId}`);
  expect(response.ok()).toBe(true);
  const risk = (await response.json()) as { orgUnit: { id: string } };
  return risk.orgUnit.id;
}

/** Formats a failed `page.request` response for a test assertion message —
 * status plus body, since a bare `false` from `.ok()` gives no clue which
 * of the two hybrid setup calls failed or why. */
async function describeFailure(response: APIResponse): Promise<string> {
  if (response.ok()) return '';
  return `expected 2xx, got ${String(response.status())}: ${await response.text()}`;
}
