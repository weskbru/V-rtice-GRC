import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { openRiskDetailSection } from './support/risk-detail-sections';

import type { APIResponse, Locator, Page } from '@playwright/test';

/**
 * T083 — E2E (Playwright) of the complete Audit Engagements journey
 * (005-audit-findings): engagement created -> scope added -> started ->
 * finding recorded from the engagement -> moved to remediation -> closed
 * with evidence -> linked to a control and to a risk.
 *
 * Runs against a real backend, seeded per
 * `apps/api/prisma/seed/platform.seed.ts` with `SEED_DEV_FIXTURES=true`.
 * Skips itself with a clear reason when `SEED_ADMIN_EMAIL`/
 * `SEED_ADMIN_PASSWORD` are not set, like every other spec in this
 * directory (F-33).
 *
 * ## Identity: the Worker Admin pool account throughout, not "Audit Lead"
 *
 * The seeded "Audit Lead" role exists and is exercised for real by
 * `apps/api/test/unit/audit-engagement-write-implies-read.spec.ts` and by
 * `audit-engagement-scope.spec.ts` (T084, which specifically needs its
 * NARROW, unit-scoped grant). This journey needs no such narrowness — it
 * needs `audit-engagement:*`, `finding:*`, `control:view` AND `risk:create`
 * (to plant a fixture risk to host the finding lifecycle) AND `risk:view`
 * all at once, plus `evidence:*` to attach the closing evidence — exactly
 * the same "fully-privileged, arbitrary identity" every other
 * cross-cutting journey in this directory already uses
 * `signInAsWorkerAdmin` for (`grc-foundation.spec.ts`, `risk-treatment
 * .spec.ts`), rather than assembling a bespoke permission set for a
 * scenario that is not testing authorization boundaries.
 *
 * ## Why a risk hosts the finding lifecycle actions, not the engagement's
 * own "Achados" tab
 *
 * `EngagementFindingsSection` (the engagement detail's own "Achados" tab)
 * only LISTS what an engagement produced and lets an operator RECORD a new
 * one — it renders no remediation/close/link affordances at all (see its
 * own header comment). Those live on `FindingsPanel`, mounted on a RISK's
 * own "Achados" tab, scoped by organizational unit rather than by a
 * persisted Finding-to-Risk link (`findings-panel.tsx`'s own header
 * comment — Phase 1 gave `Finding` no such link). So this spec creates ONE
 * fixture risk under the SAME organizational unit as the engagement, and
 * drives the rest of the lifecycle from that risk's own "Achados" tab —
 * the identical hybrid shape `grc-foundation.spec.ts` (T080) already
 * established for the same underlying gap.
 *
 * ## Hybrid step: linking evidence to the FINDING subject
 *
 * There is still no rendered UI to link an `Evidence` record to a
 * `FINDING` subject (`grc-foundation.spec.ts`'s own documented gap,
 * unchanged by this phase) — evidence is registered AND linked to the
 * fixture RISK through the real "Nova evidência" flow, then linked a
 * SECOND time to the FINDING subject via `page.request`, sharing this
 * page's own session cookie exactly like T080's identical hybrid step.
 * FR-010's evidence requirement only asks for an ACTIVE link of any kind —
 * this satisfies it without inventing a UI surface this phase never built.
 *
 * ## Every registry picker below selects `.first()`, never a named fixture
 *
 * `AuditScopeControlPicker` and `FindingLinksSection`'s two pickers all
 * call their own `GET /controls`/`GET /risks` with an EMPTY search term and
 * no live search box — a flat, unfiltered top-`pageSize` listing, exactly
 * like `RiskControlsSection`'s established convention
 * (`risk-treatment.spec.ts` already selects a NAMED fixture control there
 * only because the whole catalog was small when that spec was written).
 * This developer database has since accumulated 40+ controls and 480+
 * risks from repeated E2E/UI-capture runs — verified directly against the
 * running database, not assumed — so a NAMED target (e.g.
 * `FIXTURE-CONTROL-1`, whose code sorts alphabetically after the
 * `CTL-2026-*` codes now ahead of it) is no longer guaranteed to appear on
 * the first `pageSize` page these pickers fetch, while `.first()` always
 * resolves to whatever IS on that page — the same reasoning
 * `admin-access.spec.ts` already documents for its own owner picker.
 * `.first()`'s own rendered label is captured and asserted back, so this
 * still proves the SPECIFIC picked item lands in the resulting list, not
 * merely "something" did.
 *
 * F-43 (`docs/deferred-findings.md`): a login failure in this suite may be
 * the login throttle, not a wrong password — this spec never re-attempts a
 * sign-in in a way that could trip it, and does not "fix" that helper.
 */
test.describe('Audit engagement: created -> scoped -> started -> finding -> remediation -> closure -> links (US1-US3)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real audit engagement journey.',
  );

  test('records an engagement end to end, through the real UI, with one hybrid evidence-link step', async ({
    page,
  }, testInfo) => {
    // A long, multi-screen journey (create risk, create evidence, create
    // engagement, scope, start, record finding, remediate, close, link
    // control, link risk) — mirrors `grc-foundation.spec.ts`'s own 90s
    // budget for a comparable shape.
    test.setTimeout(90_000);

    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const riskTitle = `Risco para engajamento de auditoria E2E ${uniqueSuffix}`;
    const evidenceTitle = `Evidência de engajamento de auditoria E2E ${uniqueSuffix}`;
    const engagementObjective = `Engajamento de auditoria E2E ${uniqueSuffix}`;
    const findingTitle = `Achado de engajamento de auditoria E2E ${uniqueSuffix}`;

    function dateOnly(daysFromNow: number): string {
      const date = new Date();
      date.setDate(date.getDate() + daysFromNow);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // --- Fixture risk, under "Division A / Team 1 (fixture)" — hosts the
    // finding lifecycle actions (see this file's own header comment) ------
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(riskTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco criado para hospedar o achado do E2E de engajamento de auditoria (T083).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: 'Division A / Team 1 (fixture)' }).click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    const riskId = page.url().split('/').pop()!;

    // --- Register+link an evidence to the risk, through the real "Nova
    // evidência" flow — this is what gets linked a SECOND time to the
    // FINDING subject later, via the hybrid step (no UI for that link) ----
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
    await page
      .getByLabel('Observação', { exact: true })
      .fill('Evidência registrada para o fechamento do achado do E2E de auditoria (T083).');
    await page.getByRole('button', { name: 'Registrar e vincular' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(evidenceTitle)).toBeVisible();

    // --- Create the audit engagement, same organizational unit ------------
    await page.goto('/audits/new');
    await expect(
      page.getByRole('heading', { name: 'Novo engajamento de auditoria' }),
    ).toBeVisible();
    await page.getByLabel('Objetivo').fill(engagementObjective);
    await page.getByLabel('Início do período').fill(dateOnly(-7));
    await page.getByLabel('Fim do período').fill(dateOnly(90));
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option', { name: 'Division A / Team 1 (fixture)' }).click();
    await page.getByRole('combobox', { name: /Auditor responsável/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Abrir engajamento' }).click();
    await page.waitForURL(/\/audits\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: engagementObjective })).toBeVisible();

    // --- Scope: add a control (FR-005) — `.first()`, per this file's own
    // header comment on why a named fixture is no longer reliable here ----
    await page.getByRole('tab', { name: 'Escopo' }).click();
    await expect(page.getByText('Nenhum item no escopo deste engajamento ainda.')).toBeVisible();
    await page.getByRole('tab', { name: 'Controle' }).click();
    await page.getByRole('combobox', { name: 'Controle' }).click();
    const scopeControl = await pickFirstNameCodeOption(page);
    await page.getByRole('button', { name: 'Adicionar' }).click();
    // The scope table's `target.label` for a CONTROL entry is the joined
    // `"{code} — {name}"` string (`prisma-audit-scope.repository.ts`'s own
    // `createControlLink` mapping) — a DIFFERENT composition than the
    // picker's own `"{name} ({code})"` option text, reconstructed here so
    // this proves the SPECIFIC control picked lands in scope, by its own
    // unique code, not merely that some row appeared.
    await expect(page.getByText(`${scopeControl.code} — ${scopeControl.name}`)).toBeVisible();

    // --- Start the engagement (FR-002, FR-003) — the "no scope" precondition
    // notice must have cleared once the entry above is visible, and the
    // start button must become enabled WITHOUT a page reload (the exact
    // regression `AuditEngagementLifecycleActions`' own `scopeChangeToken`
    // exists to prevent, per this module's own STATE.md §4) ---------------
    const startButton = page.getByRole('button', { name: 'Iniciar engajamento' });
    await expect(startButton).toBeEnabled({ timeout: 10_000 });
    await startButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Iniciar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Em execução', { exact: true })).toBeVisible();

    // --- Record a finding from the engagement (US2, FR-007/FR-008) --------
    await page.getByRole('tab', { name: 'Achados' }).click();
    await page.getByRole('button', { name: 'Registrar achado' }).click();
    await expect(page.getByRole('heading', { name: 'Registrar achado' })).toBeVisible();
    await page.getByLabel('Título').fill(findingTitle);
    await page
      .getByLabel('Descrição')
      .fill('Deficiência de controle identificada pelo engajamento de auditoria E2E (T083).');
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

    // --- Hybrid: resolve the finding id (`GET /audits/{id}/findings`, the
    // page URL after create) and the evidence id (`GET
    // /evidence?subjectType=RISK&subjectId=`), then link the evidence to
    // the FINDING subject — no rendered UI for this one link, per this
    // file's own header comment --------------------------------------------
    const auditId = /\/audits\/([0-9a-fA-F-]+)/.exec(page.url())![1]!;
    const findingsResponse = await page.request.get(
      `/api/v1/audits/${auditId}/findings?page=1&pageSize=100`,
    );
    expect(findingsResponse.ok(), await describeFailure(findingsResponse)).toBe(true);
    const findingsPage = (await findingsResponse.json()) as {
      data: readonly { id: string; title: string }[];
    };
    const findingId = findingsPage.data.find((item) => item.title === findingTitle)?.id;
    expect(
      findingId,
      'the just-created finding must be findable via GET /audits/{id}/findings',
    ).toBeDefined();

    const evidenceListResponse = await page.request.get(
      `/api/v1/evidence?subjectType=RISK&subjectId=${riskId}&pageSize=100`,
    );
    expect(evidenceListResponse.ok(), await describeFailure(evidenceListResponse)).toBe(true);
    const evidencePage = (await evidenceListResponse.json()) as {
      items: readonly { id: string; title: string }[];
    };
    const evidenceId = evidencePage.items.find((item) => item.title === evidenceTitle)?.id;
    expect(
      evidenceId,
      'the just-created evidence must be findable via GET /evidence',
    ).toBeDefined();

    const linkResponse = await page.request.post(`/api/v1/evidence/${evidenceId}/links`, {
      headers: { Origin: new URL(page.url()).origin },
      data: {
        subjectType: 'FINDING',
        subjectId: findingId,
        note: 'Vínculo criado via hybrid setup (T083) — sem superfície de UI para este passo.',
      },
    });
    expect(linkResponse.ok(), await describeFailure(linkResponse)).toBe(true);

    // --- Move the finding to remediation (US2, FR-009), from the risk's
    // own "Achados" tab (see this file's own header comment) ---------------
    await page.goto(`/risks/${riskId}`);
    await expect(page.getByRole('heading', { name: riskTitle })).toBeVisible();
    // Same reason as the "Evidência" fix above — "Achados" is also a leaf
    // under "Relacionamentos" now.
    await openRiskDetailSection(page, 'findings');
    const findingCard = page.getByRole('listitem').filter({ hasText: findingTitle });
    await expect(findingCard).toBeVisible();
    await expect(findingCard.getByText('Aberto', { exact: true })).toBeVisible();

    await expandFinding(findingCard, findingTitle);
    await findingCard.getByRole('button', { name: 'Mover para remediação' }).click();
    const remediationDialog = page.getByRole('dialog');
    await expect(remediationDialog).toBeVisible();
    await remediationDialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(remediationDialog).toBeHidden();
    await expect(findingCard.getByText('Em remediação', { exact: true })).toBeVisible();

    // --- Close with evidence (FR-010) — the evidence link created above ---
    // already satisfies the ADDITIVE requirement; a justification satisfies
    // the pre-existing one (Invariant F1, no completed action was created
    // in this journey) ------------------------------------------------------
    await findingCard.getByRole('button', { name: 'Encerrar' }).click();
    const closeDialog = page.getByRole('dialog');
    await expect(closeDialog.getByRole('heading', { name: 'Encerrar achado' })).toBeVisible();
    // The evidence-missing warning must NOT show — the link was already made.
    await expect(closeDialog.getByText('Encerrar um achado agora exige evidência')).toHaveCount(0);
    await closeDialog
      .getByLabel('Justificativa')
      .fill('Remediação concluída e evidenciada — encerrado pelo E2E de auditoria (T083).');
    await closeDialog.getByRole('button', { name: 'Encerrar' }).click();
    await expect(closeDialog).toBeHidden();
    await expect(findingCard.getByText('Encerrado', { exact: true })).toBeVisible();

    // --- Link the finding to a control (US3, FR-013/FR-014) — `.first()`,
    // per this file's own header comment -------------------------------------
    //
    // Front H (D-17): the picker's own trigger is now `SearchablePicker`,
    // whose accessible name is `pickerAriaLabel` ("Selecionar controle") —
    // deliberately DIFFERENT from the adjacent button's "Vincular
    // controle", now that they are two distinct controls with two distinct
    // purposes (select vs. link), where the old `<Select>` trigger
    // happened to share the button's own label.
    await findingCard.getByRole('combobox', { name: 'Selecionar controle' }).click();
    const linkedControl = await pickFirstNameCodeOption(page);
    await findingCard.getByRole('button', { name: 'Vincular controle' }).click();
    // `FindingLinksSection`'s own link table renders name/code as two
    // SEPARATE cells (`finding-links-section.tsx`'s `ref.name`/`ref.code`),
    // unlike the scope table's joined label above — asserted the same way.
    await expect(findingCard.getByText(linkedControl.name, { exact: true })).toBeVisible();
    await expect(findingCard.getByText(linkedControl.code, { exact: true })).toBeVisible();

    // --- Link the finding to a risk (US3, FR-015/FR-016) — `.first()` -----
    await findingCard.getByRole('combobox', { name: 'Selecionar risco' }).click();
    const linkedRisk = await pickFirstNameCodeOption(page);
    await findingCard.getByRole('button', { name: 'Vincular risco' }).click();
    await expect(findingCard.getByText(linkedRisk.name, { exact: true })).toBeVisible();
    await expect(findingCard.getByText(linkedRisk.code, { exact: true })).toBeVisible();
  });
});

/**
 * Every registry picker this spec drives (scope control, finding->control,
 * finding->risk) renders its options as `"{name} ({code})"`
 * (`audit-scope-control-picker.tsx`/`finding-links-section.tsx`'s own
 * shared `RelationshipSubsection` — both compose options this exact way).
 * Opens the ALREADY-CLICKED combobox's listbox, waits for its first option,
 * parses that shared shape, and clicks it — returning what was picked so
 * the caller can assert it landed wherever it was supposed to (see this
 * file's own header comment on why `.first()`, never a named fixture).
 */
/**
 * Front H (D-17): the registry pickers this spec drives are now
 * `SearchablePicker` (`packages/design-system/src/components/form
 * /searchable-picker.tsx`), whose option renders name and code as two
 * SEPARATE visible `<span>`s (a free line-break for sighted users), not
 * one `"{name} ({code})"` string the old `<Select>` rendered as a single
 * text node. Reading each span independently — rather than parsing one
 * concatenated `.textContent()` with a regex — is correct regardless of
 * how the two are visually separated or joined for assistive tech; it is
 * also the fix for a real defect this rewrite found (2026-09-11, CI):
 * `.textContent()` here would have silently returned the two fused with
 * NO separator at all ("NameCTL-2026-0001"), because `.textContent()`
 * reads raw DOM text nodes and is blind to the `aria-label` the component
 * now carries for its ACCESSIBLE name — a plain-text parse of visible
 * content was never going to reflect that fix, or protect against its
 * absence, which is exactly why this helper now reads the two structured
 * fields directly instead of reverse-engineering a formatted string.
 */
/**
 * 016-risk-detail-experience, Área 5 (2026-09-17) — every finding row is now
 * a collapsed `DisclosureGroup` by default: only status/severity fold into
 * the toggle's own accessible name (code + title), and `DisclosureGroup`
 * UNMOUNTS everything else — including "Mover para remediação"/"Encerrar"
 * and the control/risk link pickers below — while collapsed
 * (`findings-panel.tsx`'s own header comment; `design-system.test.tsx`'s
 * `DisclosureGroup` suite documents the same "absent, not merely hidden"
 * contract). Mirrors `findings-panel.test.tsx`'s own `expandFinding` helper.
 * One expansion is enough for the whole remediate/close/link sequence below
 * — the group stays open until this same toggle is clicked again.
 */
async function expandFinding(findingCard: Locator, title: string): Promise<void> {
  await findingCard.getByRole('button', { name: new RegExp(title) }).click();
}

async function pickFirstNameCodeOption(page: Page): Promise<{ name: string; code: string }> {
  const firstOption: Locator = page.getByRole('option').first();
  await expect(firstOption).toBeVisible({ timeout: 10_000 });
  const spans = firstOption.locator('span.truncate');
  const name = (await spans.first().textContent())!.trim();
  const code = (await spans.nth(1).textContent())!.trim();
  if (!name || !code) {
    throw new Error(`Unexpected option shape: name="${name}", code="${code}"`);
  }
  await firstOption.click();
  return { name, code };
}

/** Formats a failed `page.request` response for a test assertion message —
 * status plus body, mirroring `grc-foundation.spec.ts`'s identical helper. */
async function describeFailure(response: APIResponse): Promise<string> {
  if (response.ok()) return '';
  return `expected 2xx, got ${String(response.status())}: ${await response.text()}`;
}
