import { expect, test } from '@playwright/test';

import {
  requireSeedCredentials,
  seedPassword,
  signInAsFreshlyProvisionedUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';

/**
 * T175 — E2E: create a scoped user and verify their granted and denied
 * actions (US8, FR-021, FR-023, FR-025a, FR-025b, FR-028, FR-030). This is
 * the real proof the whole authorization model works: an administrator
 * provisions a user through the UI (T181), grants it the `Risk Analyst`
 * role (T182) and a `UNIT` scope grant over `DIV-A-TEAM-1` (T183), then a
 * fresh sign-in as that exact user demonstrates:
 *
 *   - GRANTED: `risk:create` (from the role) inside the one organizational
 *     unit its scope actually covers.
 *   - DENIED: every Administration action (no `user:administer` /
 *     `role:administer` / `org_unit:administer` was ever granted) — hidden
 *     from navigation (FR-042, advisory) AND refused by the server
 *     independently of that (ADR-003 — hiding a control is never the real
 *     boundary).
 *   - DENIED: a risk that exists OUTSIDE the granted unit (the root unit —
 *     an ANCESTOR of `DIV-A-TEAM-1`, not itself covered by a `UNIT` grant on
 *     a descendant) collapses to "not found", not a 403 that would disclose
 *     it exists (FR-030).
 *
 * Runs against a real backend, seeded per
 * `apps/api/prisma/seed/platform.seed.ts` with `SEED_DEV_FIXTURES=true`
 * (for the `DIV-A`/`DIV-A-TEAM-1` organizational units this spec grants
 * scope over — the same tree `risk-approval.spec.ts` and
 * `docs/deferred-findings.md`'s F-15 already document). Skips itself with a
 * clear reason when `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are not set,
 * like every other spec in this directory.
 *
 * ## Two Playwright strict-mode/browser hazards found here (CLAUDE.md's own
 * warning), both fixed by a more specific locator, never by inventing a
 * new name
 *
 * 1. `page.getByText(<the role's name>, { exact: true })`, unscoped, resolves
 *    to TWO elements once the roles dialog is open: the checklist's own
 *    role-name span AND the users table's "Roles" cell underneath, for a
 *    DIFFERENT, already-seeded fixture user whose role happens to be named
 *    identically. Radix marks the page behind an open dialog `aria-hidden`,
 *    which correctly excludes it from `getByRole`/`getByLabel` queries —
 *    but `getByText` is a plain DOM text scan, not accessibility-tree-aware,
 *    so it is not excluded there. Fixed by scoping the locator to the open
 *    dialog (`rolesDialog.getByText(...)`).
 * 2. The organizational-unit tree's own row-actions button
 *    (`aria-label="Ações para Division A / Team 1 (fixture)"`) also
 *    CONTAINS that unit's name, so an unanchored
 *    `getByRole('button', { name: /Division A \/ Team 1/ })` matches both
 *    it and the node's own selection button. Fixed with a `^`-anchored
 *    regex against the name the selection button actually STARTS with.
 * 3. A REAL, REPRODUCED Firefox-only defect (not a locator problem, not
 *    Radix's — `docs/deferred-findings.md` F-17, closed by T203): opening
 *    the risk form's "Unidade organizacional" picker and clicking an option
 *    named several items down the list (`Division B (fixture)`, the LAST
 *    option) left the listbox open indefinitely in Firefox. Root-caused to
 *    `apps/web/src/components/ui/select.tsx` overriding
 *    `SelectContent`'s `position` default from shadcn/ui's own `"popper"`
 *    to `"item-aligned"` — Radix's item-aligned realignment interacts badly
 *    with Firefox's pointerdown/pointerup pair for a distant item. Fixed by
 *    restoring the `"popper"` default; re-verified directly in Firefox
 *    (selecting `Division B (fixture)` by name, not `.first()`, closes the
 *    listbox correctly). `.first()` remains below because it is also the
 *    semantically correct choice here (the root unit is deliberately an
 *    ancestor of `DIV-A-TEAM-1`, never a descendant — see the comment at
 *    its own call site) — not because a workaround is still needed.
 */
test.describe('An administrator creates a scoped user and its grants are enforced (US8)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real administration journey.',
  );

  // --- Teardown (F-34, docs/deferred-findings.md) ---------------------------
  // This spec used to create a fresh user on every run and never remove it.
  // Measured consequence on a long-lived development database: 37 of 44
  // users were orphaned fixtures, and the "Gestor do risco" combobox began
  // timing out under the load of listing them all. CI itself was unaffected
  // (ephemeral database, wiped between runs), which is why this was Medium
  // rather than High — but it is real damage on any shared/long-lived
  // backend this spec is pointed at.
  //
  // `createdUserFullName` is set by the test itself, right after creation
  // succeeds, and read back here — `afterEach` runs regardless of whether
  // the test passed or failed partway through, so a user is deactivated
  // even if a LATER assertion throws. It is intentionally a `let` closed
  // over by both the test and this hook (this file declares exactly one
  // test, so there is no cross-test aliasing risk). Named distinctly from
  // the test's own local `fullName` constant (assigned into this one right
  // after creation) rather than reusing that identifier at this outer
  // scope, which would only shadow it silently.
  //
  // Deactivation runs on a SEPARATE, freshly-authenticated (admin) page
  // rather than the test's own `page`: by the time this spec ends, `page`'s
  // active session has deliberately been switched to the newly-created,
  // deliberately-unprivileged user itself (the whole point of the test) —
  // it holds no `user:administer` grant and cannot deactivate itself. A
  // second `browser.newContext()` (the same pattern `risk-register.spec.ts`
  // already uses for its own dedicated admin session) is independent of
  // whatever state the test's own `page` ends in, including a mid-test
  // failure that left it on an unexpected screen.
  //
  // `PUT /admin/users/{id}/status` -> `INACTIVE` (what this drives, via the
  // real UI rather than a raw API call — consistent with this spec never
  // calling the API directly anywhere else) already removes a user from the
  // directory listing entirely, which is what actually fixes the "Gestor do
  // risco" combobox regression: an inactive user is no longer a candidate
  // there.
  let createdUserFullName: string | undefined;

  /**
   * The pt-BR LABEL of the seeded `Risk Analyst` role, not its stored name
   * (ADR-022). `UserRolesDialog` prints every role through `roleDisplayName`,
   * so the checklist row a click has to hit reads "Analista de Riscos" — the
   * English string is what `Role.name` holds and what the API answers with,
   * and it is nowhere on this screen. Named rather than inlined so the next
   * reader can see which of a role's two names this assertion wants.
   */
  const RISK_ANALYST_LABEL = 'Analista de Riscos';

  test.afterEach(async ({ browser }, testInfo) => {
    if (!createdUserFullName) return;
    const cleanupContext = await browser.newContext();
    try {
      const cleanupPage = await cleanupContext.newPage();
      await signInAsWorkerAdmin(cleanupPage, testInfo);
      await cleanupPage.goto('/admin/users');
      await cleanupPage.getByLabel('Buscar usuários').fill(createdUserFullName);
      const row = cleanupPage.getByRole('row').filter({ hasText: createdUserFullName });
      await row.getByRole('button', { name: /Ações para/ }).click();
      await cleanupPage.getByRole('menuitem', { name: 'Desativar' }).click();
      // Scoped to the open dialog, not a bare page-wide query — the same
      // fix the roles-dialog step above already needed for its own
      // ambiguous "Risk Analyst" text match (this file's own header
      // comment, hazard #1): `UserStatusDialog`'s confirm button shares its
      // exact label ("Desativar") with the row-actions menu item just
      // clicked to open it.
      const statusDialog = cleanupPage.getByRole('dialog');
      await statusDialog.getByRole('button', { name: 'Desativar', exact: true }).click();
      await expect(
        cleanupPage.getByText('Usuário desativado e suas sessões foram encerradas.'),
      ).toBeVisible();
    } finally {
      await cleanupContext.close();
      createdUserFullName = undefined;
    }
  });

  test('the new user can do what its role and scope grant allow, and nothing else', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    await signInAsWorkerAdmin(page, testInfo);

    // `Date.now()` alone is the sole uniqueness mechanism most specs in
    // this directory use for parallel test data, and it CAN collide: two
    // workers landing in the same millisecond produce the same suffix
    // (assurance-audit note). A random component makes that collision
    // astronomically unlikely without changing this spec's own structure —
    // fixed here, where this spec's own teardown (F-34, above) already
    // makes a collision's blast radius worse than usual (two tests
    // deactivating/racing over what looks like the same user). Left
    // unchanged in every OTHER spec in this directory — this file is the
    // one this task's brief actually touched, and a directory-wide rename
    // is a separate, broader change than "while you are there."
    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // --- Admin plants a risk OUTSIDE the scope the new user will hold ------
    // (the root unit — an ANCESTOR of `Division A`/`DIV-A-TEAM-1`, never a
    // descendant of it, so a `UNIT` grant on `DIV-A-TEAM-1` never covers it;
    // scope expands only to descendants, FR-025b).
    const outOfScopeTitle = `Risco fora do escopo E2E ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(outOfScopeTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência fora do escopo concedido ao usuário do E2E (T175).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    // The root unit (`PharosGRC`, always this select's FIRST option here —
    // ADR-004's materialized-path order) is deliberately used instead of
    // naming a specific fixture unit: it is never a descendant of
    // `DIV-A-TEAM-1`, so it is just as much "outside the granted UNIT
    // scope" as any sibling unit, and — unlike naming a unit further down
    // the list — needs no scrolling to reach. A REAL, reproduced Firefox
    // flake was found selecting a lower option by name here (the select
    // stayed open, its listbox item never registering the click, timing
    // out the NEXT locator instead) while `.first()` is exactly what
    // `risk-create.spec.ts` already relies on for this same picker.
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const outOfScopeRiskUrl = page.url();

    // --- Create the scoped user (T181, FR-021) ------------------------------
    const email = `e2e-scoped-${uniqueSuffix}@pharosgrc.local`;
    const fullName = `Usuário Escopo E2E ${uniqueSuffix}`;
    const initialPassword = `${seedPassword}-Scoped-1`;

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();
    await page.getByRole('button', { name: 'Novo usuário' }).click();
    await expect(page.getByRole('heading', { name: 'Novo usuário' })).toBeVisible();
    await page.getByLabel('Nome completo').fill(fullName);
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha inicial').fill(initialPassword);
    await page.getByRole('button', { name: 'Criar usuário' }).click();
    await expect(page.getByText('Usuário criado com sucesso.')).toBeVisible();
    // From here on, the user genuinely exists on the backend — `afterEach`
    // must deactivate it even if a later assertion in this test throws
    // (F-34, docs/deferred-findings.md).
    createdUserFullName = fullName;

    // The users list is sorted alphabetically by name and paginated
    // (F-29, docs/deferred-findings.md): on anything past a single page of
    // seeded/fixture users, the row this test just created is not
    // guaranteed to land on page one, and `getByText(email)`/a bare
    // `getByRole('row')` filter would then find nothing — a failure that
    // looks like flakiness but is actually a correctness assumption about
    // directory size. Searching (the same `q` the register's own search box
    // sends to `GET /admin/users`, matched against full name OR e-mail)
    // narrows the list down to exactly this user regardless of how many
    // other users exist or how many pages that spans — mirrors
    // `risk-register.spec.ts`'s identical use of its own search box for the
    // identical reason.
    await page.getByLabel('Buscar usuários').fill(email);
    await expect(page.getByText(email)).toBeVisible();

    // --- Grant the "Risk Analyst" role (T182, FR-023) -----------------------
    const userRow = page.getByRole('row').filter({ hasText: fullName });
    await userRow.getByRole('button', { name: /Ações para/ }).click();
    await page.getByRole('menuitem', { name: 'Papéis' }).click();
    const rolesDialog = page.getByRole('dialog');
    await expect(rolesDialog.getByRole('heading', { name: `Papéis de ${fullName}` })).toBeVisible();
    // Scoped to the dialog: `getByText` (unlike `getByRole`/`getByLabel`) is
    // not accessibility-tree-aware, so an un-scoped query also matches the
    // users table underneath — Radix marks it `aria-hidden` while the modal
    // is open, but that only hides it from role/label queries, not a plain
    // text scan. A genuine under-specified locator (CLAUDE.md's warning),
    // fixed by scoping rather than by the exact-text change alone.
    await rolesDialog.getByText(RISK_ANALYST_LABEL, { exact: true }).click();
    await rolesDialog.getByRole('button', { name: 'Salvar papéis' }).click();
    await expect(page.getByText('Papéis atualizados com sucesso.')).toBeVisible();

    // --- Grant UNIT scope over Division A / Team 1 (T183, FR-025a/b) -------
    await page.goto('/admin/organization');
    await expect(page.getByRole('heading', { name: 'Estrutura organizacional' })).toBeVisible();
    // `^`-anchored: the tree row also carries an "Ações para Division A /
    // Team 1 (fixture)" row-actions button, whose name also CONTAINS this
    // text — an under-specified locator otherwise (CLAUDE.md's warning),
    // fixed by anchoring to the name this node's own SELECTION button
    // actually starts with, not the row-actions button's.
    await page.getByRole('button', { name: /^Division A \/ Team 1/ }).click();
    await page.getByLabel('Buscar usuário').fill(fullName);
    await page.getByRole('button', { name: new RegExp(fullName) }).click();
    await expect(page.getByRole('heading', { name: `Escopo de ${fullName}` })).toBeVisible();
    await page.getByRole('button', { name: 'Conceder escopo' }).click();
    await expect(page.getByText('Escopo concedido com sucesso.')).toBeVisible();

    // --- A fresh sign-in as the new user proves the grant, not a cached ----
    // in-memory permission set from the administrator's own session. This
    // account was created (and its password set) by THIS test, seconds
    // ago, through the real UI — its password is known, not merely
    // guessed at, so `signInAsFreshlyProvisionedUser` (no rotated-first
    // probe) is correct here, not `signInAsSeededUser` (built for accounts
    // of genuinely unknown state). D-17/research.md step 3, generalized to
    // every call site sharing the pattern, not only the reported one.
    await signOut(page);
    await signInAsFreshlyProvisionedUser(page, email, initialPassword);

    // --- DENIED: no administrative permission was ever granted -------------
    // Hidden from navigation (FR-042, advisory)...
    await expect(page.getByRole('link', { name: 'Usuários' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Papéis e permissões' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Estrutura organizacional' })).not.toBeVisible();
    // ...and refused independently by the server (ADR-003 — a hidden control
    // is never the real boundary): the create action never renders because
    // the page's own data fetch is refused, not merely the button.
    await page.goto('/admin/users');
    await expect(page.getByRole('button', { name: 'Novo usuário' })).not.toBeVisible();

    // --- DENIED: a risk outside this user's UNIT scope is "not found", ----
    // never a 403 that would disclose its existence (FR-030).
    await page.goto(outOfScopeRiskUrl);
    await expect(page.getByText('Risco não encontrado')).toBeVisible();

    // --- GRANTED: risk:create (via Risk Analyst), inside the one ------------
    // organizational unit this user's UNIT scope actually covers — the org
    // unit picker offers exactly one option, exactly like
    // `risk-approval.spec.ts` already found for this same fixture unit.
    const inScopeTitle = `Risco dentro do escopo E2E ${uniqueSuffix}`;
    await page.goto('/risks/new');
    await expect(page.getByRole('heading', { name: 'Novo risco' })).toBeVisible();
    await page.getByLabel('Título').fill(inScopeTitle);
    await page
      .getByLabel('Descrição')
      .fill('Risco de evidência dentro do escopo concedido ao usuário do E2E (T175).');
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();

    /*
     * F-34's real regression guard: an analyst scoped to a LEAF unit must be
     * able to name an owner who sits in an ANCESTOR unit.
     *
     * This user holds a `UNIT` grant on `DIV-A-TEAM-1`, whose ancestors are
     * `DIV-A` and `ROOT`. Organizational scope expands to descendants and
     * never upward, so while the owner picker was fed by the caller's browse
     * scope this list was EMPTY — no active user has `DIV-A-TEAM-1` as their
     * primary unit — and the required field could not be filled at all. The
     * combobox timing out here was the symptom F-34 originally misread as
     * the directory being too large.
     *
     * `Platform Administrator` is seeded with `ROOT` as its primary unit
     * (`prisma/seed/platform.seed.ts`), so its presence is precisely the
     * "owner in an ancestor unit" guarantee — asserted by name rather than
     * by a non-zero option count, which a single self-assignable row would
     * satisfy without proving anything about the upward line.
     */
    await page.getByRole('combobox', { name: /Gestor do risco/ }).click();
    /*
     * `exact: true` is load-bearing, not defensive. Playwright's accessible-name
     * matching is substring-based by default, and the seed also creates
     * "Fixture — Platform Administrator" — so the loose form resolved to TWO
     * options on a freshly seeded database and failed strict mode, while
     * passing locally where only one of the two happens to sit in the assignment
     * line. This is the accessible-name collision CLAUDE.md warns about and
     * that this file's own header already documents; it cost a red CI run.
     */
    //
    // S-10 (`specs/013-stabilization-audit`): the owner field is now a
    // server-searched `UserPicker` (first page of 20), and each option's
    // accessible name is "fullName email". So the user is found by search,
    // and the exact-name guarantee above is kept by anchoring at the START of
    // the accessible name — "Fixture — Platform Administrator" still cannot
    // match, and `assignableForOrgUnitId` still decides what the search returns.
    await page.getByPlaceholder('Buscar por nome ou e-mail…').fill('Platform Administrator');
    const ancestorOwnerOption = page.getByRole('option', {
      // Name followed directly by the e-mail: excludes "Platform Administrator (recovery)" too.
      name: /^Platform Administrator \S+@\S+$/,
    });
    await expect(ancestorOwnerOption).toBeVisible({ timeout: 15_000 });
    await ancestorOwnerOption.click();
    await page.getByRole('button', { name: 'Criar risco' }).click();
    await page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: inScopeTitle })).toBeVisible();
  });
});
