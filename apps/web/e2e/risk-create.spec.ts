import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';

/**
 * T082 — E2E: create a risk in draft, edit it, and verify persistence
 * (US2, FR-053 to FR-060, FR-103).
 *
 * Runs against a real backend (`apps/api`), seeded per
 * `apps/api/prisma/seed/platform.seed.ts`, exactly like `auth.spec.ts`.
 * Skips itself with a clear reason when `SEED_ADMIN_EMAIL`/
 * `SEED_ADMIN_PASSWORD` are not set, rather than failing in a way that
 * looks like a real regression — see `support/admin-session.ts` for the
 * shared sign-in helper and its own re-runnability notes.
 *
 * The seeded Platform Administrator is used because it is guaranteed to
 * hold every permission this journey needs (`risk:create`, `risk:view`,
 * `risk:edit`) and to have at least one organizational unit and one
 * directory user (itself) available to the create form's selects,
 * regardless of what other fixtures a given environment does or doesn't
 * seed with `SEED_DEV_FIXTURES`.
 *
 * ## Accessible-name collision note (see CLAUDE.md's warning)
 *
 * `getByLabel('Título')` / `getByLabel('Descrição')` etc. match by
 * substring against the *full* accessible name, which includes the
 * screen-reader-only " (obrigatório)" suffix `FormField` appends to every
 * required field's label (`packages/design-system/src/components/form/form-field.tsx`).
 * That is safe here because no two field labels on this form share a
 * prefix (unlike, say, a future "Causa" vs. "Causa raiz" pairing) — this is
 * asserted implicitly by every `getByLabel` below matching exactly one
 * element, which Playwright itself enforces by throwing a strict-mode
 * violation otherwise.
 */
test.describe('Create, edit and verify persistence of a risk (US2)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real risk-creation journey.',
  );

  test('creates a draft risk, edits it, and the edit survives a reload from the register', async ({
    page,
  }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);

    const uniqueSuffix = Date.now().toString(36);
    const originalTitle = `Falha no fornecedor crítico ${uniqueSuffix}`;
    const editedTitle = `Falha no fornecedor crítico ${uniqueSuffix} (revisado)`;
    const description = 'Dependência de um único fornecedor sem plano de contingência formal.';

    // --- Create (FR-053 to FR-056) ---------------------------------------
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();

    await page.getByLabel('Título').fill(originalTitle);
    await page.getByLabel('Descrição').fill(description);

    // Organizational unit and owner are required to leave DRAFT (FR-055).
    // The unit is the seeded root, picked BY NAME (never `.first()` — see
    // `support/org-units.ts`'s own header for why picking "whatever sorts
    // first" is unsafe on a long-lived local database); the owner is
    // whatever the seed always provides at least one of within that unit's
    // line (the signed-in administrator).
    await selectSeededRootOrgUnit(page);

    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: 'Criar risco' }).click();

    // A successful create navigates to the new risk's own detail page
    // (`risk-form.tsx`'s `onSubmit`) — the URL itself proves the server
    // assigned an id (FR-054), not just that the form accepted local input.
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });

    await expect(page.getByRole('heading', { name: originalTitle })).toBeVisible();
    // The server-assigned, human-readable code is real and shown (FR-054) —
    // never a client-side placeholder. `.first()`, not a bare match:
    // 016-risk-detail-experience gave the header a breadcrumb
    // ("Riscos › RSK-2026-0001") that legitimately repeats the same code
    // right above `EntityHeader`'s own code line — two correct renderings of
    // the same fact, not a naming defect, so this only needs ONE of them to
    // prove the code is real (CLAUDE.md's accessible-name-collision note).
    await expect(page.getByText(/^RSK-/).first()).toBeVisible();
    // Scoped to `<header>` (EntityHeader's own element): `{ exact: true }`
    // alone used to be enough to disambiguate the status badge ("Rascunho")
    // from the transient success toast ("Risco criado como rascunho.", a
    // substring match away) — 016-risk-detail-experience's lifecycle spine
    // added a THIRD exact-text "Rascunho" (its own "Posições principais do
    // ciclo" list, one label per position), found running this spec in
    // isolation after the coordinator's HEAD `69d3959` (strict-mode
    // violation, 2 matches). The spine list renders inside the page's main
    // content, never inside the header, so this scoping survives that
    // addition without depending on DOM order between the header and a
    // portal-rendered toast.
    await expect(page.locator('header').getByText('Rascunho', { exact: true })).toBeVisible();

    const riskUrl = page.url();

    // --- Edit (US2 AS3) ---------------------------------------------------
    await page.getByRole('button', { name: 'Editar' }).click();
    const titleField = page.getByLabel('Título');
    await titleField.fill('');
    await titleField.fill(editedTitle);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();

    // The Overview section reflects the update in place, no full reload.
    await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();

    // --- Verify persistence (T082's explicit requirement) -----------------
    // Navigate away and back via a fresh document load — not a client-side
    // route transition — so this genuinely re-reads the server's stored
    // state rather than trusting in-memory React state that a bug could
    // have left stale.
    await page.goto('/dashboard');
    await page.goto(riskUrl);

    await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();
    // `{ exact: true }`: `originalTitle` is a literal prefix of `editedTitle`
    // (`"${originalTitle} (revisado)"`), and Playwright's accessible-name
    // `name` matcher is a substring match by default — so the still-present
    // `editedTitle` heading would otherwise itself satisfy a non-exact query
    // for `originalTitle`, defeating this assertion's actual purpose (that
    // the OLD title is gone, not merely that some heading contains it).
    await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toHaveCount(0);
  });
});
