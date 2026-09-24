import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';

import type { Page } from '@playwright/test';

async function scrollGeometry(page: Page): Promise<{
  documentOverflow: number;
  horizontalOverflow: number;
  scrollY: number;
  scrollers: string[];
}> {
  return page.evaluate(() => {
    const de = document.documentElement;
    const scrollers = [...document.querySelectorAll('*')]
      .filter(
        (el) =>
          el.scrollHeight > el.clientHeight + 1 &&
          /auto|scroll|overlay/.test(getComputedStyle(el).overflowY),
      )
      .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`);

    return {
      documentOverflow: de.scrollHeight - de.clientHeight,
      horizontalOverflow: de.scrollWidth - de.clientWidth,
      scrollY: window.scrollY,
      scrollers,
    };
  });
}

test.describe('Authenticated shell — only <main> scrolls', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the real shell.',
  );

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    const label = `${viewport.width}x${viewport.height}`;

    test(`the document does not scroll at ${label}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await signInAsWorkerAdmin(page, testInfo);
      await page.goto('/dashboard', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Ações rápidas' })).toBeAttached();

      const geometry = await scrollGeometry(page);

      expect(geometry.documentOverflow, 'html/body must not scroll').toBe(0);
      expect(geometry.horizontalOverflow, 'the page must not scroll sideways').toBe(0);
      expect(geometry.scrollers, 'page content scrolls in <main> and nowhere else').toContain(
        'main#main-content',
      );
    });
  }

  test("the dashboard's accessible chart tables take up no space", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsWorkerAdmin(page, testInfo);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const hidden = await page.evaluate(() => {
      const selfHiding = document.querySelectorAll('table.sr-only').length;

      const wrappers = [...document.querySelectorAll('main .sr-only')].filter((el) =>
        el.querySelector('table'),
      );

      return {
        selfHiding,
        wrapperCount: wrappers.length,
        widest: Math.max(0, ...wrappers.map((el) => el.getBoundingClientRect().width)),
        tallest: Math.max(0, ...wrappers.map((el) => el.getBoundingClientRect().height)),
      };
    });

    expect(hidden.selfHiding, 'no <table> hides itself with sr-only').toBe(0);
    expect(hidden.wrapperCount, 'the charts still render their data tables').toBeGreaterThan(0);
    expect(hidden.widest, 'the hiding box really is 1px wide').toBeLessThanOrEqual(1);
    expect(hidden.tallest, 'the hiding box really is 1px tall').toBeLessThanOrEqual(1);
  });

  test('the organization admin screen does not overflow sideways at 390px (F-66 causa 3)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsWorkerAdmin(page, testInfo);
    await page.goto('/admin/organization', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Estrutura organizacional' })).toBeVisible();

    const widestInMain = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return 0;
      let widest = 0;
      main.querySelectorAll('*').forEach((el) => {
        widest = Math.max(widest, el.getBoundingClientRect().width);
      });
      return widest;
    });

    expect(
      widestInMain,
      'no element inside <main> may be wider than the 390px viewport',
    ).toBeLessThanOrEqual(390);
  });

  test('the sidebar rail scrolls only when it does not fit', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsWorkerAdmin(page, testInfo);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    const railOverflow = async (): Promise<number> =>
      page.evaluate(() => {
        const rail = document.querySelector('[data-sidebar-nav]');
        return rail ? rail.scrollHeight - rail.clientHeight : -1;
      });

    expect(await railOverflow(), 'a tall window shows no sidebar scrollbar').toBe(0);

    await page.setViewportSize({ width: 1440, height: 520 });
    await page.waitForTimeout(300);
    expect(await railOverflow(), 'a short window lets the rail scroll').toBeGreaterThan(0);

    expect((await scrollGeometry(page)).documentOverflow).toBe(0);
  });

  test('scrolling past the bottom of <main> does not scroll the document', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await signInAsWorkerAdmin(page, testInfo);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    await page.mouse.move(900, 400);
    for (let tick = 0; tick < 20; tick += 1) {
      await page.mouse.wheel(0, 500);
    }
    await page.waitForTimeout(300);

    const mainScrolledToBottom = await page.evaluate(() => {
      const main = document.getElementById('main-content');
      return main !== null && main.scrollTop >= main.scrollHeight - main.clientHeight - 1;
    });
    expect(mainScrolledToBottom, '<main> reached its own bottom').toBe(true);

    await expect(page.getByRole('heading', { name: 'Ações rápidas' })).toBeInViewport();

    const geometry = await scrollGeometry(page);
    expect(geometry.scrollY, 'the document never moved').toBe(0);
    expect(geometry.documentOverflow, 'the document never gained scrollable height').toBe(0);
  });

  test('stray body content cannot give the document a second scrollbar', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsWorkerAdmin(page, testInfo);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      const stray = document.createElement('div');
      stray.id = 'stray-body-content';
      stray.style.height = '1200px';
      document.body.append(stray);
    });
    await page.waitForTimeout(200);

    expect(
      await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth),
      'the document must not put up a scrollbar of its own',
    ).toBe(0);

    await page.mouse.move(900, 400);
    for (let tick = 0; tick < 20; tick += 1) {
      await page.mouse.wheel(0, 500);
    }
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(() => window.scrollY),
      'the wheel must never drag the document out from under the shell',
    ).toBe(0);

    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).overflowY),
      'the shell locks the document while it is mounted',
    ).toBe('hidden');

    await expect(page.locator('header').first()).toBeInViewport();
  });

  test('the login screen is NOT locked — it must scroll on a short viewport', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 360 });
    await page.goto('/login', { waitUntil: 'networkidle' });

    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).overflowY),
      'public pages carry no shell and keep the browser default',
    ).not.toBe('hidden');
  });
});
