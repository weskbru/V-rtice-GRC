import { expect, test } from '@playwright/test';

/**
 * Minimal infra smoke test (T049) — proves the Playwright runner, the
 * ADR-014 rewrite and the Next.js build are wired together end to end.
 *
 * Updated for assurance-audit Fix 4: `/` used to render a static
 * placeholder scaffolding page with no auth guard (leftover from before
 * `(app)/`/`(public)/login` existed); it now redirects straight to
 * `/login` (`apps/web/src/app/page.tsx`), reusing that screen's own
 * already-tested session check rather than presenting content of its own.
 * This still does NOT test the login screen itself in depth (that is
 * `auth.spec.ts`'s job) — it only asserts the redirect actually lands
 * somewhere real.
 */
test('root route redirects to the sign-in screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
