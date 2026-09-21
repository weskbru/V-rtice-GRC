import type { Page } from '@playwright/test';

/**
 * Name of the platform's one seeded root organizational unit
 * (`apps/api/prisma/seed/platform.seed.ts`'s own `ROOT_ORG_UNIT_NAME`
 * constant — confirmed by reading that file, not assumed). Every
 * seeded/dev-fixture organizational tree in this platform hangs off this
 * one root (`ROOT_ORG_UNIT_CODE`), and every "Unidade organizacional"
 * combobox this suite's own Worker Admin identity (`GLOBAL` scope) opens
 * lists it.
 */
export const SEEDED_ROOT_ORG_UNIT_NAME = 'PharosGRC';

/**
 * Selects the seeded root organizational unit (`PharosGRC`) from the
 * "Unidade organizacional" combobox on the current page — opens the
 * combobox and picks the option BY NAME. Never
 * `page.getByRole('option').first()`.
 *
 * ## Why `.first()` is not safe on this project's long-lived local database
 *
 * A local development database (`pharos_grc`) is not a freshly-seeded one —
 * it survives across sessions and accumulates data nothing ever cleans up.
 * This one carries two orphaned organizational units left behind by an old
 * manual verification: `F-38 live verification (in scope)` and
 * `F-38 live verification (out of scope)`. Both are the ROOT of their OWN
 * tree — their `path` does not start with the seeded root's own UUID, they
 * are not descendants of `PharosGRC` — and `GET /org-units` returns a flat
 * list sorted by name, in which `F-38 live verification (in scope)` sorts
 * BEFORE `PharosGRC`. A spec that does
 * `page.getByRole('combobox', { name: /Unidade organizacional/ }).click()`
 * followed by `page.getByRole('option').first().click()` therefore silently
 * selects that orphan unit instead of the seeded root it meant to pick "any
 * valid" unit from.
 *
 * That is not cosmetic. This platform's own business rule
 * (`RiskOwnershipPolicy`) requires a risk's manager to belong to the SAME
 * organizational line as the risk's own unit. A spec that also picks its
 * "Gestor do risco" with `.first()` — a user who lives in the SEEDED root's
 * tree, because that tree holds essentially every seeded/provisioned
 * identity this suite creates — ends up submitting a
 * (`F-38 live verification (in scope)` unit, an unrelated manager) pair that
 * is genuinely invalid, and `POST /api/v1/risks` correctly refuses it:
 *
 *   422 "Usuário gestor do risco não pertence à linha organizacional da
 *   unidade do risco."
 *
 * The form then never navigates away, and the spec's own
 * `page.waitForURL(...)` times out — reading as a broken product when the
 * actual defect is a test harness assuming "the first option in the picker"
 * still means "the seeded root", a topology fact that is only guaranteed
 * immediately after a fresh seed. `accessibility.spec.ts` pays the worst
 * price for this: it runs with `mode: 'serial'`, so one early risk-creation
 * test timing out this way skips the ~83 tests that follow it in the file.
 *
 * This is the exact same class of defect `docs/local-environment.md`'s
 * **D-20** already names and fixed once before: an E2E spec fetched only the
 * first PAGE of a `GET /admin/roles` list and assumed the role it wanted was
 * on it — silently correct only while the list stayed short. The lesson
 * there is the lesson here: never presume "the first result" stays
 * meaningful as a list this suite does not fully control keeps growing (or,
 * as here, keeps carrying rows an earlier session left behind).
 *
 * ## No silent fallback to `.first()`
 *
 * If the seeded root is not among the options, this throws with a specific,
 * actionable message instead of quietly picking whatever IS first — a
 * silent fallback would simply reintroduce, one layer further down, the
 * exact defect this helper exists to eliminate.
 *
 * ## When NOT to call this helper
 *
 * A handful of specs (`admin-access.spec.ts`, `assets-processes-scope.spec
 * .ts`, `audit-engagement-scope.spec.ts`) deliberately pick a SPECIFIC
 * organizational unit — the seeded root as a known ANCESTOR outside a
 * narrower grant, or a named fixture unit — because the unit's identity is
 * what the test is proving, not merely fixture data. Those call sites keep
 * their own explicit `getByRole('option', { name: ... })`/`.first()` choice
 * and must not be routed through this helper. Likewise, a spec signed in as
 * an actor whose organizational scope does NOT include the root (e.g. the
 * `fixture-risk-analyst@pharosgrc.local` identity used by
 * `risk-approval.spec.ts`/`risk-history.spec.ts`, scoped to
 * `DIV-A-TEAM-1`) must not call this helper either — the root will
 * correctly not be among that actor's own options, and this helper will
 * throw rather than mask that with a fallback.
 */
export async function selectSeededRootOrgUnit(page: Page): Promise<void> {
  await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
  const rootOption = page.getByRole('option', { name: SEEDED_ROOT_ORG_UNIT_NAME, exact: true });
  if ((await rootOption.count()) === 0) {
    throw new Error(
      `The seeded root organizational unit ("${SEEDED_ROOT_ORG_UNIT_NAME}") is not among the ` +
        '"Unidade organizacional" combobox options. This most likely means the backend this run ' +
        'is pointed at was never seeded (apps/api/prisma/seed/platform.seed.ts) — or the caller is ' +
        'signed in as an actor whose organizational scope does not include the root, in which case ' +
        "selectSeededRootOrgUnit() is the wrong helper to call here (pick a unit within that actor's " +
        'own scope instead, as risk-approval.spec.ts/risk-history.spec.ts already do).',
    );
  }
  await rootOption.click();
}
