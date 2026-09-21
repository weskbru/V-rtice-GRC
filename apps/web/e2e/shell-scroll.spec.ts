import { expect, test } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';

import type { Page } from '@playwright/test';

/**
 * E2E for the authenticated shell's scroll ownership (F-67, and cause 2 of
 * F-66).
 *
 * The shell is viewport-bound: `<main>` is the ONE region that scrolls page
 * content, and the document itself must never scroll. Until this spec existed
 * that was an *implicit* invariant — it held only for as long as nothing else
 * in `<body>` happened to have height, and nothing in the repository checked
 * it. Anything that escapes into the initial containing block (an `sr-only`
 * `<table>`, a Radix popper, the toast region, the dev overlay, a browser
 * extension) gave the document scrollable height, and the symptom was the
 * reported one: a second scrollbar on the right, and scrolling past the bottom
 * of `<main>` continuing into a large empty area below the shell.
 *
 * `stray body content` below is that trigger, made deterministic: a tall
 * element appended to `<body>`, which is what every one of those sources
 * amounts to. It is the scenario that failed against the unguarded shell.
 *
 * `the dashboard's accessible chart tables` covers the specific element that
 * caused the reported defect — the charts' visually-hidden data tables, which
 * as bare `sr-only` tables ignored `width`/`height`/`overflow` and took up real
 * space (F-66 cause 2).
 *
 * The sidebar's own navigation scroller is deliberately NOT forbidden — it has
 * to scroll when the rail is taller than a short viewport — but it is required
 * to stay silent when it is not needed, so a normal window never shows two
 * scrollbars.
 */

/** The scroll geometry of the page, read from the browser. */
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

  // A tall window where the dashboard fits comfortably, a short one where it
  // overflows `<main>` by a lot and the sidebar rail needs its own scroll, and
  // a phone width, where the chart tables used to widen the whole document.
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
      // A table must never carry `sr-only` itself: a table box treats
      // width/height as minimums and CSS leaves `overflow` on it undefined, so
      // it stays fully laid out while looking hidden.
      const selfHiding = document.querySelectorAll('table.sr-only').length;

      // The wrapper that does hide it must really collapse to a 1px box.
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
    // `docs/deferred-findings.md` F-66 causa 3: below `lg`, the two-column
    // grid (`OrgUnitTree` + `ScopeGrantsPanel`) had no `grid-template-
    // columns` of its own at all — an implicit, content-sized single track,
    // not one clamped to the viewport, so a long org unit/scope name grew
    // the whole grid instead of wrapping or truncating. Measured 525px at a
    // 390px viewport before the fix (`grid-cols-1` on the base breakpoint,
    // `organization-admin-view.tsx`).
    //
    // Deliberately NOT `scrollGeometry()`'s `horizontalOverflow` (used by
    // every other test in this file): that reads `document.documentElement
    // .scrollWidth`, which this shell's own top-level `overflow-hidden`
    // (T203) clips before it ever reaches the document — proven directly
    // while writing this test: reverting the grid fix left
    // `documentElement.scrollWidth` at exactly 390 while the grid itself
    // still measured 525px, which would have made this guard pass against
    // the unfixed code. F-66 causa 3 is content CLIPPED inside `<main>`,
    // not a document-level scrollbar (that class is F-66 causa 1, still
    // open) — the only instrument that actually distinguishes the two is a
    // direct bounding-box measurement of the elements themselves.
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

    // Tall window: the rail fits, so it must not put up a second scrollbar.
    expect(await railOverflow(), 'a tall window shows no sidebar scrollbar').toBe(0);

    // Short window: the rail no longer fits and must become reachable.
    await page.setViewportSize({ width: 1440, height: 520 });
    await page.waitForTimeout(300);
    expect(await railOverflow(), 'a short window lets the rail scroll').toBeGreaterThan(0);

    // Even then the document itself stays put.
    expect((await scrollGeometry(page)).documentOverflow).toBe(0);
  });

  test('scrolling past the bottom of <main> does not scroll the document', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await signInAsWorkerAdmin(page, testInfo);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Wheel well past the end of the page's own content, the way a user does.
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

    // The last thing on the dashboard has to be readable there.
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

    // Stand in for anything that lands outside `<main>` and takes up space: an
    // escaped `sr-only` table, a popper, the toast region, the dev overlay, a
    // browser extension. The shell must keep owning the viewport regardless.
    await page.evaluate(() => {
      const stray = document.createElement('div');
      stray.id = 'stray-body-content';
      stray.style.height = '1200px';
      document.body.append(stray);
    });
    await page.waitForTimeout(200);

    // The stray node is clipped, not removed, so `scrollHeight` still counts it
    // and `window.scrollTo` still moves a locked document — neither is what a
    // user can do. The invariants are the ones the user actually experiences:
    // no second scrollbar, and the wheel cannot take them into the empty area.
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

    // The shell still occupies exactly the viewport, header included.
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
