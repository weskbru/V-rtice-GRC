import { expect, test } from '@playwright/test';

import { INDICATOR_METRIC_KEY_ORDER } from '../src/features/indicators/overview/indicator-overview-model';
import { common } from '../src/lib/messages/common';
import { indicators } from '../src/lib/messages/indicators';

import {
  FIXTURE_USER_EMAIL,
  requireSeedCredentials,
  signInAsFixtureUser,
  signInAsWorkerAdmin,
  signOut,
} from './support/admin-session';

import type { DashboardSummaryMetric } from '../src/features/dashboard/types';
import type { Page } from '@playwright/test';

/**
 * indicators-round (S3 ownership, coordinator PLAN.md §3) — E2E coverage for
 * the redesigned `/indicators` overview screen (S1's `IndicatorCatalogView`
 * over S2's `useIndicatorOverview`/`indicator-overview-model.ts`).
 *
 * Every selector below is anchored on SEMANTICS the PLAN.md interface
 * contract (§4) and the shared messages catalog (`../src/lib/messages/
 * indicators.ts`, imported directly rather than hand-duplicated so a wording
 * change can never silently desync this suite from the screen) already fix —
 * roles, accessible names, `role="status"` text and `href`s — never a
 * layout/CSS class, because S1's own layout (filters row, card header) is
 * still being refined when this file was written (coordinator's own PHASE B
 * brief). `IndicatorOverviewSection`'s `variant`/grid classes, `Card`'s own
 * classes, and every Tailwind utility in `overview/components/*` are
 * deliberately never referenced here.
 *
 * Two requests, not eleven/twenty-two (F-59): `useIndicatorOverview` fires
 * `GET /dashboard/summary` (the batch source for all 11 current values) and
 * `GET /indicators` (definitions, threshold/description text only) — see
 * `s3-baseline.md`'s own BEFORE measurement (22 requests, 11 of them 429)
 * for what this redesign replaces.
 *
 * No `IndicatorDefinition` is ever created by this file — `metricKey` is
 * `@unique` on that table (coordinator's own PHASE B instruction), so a
 * created definition would permanently change the shared dev database for
 * every other suite/session on this machine, not just this test run.
 */

const API_PREFIX = '/api/v1';

function apiPathname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return null;
  }
}

/** `GET /dashboard/summary`'s own metric list, fetched fresh through the SAME authenticated session Playwright's `page` already holds — never a second, differently-authenticated client. Mirrors `indicators-round/probe-nav-exactness-v2.mjs`'s own fetch-then-compare method (S3's PHASE A probe), now exercised through the real rendered UI instead of constructed URLs. */
async function fetchDashboardSummary(
  page: Page,
): Promise<{ metrics: readonly DashboardSummaryMetric[] }> {
  return page.evaluate(async (prefix) => {
    const response = await fetch(`${prefix}/dashboard/summary`, { credentials: 'include' });
    return (await response.json()) as { metrics: readonly DashboardSummaryMetric[] };
  }, API_PREFIX);
}

function findMetric(
  metrics: readonly DashboardSummaryMetric[],
  metricKey: string,
): DashboardSummaryMetric {
  const metric = metrics.find((m) => m.metricKey === metricKey);
  if (!metric) {
    throw new Error(
      `${metricKey} is missing from GET /dashboard/summary for this session — the Platform ` +
        'Administrator worker account should hold every source permission; check whether the ' +
        'seed/role data this run points at changed.',
    );
  }
  return metric;
}

/** Parses the leading pt-BR-formatted integer off a `role="status"` string — "861 riscos" → 861, "Nenhum resultado" → 0. Same parsing rule as `probe-nav-exactness-v2.mjs`'s own `parseLeadingCount`, proven against all 22 candidates in PHASE A (`s3-nav-exactness.md`). */
function parseLeadingCount(text: string): number | null {
  const cleaned = text.trim();
  if (/^nenhum/i.test(cleaned)) return 0;
  const match = /^([\d.,]+)/.exec(cleaned);
  if (!match) return null;
  const digits = match[1]!.replace(/\./g, '').replace(/,.*/, '');
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Reads the destination register's own rendered result count
 * (`ResultsToolbar`'s "N `<noun>`" — `packages/design-system/src/components/
 * data-table/results-toolbar.tsx`, `role="status"`). Scans EVERY
 * `role="status"` element on the page for one matching the count shape
 * ("123 riscos" / "Nenhum resultado") rather than trusting the FIRST
 * `role="status"` in DOM order, because the shell's own toast/notification
 * region is also `role="status"` and can be present-but-empty at the same
 * time the register's own count is still loading — the same class of
 * ambiguity `probe-nav-exactness-v2.mjs`'s own `statusTexts` search (PHASE A)
 * resolved the same way.
 */
async function readRegisterResultCount(page: Page): Promise<number> {
  await expect
    .poll(
      async () => {
        const texts = await page.getByRole('status').allTextContents();
        return texts.some((text) => /^\d|^nenhum resultado/i.test(text.trim()));
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  const texts = await page.getByRole('status').allTextContents();
  const toolbarText = texts.find((text) => /^\d|^nenhum resultado/i.test(text.trim()));
  const count = toolbarText ? parseLeadingCount(toolbarText) : null;
  if (count === null) {
    throw new Error(
      `Could not parse a result count from role="status" texts: ${JSON.stringify(texts)}`,
    );
  }
  return count;
}

async function waitForIndicatorOverviewContent(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: indicators.register.pageTitle, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/^Calculados às/)).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('link', { name: indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL, exact: true }),
  ).toBeVisible();
}

test.describe('Indicadores — overview screen (indicators-round, S3 ownership)', () => {
  test.describe.configure({ mode: 'serial' });

  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a ' +
      'seeded backend to exercise the redesigned Indicadores overview screen.',
  );

  test.beforeEach(async ({ page }, testInfo) => {
    await signInAsWorkerAdmin(page, testInfo);
  });

  // --------------------------------------------------------------------
  // 1. Load: one batched summary request, zero per-key /current requests
  // --------------------------------------------------------------------
  test('load fires the batched summary + definitions pair and zero per-key /current requests', async ({
    page,
  }) => {
    const apiRequests: { pathname: string; url: string }[] = [];
    page.on('request', (request) => {
      const pathname = apiPathname(request.url());
      if (pathname?.startsWith(`${API_PREFIX}/`)) {
        apiRequests.push({ pathname, url: request.url() });
      }
    });

    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);
    // Headroom for a React StrictMode (dev only) second effect invocation to
    // land — see the assertion comment below for why this is bounded, not
    // asserted away.
    await page.waitForTimeout(800);

    const summaryRequests = apiRequests.filter(
      (r) => r.pathname === `${API_PREFIX}/dashboard/summary`,
    );
    const definitionsRequests = apiRequests.filter(
      (r) => r.pathname === `${API_PREFIX}/indicators`,
    );
    const currentRequests = apiRequests.filter((r) =>
      new RegExp(`^${API_PREFIX}/indicators/[^/]+/current$`).test(r.pathname),
    );

    // The structural property StrictMode CANNOT change: the previous catalog
    // fired one `/current` request per card (11, 22 under StrictMode,
    // `s3-baseline.md` §2) — this redesign must fire none, ever, ever again.
    expect(
      currentRequests,
      `unexpected /current requests: ${JSON.stringify(currentRequests)}`,
    ).toEqual([]);

    // The batched pair itself: exactly 1 in a production build, but
    // `use-indicator-overview.ts`'s own header documents that dev's
    // StrictMode double-invokes the fetch effect (mount → cleanup → mount),
    // firing the SAME batched pair twice (4 requests total) rather than
    // deduplicating it — "a real reduction [from 22], not a full StrictMode
    // dedupe, which no existing pattern in this codebase provides either."
    // Bounding at 1-2 (never asserting exactly 1, which fails under dev
    // StrictMode; never asserting exactly 2, which fails a production build
    // where StrictMode does not run) is what makes this assertion true in
    // both environments while still catching a real regression (3+, or the
    // old per-card fan-out).
    expect(summaryRequests.length, JSON.stringify(summaryRequests)).toBeGreaterThanOrEqual(1);
    expect(summaryRequests.length, JSON.stringify(summaryRequests)).toBeLessThanOrEqual(2);
    expect(definitionsRequests.length, JSON.stringify(definitionsRequests)).toBeGreaterThanOrEqual(
      1,
    );
    expect(definitionsRequests.length, JSON.stringify(definitionsRequests)).toBeLessThanOrEqual(2);
  });

  // --------------------------------------------------------------------
  // 2. Values honesty: all 11 render; every value/bucket (incl. 0) matches
  //    the same-session /dashboard/summary; compliance renders with "%".
  // --------------------------------------------------------------------
  test('all 11 indicators render, and every displayed value/bucket matches /dashboard/summary', async ({
    page,
  }) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    const summary = await fetchDashboardSummary(page);

    // Every one of the closed 11-key catalog gets its own named link,
    // whether or not the caller can read it — `IndicatorOverviewItem[]` is
    // always all 11 keys, in catalog order (`indicator-overview-model.ts`'s
    // own `buildIndicatorOverviewItems` doc comment).
    for (const metricKey of INDICATOR_METRIC_KEY_ORDER) {
      const label = indicators.metricKeyLabels[metricKey];
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    }

    // SINGLE_VALUE keys: the rendered number (or "0") matches `metric.value`
    // exactly. COMPLIANCE_PERCENTAGE additionally carries a literal "%".
    for (const metricKey of [
      'RISK_TREATMENT_OVERDUE_COUNT',
      'CONTROL_INACTIVE_COUNT',
      'COMPLIANCE_PERCENTAGE',
      'AUDIT_ENGAGEMENT_OPEN_COUNT',
      'ASSET_INACTIVE_COUNT',
      'PROCESS_INACTIVE_COUNT',
      'ACTION_OVERDUE_COUNT',
    ] as const) {
      const metric = findMetric(summary.metrics, metricKey);
      const label = indicators.metricKeyLabels[metricKey];
      const card = page.getByRole('link', { name: label, exact: true }).locator('..');
      if (typeof metric.value !== 'number') {
        await expect(card.getByText(indicators.overview.states.noData)).toBeVisible();
        continue;
      }
      const expectedText =
        metricKey === 'COMPLIANCE_PERCENTAGE'
          ? `${metric.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
          : metric.value.toLocaleString('pt-BR');
      await expect(card.getByText(expectedText, { exact: true })).toBeVisible();
    }

    // BY_BUCKET keys: every one of the four buckets, INCLUDING a genuine 0,
    // renders its own number inside that metric's own accessibly-named
    // legend list (`card.legendLabel(name)` — never conflated with another
    // BY_BUCKET card's identical level labels, since the list itself is
    // scoped per metric).
    for (const metricKey of [
      'RISK_TOTAL_BY_LEVEL',
      'FINDING_OPEN_COUNT_BY_SEVERITY',
      'INCIDENT_OPEN_COUNT_BY_SEVERITY',
      'PROBLEM_OPEN_COUNT_BY_SEVERITY',
    ] as const) {
      const metric = findMetric(summary.metrics, metricKey);
      const label = indicators.metricKeyLabels[metricKey];
      const legend = page.getByRole('list', { name: indicators.overview.card.legendLabel(label) });
      await expect(legend).toBeVisible();

      for (const level of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const) {
        const count = metric.valueByBucket?.[level] ?? 0;
        const levelLabel = indicators.bucketBadgeLabels.levelName(level);
        // Scoped to THIS level's own `<li>` row (via its own badge word,
        // unique per row) rather than searching the whole legend for the
        // count text in isolation — two different buckets legitimately
        // share the same count sometimes (e.g. two buckets both at 3), which
        // made a legend-wide `getByText(count)` a Playwright strict-mode
        // violation (found running this spec: `FINDING_OPEN_COUNT_BY_SEVERITY`
        // had two buckets both equal to 3). Scoping to the row is also what
        // proves this IS the level's own row, not merely "this count exists
        // somewhere in the list" (CLAUDE.md §18.8 — never colour alone; here,
        // never position alone either).
        const bucketRow = legend.getByRole('listitem').filter({ hasText: levelLabel });
        await expect(bucketRow).toBeVisible();
        await expect(
          bucketRow.getByText(count.toLocaleString('pt-BR'), { exact: true }),
        ).toBeVisible();
      }
    }
  });

  // --------------------------------------------------------------------
  // 3. Navigation exactness in the browser, for 3 representative links —
  //    same method as PHASE A's probe (s3-nav-exactness.md), now clicked
  //    through the real UI instead of constructed.
  // --------------------------------------------------------------------
  test('navigation links land on a register whose rendered count equals the indicator value', async ({
    page,
  }) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    const summary = await fetchDashboardSummary(page);

    // --- (a) a bucket link on "Riscos por nível" — the CRITICAL bucket ---
    {
      const metric = findMetric(summary.metrics, 'RISK_TOTAL_BY_LEVEL');
      const expected = metric.valueByBucket?.CRITICAL ?? 0;
      const label = indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL;
      const levelLabel = indicators.bucketBadgeLabels.levelName('CRITICAL');
      const legend = page.getByRole('list', { name: indicators.overview.card.legendLabel(label) });
      const link = legend.getByRole('link', {
        name: indicators.overview.card.bucketLinkAccessibleLabelByLevel(expected, levelLabel),
      });
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForURL(/\/risks\?/);
      const measured = await readRegisterResultCount(page);
      expect(
        measured,
        `RISK_TOTAL_BY_LEVEL/CRITICAL: expected ${expected}, register shows ${measured}`,
      ).toBe(expected);
      await page.goBack();
      await waitForIndicatorOverviewContent(page);
    }

    // --- (b) "Ver registros" of "Ações em atraso" ---
    {
      const metric = findMetric(summary.metrics, 'ACTION_OVERDUE_COUNT');
      const expected = metric.value ?? 0;
      const label = indicators.metricKeyLabels.ACTION_OVERDUE_COUNT;
      const link = page.getByRole('link', {
        name: indicators.overview.card.viewRecordsAccessibleLabel(label),
      });
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForURL(/\/actions\?/);
      const measured = await readRegisterResultCount(page);
      expect(
        measured,
        `ACTION_OVERDUE_COUNT: expected ${expected}, register shows ${measured}`,
      ).toBe(expected);
      await page.goBack();
      await waitForIndicatorOverviewContent(page);
    }

    // --- (c) a bucket link on "Incidentes abertos por severidade" — HIGH ---
    {
      const metric = findMetric(summary.metrics, 'INCIDENT_OPEN_COUNT_BY_SEVERITY');
      const expected = metric.valueByBucket?.HIGH ?? 0;
      const label = indicators.metricKeyLabels.INCIDENT_OPEN_COUNT_BY_SEVERITY;
      const legend = page.getByRole('list', { name: indicators.overview.card.legendLabel(label) });
      const link = legend.getByRole('link', {
        name: indicators.overview.card.bucketLinkAccessibleLabelBySeverity(
          expected,
          indicators.overview.domainLabels.INCIDENT.toLowerCase(),
          indicators.severityLevelLabelsFeminine.HIGH,
        ),
      });
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForURL(/\/incidents\?/);
      const measured = await readRegisterResultCount(page);
      expect(
        measured,
        `INCIDENT_OPEN_COUNT_BY_SEVERITY/HIGH: expected ${expected}, register shows ${measured}`,
      ).toBe(expected);
    }
  });

  // --------------------------------------------------------------------
  // 4. Filters: search, domain, "Limpar filtros", reload restores, invalid
  //    domain falls back to all.
  // --------------------------------------------------------------------
  test('search narrows the visible cards and writes q to the URL', async ({ page }) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    // "risco" matches exactly the two RISK-domain items by name ("Riscos por
    // nível", "Tratamentos de risco em atraso") — the closed catalog fixes
    // this at compile time (`indicator-overview-model.ts`'s own
    // `INDICATOR_CATALOG`), never mutable seed data.
    await page.getByLabel(indicators.overview.filters.searchLabel).fill('risco');

    await expect(
      page.getByRole('link', { name: indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: indicators.metricKeyLabels.RISK_TREATMENT_OVERDUE_COUNT,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: indicators.metricKeyLabels.ASSET_INACTIVE_COUNT,
        exact: true,
      }),
    ).not.toBeVisible();

    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 5_000 })
      .toBe('risco');
  });

  test('domain selection narrows to one domain, writes domain to the URL, and "Limpar filtros" clears both', async ({
    page,
  }) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    // INCIDENT is the closed catalog's only single-item domain with a
    // distinctive, unambiguous name — `indicators.overview.filters
    // .domainOption` builds the exact accessible name the same way the
    // screen itself does, so this assertion can never independently drift
    // from the component's own label composition.
    const incidentRadio = page.getByRole('radio', {
      name: indicators.overview.filters.domainOption(indicators.overview.domainLabels.INCIDENT, 1),
    });
    await incidentRadio.click();
    await expect(incidentRadio).toHaveAttribute('aria-checked', 'true');

    await expect(
      page.getByRole('link', {
        name: indicators.metricKeyLabels.INCIDENT_OPEN_COUNT_BY_SEVERITY,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL, exact: true }),
    ).not.toBeVisible();

    await expect
      .poll(() => new URL(page.url()).searchParams.get('domain'), { timeout: 5_000 })
      .toBe('INCIDENT');

    // Add a search term too, so "Limpar filtros" is proven to clear BOTH
    // dimensions in one action, not only the one exercised most recently.
    await page.getByLabel(indicators.overview.filters.searchLabel).fill('abertos');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 5_000 })
      .toBe('abertos');

    await page.getByRole('button', { name: common.actions.clearFilters }).click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get('domain'), { timeout: 5_000 })
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 5_000 })
      .toBeNull();
    await expect(
      page.getByRole('link', { name: indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL, exact: true }),
    ).toBeVisible();
  });

  test('a domain in the URL survives reload; an invalid domain falls back to Todos', async ({
    page,
  }) => {
    await page.goto('/indicators?domain=INCIDENT');

    // NOT `waitForIndicatorOverviewContent` here — that helper's own "real,
    // loaded content" proof is the "Riscos por nível" link, which a
    // domain=INCIDENT filter correctly HIDES. Waited on directly instead:
    // the heading + band text are always present regardless of filter, and
    // the INCIDENT card's own link is this filtered state's real,
    // loaded-content proof.
    await expect(
      page.getByRole('heading', { name: indicators.register.pageTitle, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(/^Calculados às/)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('link', {
        name: indicators.metricKeyLabels.INCIDENT_OPEN_COUNT_BY_SEVERITY,
        exact: true,
      }),
    ).toBeVisible();

    const incidentRadio = page.getByRole('radio', {
      name: indicators.overview.filters.domainOption(indicators.overview.domainLabels.INCIDENT, 1),
    });
    await expect(incidentRadio).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByRole('link', { name: indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL, exact: true }),
    ).not.toBeVisible();

    // A hand-edited/stale link naming a domain outside the closed set must
    // degrade to "no filter", never crash or silently omit every card
    // (`use-indicator-overview-state.ts`'s own `parseDomain` doc comment:
    // "drop, don't crash").
    await page.goto('/indicators?domain=NOT_A_REAL_DOMAIN');
    await waitForIndicatorOverviewContent(page);
    const allRadio = page.getByRole('radio', {
      name: indicators.overview.filters.domainAll(INDICATOR_METRIC_KEY_ORDER.length),
    });
    await expect(allRadio).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByRole('link', { name: indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL, exact: true }),
    ).toBeVisible();
  });

  // --------------------------------------------------------------------
  // 5. Atualizar: refetches the summary (one new request) and keeps cards.
  // --------------------------------------------------------------------
  test('Atualizar refetches the summary and keeps cards rendered', async ({ page }) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    const summaryRequests: string[] = [];
    page.on('request', (request) => {
      if (apiPathname(request.url()) === `${API_PREFIX}/dashboard/summary`) {
        summaryRequests.push(request.url());
      }
    });

    await page.getByRole('button', { name: indicators.overview.band.refreshAction }).click();

    await expect.poll(() => summaryRequests.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

    // The previously-loaded data is never cleared while refreshing
    // (`useIndicatorOverview`'s own `isRefreshing` contract) — the same
    // known card stays visible throughout, never replaced by a loading
    // skeleton.
    await expect(
      page.getByRole('link', { name: indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL, exact: true }),
    ).toBeVisible();
    await waitForIndicatorOverviewContent(page);
  });

  // --------------------------------------------------------------------
  // 6. Permission honesty — a caller missing one source permission.
  // --------------------------------------------------------------------
  // `FIXTURE_USER_EMAIL.riskAnalyst` (`platform.seed.ts`'s "Risk Analyst"
  // role) was read directly from the seed file, not guessed: it holds
  // `risk:view`, `action:view`, `asset:view`, `process:view`, `finding:view`
  // — but NOT `control:view` — and `GET /dashboard/summary` is
  // `@NoPermissionRequired()` (any authenticated caller may call it; each
  // key is independently included/omitted by ITS OWN `sourcePermission`,
  // `indicator-metric-catalog.ts`). `CONTROL_INACTIVE_COUNT`'s
  // `sourcePermission` is `control:view` — the one key this role can never
  // read — while `RISK_TOTAL_BY_LEVEL` (risk:view) stays fully visible, so
  // this test proves both halves of FR-006's second gate in one session: an
  // omitted key renders honestly, and a present key is unaffected by it.
  // Requires `SEED_DEV_FIXTURES=true` on the backend this run points at —
  // the SAME requirement `risk-approval.spec.ts` (T152) already carries for
  // this exact fixture account, so no new environment dependency is
  // introduced here. No role is created or mutated by this file.
  test('a caller missing a source permission sees "Requer permissão de" and never a number for that card', async ({
    page,
  }) => {
    // `beforeEach` already signed this `page` in as the worker admin —
    // `signInAsFixtureUser`/`signInAsSeededUser` navigate to `/login` and
    // fill its form, which hangs (and times out the whole test) if `/login`
    // redirects an already-authenticated session away before the form ever
    // renders (found running this spec in isolation: exactly this hang,
    // `Test timeout of 30000ms exceeded`, stuck on `/dashboard`). A real
    // UI sign-out first is what `risk-approval.spec.ts` gets for free by
    // never having its own `beforeEach` admin sign-in; this file's shared
    // one requires this explicit step instead.
    await signOut(page);

    // Genuine unavailability (no `SEED_DEV_FIXTURES=true` at seed time, or a
    // database this fixture was never provisioned against) must SKIP this
    // test with a clear reason — never pass vacuously by silently running
    // against whatever session state happens to be on `page`.
    // `signInAsFixtureUser`/`signInAsSeededUser` throw a descriptive Error
    // ("Sign-in for X did not succeed: ... — is the backend seeded with
    // matching credentials...") when neither the seeded nor the rotated
    // password authenticates — exactly the "genuinely unavailable" signal.
    try {
      await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);
    } catch (error) {
      test.skip(
        true,
        `fixture-risk-analyst@pharosgrc.local is unavailable in this environment — skipping ` +
          `rather than passing vacuously (this fixture requires SEED_DEV_FIXTURES=true when the ` +
          `database was seeded, the same requirement risk-approval.spec.ts already carries for ` +
          `it): ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    const controlLabel = indicators.metricKeyLabels.CONTROL_INACTIVE_COUNT;
    const controlCard = page.getByRole('link', { name: controlLabel, exact: true }).locator('..');
    await expect(
      controlCard.getByText(
        indicators.overview.states.requiresPermission(indicators.overview.domainLabels.CONTROL),
      ),
    ).toBeVisible();
    // Never a bare 0 in place of the honest "missing permission" state
    // (CLAUDE.md §18.11) — assert the digit "0" is NOT what this card shows.
    await expect(controlCard.getByText('0', { exact: true })).toHaveCount(0);

    // A key this role CAN read stays a real number, unaffected by the
    // omission above — the two states coexist correctly in the same load.
    const riskLabel = indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL;
    const riskLegend = page.getByRole('list', {
      name: indicators.overview.card.legendLabel(riskLabel),
    });
    await expect(riskLegend).toBeVisible();
  });

  // --------------------------------------------------------------------
  // 7. Responsive: page scrollWidth === viewport, no interactive control or
  //    value/badge/link text clipped outside the viewport, at the five
  //    supported widths (CLAUDE.md §18's responsive requirement) — EXCEPT
  //    the domain pill strip's own `overflow-x-auto` container
  //    (`indicator-overview-filters.tsx`'s own header: "the wrapping element
  //    here is a plain overflow-x-auto container, so the PILL ROW scrolls
  //    horizontally within its own bounds"), where pills scrolled outside
  //    the container's OWN visible area are expected, not a defect — only
  //    the container itself must stay within the page viewport.
  // --------------------------------------------------------------------
  test('no page horizontal scroll and no clipped value/badge/link/control at 1920/1440/1024/768/390', async ({
    page,
  }) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    for (const width of [1920, 1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      // A resize alone does not refetch — give layout a frame to settle.
      await page.waitForTimeout(150);

      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        scroll.scrollWidth,
        `page scrollWidth must equal the viewport at ${width}px: scrollWidth=${scroll.scrollWidth} clientWidth=${scroll.clientWidth}`,
      ).toBe(scroll.clientWidth);

      const searchBox = page.getByLabel(indicators.overview.filters.searchLabel);
      const searchBoxBox = await searchBox.boundingBox();
      expect(searchBoxBox, `search box must be laid out at ${width}px`).not.toBeNull();
      expect(searchBoxBox!.x + searchBoxBox!.width).toBeLessThanOrEqual(width + 1);
      expect(searchBoxBox!.x).toBeGreaterThanOrEqual(0);

      const refreshButton = page.getByRole('button', {
        name: indicators.overview.band.refreshAction,
      });
      const refreshBox = await refreshButton.boundingBox();
      expect(refreshBox, `Atualizar button must be laid out at ${width}px`).not.toBeNull();
      expect(refreshBox!.x + refreshBox!.width).toBeLessThanOrEqual(width + 1);

      const domainGroupBox = await page
        .getByRole('radiogroup', { name: indicators.overview.filters.domainGroupLabel })
        .boundingBox();
      expect(domainGroupBox, `domain radiogroup must be laid out at ${width}px`).not.toBeNull();

      // Every element carrying its OWN visible text (value, badge, link,
      // caption — a leaf-level check, not container boxes, which are
      // allowed to be wider than their content) must stay inside the
      // viewport horizontally — EXCEPT anything inside the domain pill
      // strip's own scroll container, which is allowed to scroll a pill
      // outside ITS OWN visible area (that container's own box, asserted
      // above, is what must stay in the page viewport).
      const offenders = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const scrollContainer = document
          .querySelector('[role="radiogroup"]')
          ?.closest('.overflow-x-auto');
        const found: { tag: string; text: string; left: number; right: number }[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('body *')) {
          if (scrollContainer?.contains(el)) continue;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const ownText = Array.from(el.childNodes).some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0,
          );
          if (!ownText) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          if (rect.right > viewportWidth + 1 || rect.left < -1) {
            found.push({
              tag: el.tagName,
              text: (el.textContent ?? '').trim().slice(0, 60),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
            });
          }
        }
        return found;
      });
      expect(
        offenders,
        `clipped text-bearing elements at ${width}px (outside the domain pill strip's own scroll container): ${JSON.stringify(offenders)}`,
      ).toEqual([]);
    }
  });
});
