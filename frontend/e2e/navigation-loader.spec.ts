import { expect, test, type Page } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';

const OVERLAY = '[data-navigation-pending]';

const sidebarLink = (page: Page, label: string) =>
  page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', {
    name: label,
    exact: true,
  });

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
    await expect(overlay.getByRole('status')).toHaveText('Carregando página…');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    await expect(page.getByRole('heading', { level: 1, name: 'Controles' })).toBeVisible();
    await expect(overlay).toHaveCount(0);
  });

  test('nothing is painted until a navigation outlasts the delay, so a quick one never flashes', async ({
    page,
  }) => {
    await delayRoutePayload(page, '/controls', 1200);
    await watchOverlayTiming(page);

    await sidebarLink(page, 'Controles').click();
    await expect(page.locator(OVERLAY)).toBeVisible();

    const paintDelay = await overlayPaintDelay(page);
    expect(paintDelay).not.toBeNull();
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
    await expect(overlay).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Riscos' })).toBeVisible();
    await expect(overlay).toHaveCount(0);
  });

  test('a register row opening a detail screen raises the loader, and so does leaving it', async ({
    page,
  }) => {
    await sidebarLink(page, 'Controles').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Controles' })).toBeVisible();

    const firstRow = page.getByRole('link', { name: /^CTL-/ }).first();
    await expect(firstRow).toBeVisible();
    const detailHref = await firstRow.getAttribute('href');
    await delayRoutePayload(page, detailHref ?? '', 1200);

    await firstRow.click();
    await expect(page.locator(OVERLAY)).toBeVisible();
    await page.waitForURL(`**${detailHref ?? ''}`);
    await expect(page.locator(OVERLAY)).toHaveCount(0);

    await delayRoutePayload(page, '/assets', 1200);
    await sidebarLink(page, 'Ativos').click();
    await expect(page.locator(OVERLAY)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Ativos' })).toBeVisible();
    await expect(page.locator(OVERLAY)).toHaveCount(0);
  });

  test('navigation the product performs itself is covered too', async ({ page }) => {
    await page.goto('/assets/new', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Novo ativo' })).toBeVisible();
    await page.getByLabel('Nome').fill(`Ativo do E2E do loader ${Date.now().toString()}`);
    await page.getByRole('combobox', { name: /Unidade organizacional/ }).click();
    await page.getByRole('option').first().click();

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
      await expect(arc).toHaveCSS('opacity', '1');
    }
  });
});
