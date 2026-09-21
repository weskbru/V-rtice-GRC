import { expect, test, type Page } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';

/**
 * `specs/014-institutional-loader` — the institutional loader over a pending
 * navigation.
 *
 * The signal under test is Next's own `useLinkStatus`, reported by the
 * sidebar's links (`components/shell/navigation-pending.tsx`), so these tests
 * drive real sidebar navigations and control only how long the router's own
 * request takes: a route handler delays the RSC request for the destination
 * (the `RSC: 1` header the App Router sends when fetching a route payload),
 * which is exactly the condition the overlay exists for. Nothing here stubs
 * the component's state.
 *
 * The loader must NOT appear for a fast navigation. That is asserted by
 * measuring how long it waits before painting, not by racing a real fast
 * navigation — see the test's own comment.
 */
const OVERLAY = '[data-navigation-pending]';

/**
 * Disambiguates from the same destination reached elsewhere on the screen (the
 * dashboard's own "Acessar controles" card link, covered by its own test
 * below).
 */
const sidebarLink = (page: Page, label: string) =>
  page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', {
    name: label,
    exact: true,
  });

/** Delays the App Router's payload request for `pathname` — the real network condition, not a fake state. */
async function delayRoutePayload(page: Page, pathname: string, ms: number): Promise<void> {
  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      if (route.request().headers().rsc === undefined) {
        await route.fallback();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, ms));
      await route.fallback();
    },
  );
}

/**
 * Marks "now" in the page and records when the overlay first appears, so the
 * gap between a click and the loader being painted can be measured instead of
 * inferred. A MutationObserver rather than polling: a flash shorter than a
 * poll interval would otherwise go unseen, which is exactly the defect the
 * delay exists to prevent.
 */
async function watchOverlayTiming(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    const w = window as unknown as { __overlayStartedAt?: number; __overlayFirstSeenAt?: number };
    w.__overlayStartedAt = performance.now();
    w.__overlayFirstSeenAt = undefined;
    if (document.querySelector(selector)) w.__overlayFirstSeenAt = performance.now();
    new MutationObserver(() => {
      if (w.__overlayFirstSeenAt === undefined && document.querySelector(selector)) {
        w.__overlayFirstSeenAt = performance.now();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }, OVERLAY);
}

/** Milliseconds from the mark to the overlay's first paint; `null` if it never appeared. */
const overlayPaintDelay = (page: Page): Promise<number | null> =>
  page.evaluate(() => {
    const w = window as unknown as { __overlayStartedAt?: number; __overlayFirstSeenAt?: number };
    if (w.__overlayFirstSeenAt === undefined || w.__overlayStartedAt === undefined) return null;
    return w.__overlayFirstSeenAt - w.__overlayStartedAt;
  });

test.describe('Institutional loader over a pending navigation', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the navigation loader.',
  );

  test.beforeEach(async ({ page }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
    // Warm the destinations first: on a dev server a route's first visit is a
    // compile, which is itself the slow case these tests control deliberately.
    for (const path of ['/controls', '/processes', '/assets']) {
      await page.goto(path, { waitUntil: 'networkidle' });
    }
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
  });

  test('a slow navigation shows the loader over the previous screen, and it goes away when the route commits', async ({
    page,
  }) => {
    await delayRoutePayload(page, '/controls', 1200);

    await sidebarLink(page, 'Controles').click();

    const overlay = page.locator(OVERLAY);
    await expect(overlay).toBeVisible();
    // A status, announced once — and the previous screen is still there beneath it.
    await expect(overlay.getByRole('status')).toHaveText('Carregando página…');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    await expect(page.getByRole('heading', { level: 1, name: 'Controles' })).toBeVisible();
    await expect(overlay).toHaveCount(0);
  });

  test('nothing is painted until a navigation outlasts the delay, so a quick one never flashes', async ({
    page,
  }) => {
    // Asserting the DELAY itself, rather than racing a real fast navigation:
    // on a dev server no route commits reliably inside 200ms, so "it did not
    // flash" would be measuring this machine. A navigation shorter than the
    // measured gap below cannot show anything — `pharos-loader.test.tsx`
    // pins that consequence exactly, on fake timers.
    await delayRoutePayload(page, '/controls', 1200);
    await watchOverlayTiming(page);

    await sidebarLink(page, 'Controles').click();
    await expect(page.locator(OVERLAY)).toBeVisible();

    const paintDelay = await overlayPaintDelay(page);
    expect(paintDelay).not.toBeNull();
    // The mark is taken BEFORE the click, so this includes Playwright's own
    // click latency — it can only over-report, never hide a missing delay.
    expect(paintDelay).toBeGreaterThanOrEqual(180);
  });

  test('consecutive navigations end on the last destination with no leftover loader', async ({
    page,
  }) => {
    await delayRoutePayload(page, '/controls', 1500);
    await delayRoutePayload(page, '/assets', 600);

    await sidebarLink(page, 'Controles').click();
    await expect(page.locator(OVERLAY)).toBeVisible();
    await sidebarLink(page, 'Ativos').click();

    await expect(page.getByRole('heading', { level: 1, name: 'Ativos' })).toBeVisible();
    await expect(page.locator(OVERLAY)).toHaveCount(0);
    await expect(page).toHaveURL(/\/assets$/);
  });

  test('a failed navigation does not leave the loader stuck', async ({ page }) => {
    await page.route(
      (url) => url.pathname === '/controls',
      async (route) => {
        if (route.request().headers().rsc === undefined) {
          await route.fallback();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.abort('failed');
      },
    );

    await sidebarLink(page, 'Controles').click();
    // Whatever the router decides to do with a failed payload (retry, full
    // document load), the overlay must not outlive the attempt.
    await expect(page.locator(OVERLAY)).toHaveCount(0, { timeout: 15_000 });
  });

  test('keyboard navigation gets the same feedback', async ({ page }) => {
    await delayRoutePayload(page, '/controls', 1200);

    const link = sidebarLink(page, 'Controles');
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.locator(OVERLAY)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Controles' })).toBeVisible();
    await expect(page.locator(OVERLAY)).toHaveCount(0);
  });

  test('a Dashboard card link raises the same loader as the sidebar', async ({ page }) => {
    await delayRoutePayload(page, '/risks', 1200);

    await page.getByRole('link', { name: 'Acessar riscos' }).click();

    const overlay = page.locator(OVERLAY);
    await expect(overlay).toBeVisible();
    // Exactly one indicator: no second loading system underneath or on top.
    await expect(overlay).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Riscos' })).toBeVisible();
    await expect(overlay).toHaveCount(0);
  });

  test('a register row opening a detail screen raises the loader, and so does leaving it', async ({
    page,
  }) => {
    await sidebarLink(page, 'Controles').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Controles' })).toBeVisible();

    // The register's own row link — a `<Link>` rendered by a table cell, the
    // category that had no coverage at all before this change.
    const firstRow = page.getByRole('link', { name: /^CTL-/ }).first();
    await expect(firstRow).toBeVisible();
    const detailHref = await firstRow.getAttribute('href');
    await delayRoutePayload(page, detailHref ?? '', 1200);

    await firstRow.click();
    await expect(page.locator(OVERLAY)).toBeVisible();
    await page.waitForURL(`**${detailHref ?? ''}`);
    await expect(page.locator(OVERLAY)).toHaveCount(0);

    // Detail -> another screen, again from inside the content.
    await delayRoutePayload(page, '/assets', 1200);
    await sidebarLink(page, 'Ativos').click();
    await expect(page.locator(OVERLAY)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Ativos' })).toBeVisible();
    await expect(page.locator(OVERLAY)).toHaveCount(0);
  });

  test('navigation the product performs itself is covered too', async ({ page }) => {
    /*
     * After a successful create, the form navigates to the new record with
     * `useNavigate()` — no link is involved, so only the provider's own
     * transition can report this one. This is the scenario the per-link signal
     * structurally cannot reach, which is why it is worth creating a real
     * record to prove it.
     */
    await page.goto('/assets/new', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    await page.getByLabel('Nome').fill(`Ativo do E2E do loader ${Date.now().toString()}`);
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();

    // Delay the destination the form is about to push to, whatever id it gets.
    await page.route(
      (url) => /^\/assets\/[0-9a-fA-F-]+$/.test(url.pathname),
      async (route) => {
        if (route.request().headers().rsc === undefined) {
          await route.fallback();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await route.fallback();
      },
    );

    await page.getByRole('button', { name: 'Cadastrar ativo' }).click();

    await expect(page.locator(OVERLAY)).toBeVisible();
    await page.waitForURL(/\/assets\/[0-9a-fA-F-]+$/, { timeout: 20_000 });
    await expect(page.locator(OVERLAY)).toHaveCount(0);
  });

  test('a link inside the account menu is covered even though the menu unmounts it', async ({
    page,
  }) => {
    /*
     * The menu closes on select, so the link that started the navigation stops
     * existing before it can report anything — measured directly: without the
     * `insideDismissingOverlay` opt-in, a 2 s navigation from here showed
     * nothing at all. These links hand the wait to the shell's own transition
     * instead, and stay real anchors while doing it.
     */
    await delayRoutePayload(page, '/profile', 1200);

    await page.getByRole('button', { name: /Menu da conta/ }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Perfil' }).click();

    await expect(page.locator(OVERLAY)).toBeVisible();
    await expect(page.locator(OVERLAY)).toHaveCount(1);
    await page.waitForURL('**/profile');
    await expect(page.locator(OVERLAY)).toHaveCount(0);
  });

  test('browser back and forward never leave the loader behind', async ({ page }) => {
    await sidebarLink(page, 'Controles').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Controles' })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(page.locator(OVERLAY)).toHaveCount(0);

    await page.goForward();
    await expect(page.getByRole('heading', { level: 1, name: 'Controles' })).toBeVisible();
    await expect(page.locator(OVERLAY)).toHaveCount(0);
  });

  test('under prefers-reduced-motion the symbol is shown without the looping animation', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await delayRoutePayload(page, '/controls', 1500);

    await sidebarLink(page, 'Controles').click();
    await expect(page.locator(OVERLAY)).toBeVisible();

    const arcs = page.locator(`${OVERLAY} .pharos-loader-signal`);
    await expect(arcs).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      const arc = arcs.nth(index);
      await expect(arc).toHaveCSS('animation-name', 'none');
      // Static, but complete: every signal visible rather than a dark symbol.
      await expect(arc).toHaveCSS('opacity', '1');
    }
  });
});
