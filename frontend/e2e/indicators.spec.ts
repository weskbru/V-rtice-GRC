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

const API_PREFIX = '/api/v1';

function apiPathname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return null;
  }
}

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

function parseLeadingCount(text: string): number | null {
  const cleaned = text.trim();
  if (/^nenhum/i.test(cleaned)) return 0;
  const match = /^([\d.,]+)/.exec(cleaned);
  if (!match) return null;
  const digits = match[1]!.replace(/\./g, '').replace(/,.*/, '');
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

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

    expect(
      currentRequests,
      `unexpected /current requests: ${JSON.stringify(currentRequests)}`,
    ).toEqual([]);

    expect(summaryRequests.length, JSON.stringify(summaryRequests)).toBeGreaterThanOrEqual(1);
    expect(summaryRequests.length, JSON.stringify(summaryRequests)).toBeLessThanOrEqual(2);
    expect(definitionsRequests.length, JSON.stringify(definitionsRequests)).toBeGreaterThanOrEqual(
      1,
    );
    expect(definitionsRequests.length, JSON.stringify(definitionsRequests)).toBeLessThanOrEqual(2);
  });

  test('all 11 indicators render, and every displayed value/bucket matches /dashboard/summary', async ({
    page,
  }) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    const summary = await fetchDashboardSummary(page);

    for (const metricKey of INDICATOR_METRIC_KEY_ORDER) {
      const label = indicators.metricKeyLabels[metricKey];
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    }

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
        const bucketRow = legend.getByRole('listitem').filter({ hasText: levelLabel });
        await expect(bucketRow).toBeVisible();
        await expect(
          bucketRow.getByText(count.toLocaleString('pt-BR'), { exact: true }),
        ).toBeVisible();
      }
    }
  });

  test('navigation links land on a register whose rendered count equals the indicator value', async ({
    page,
  }) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    const summary = await fetchDashboardSummary(page);

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

  test('search narrows the visible cards and writes q to the URL', async ({ page }) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

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

    await expect(
      page.getByRole('link', { name: indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL, exact: true }),
    ).toBeVisible();
    await waitForIndicatorOverviewContent(page);
  });

  test('a caller missing a source permission sees "Requer permissão de" and never a number for that card', async ({
    page,
  }) => {
    await signOut(page);

    try {
      await signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst);
    } catch (error) {
      test.skip(
        true,
        `fixture-risk-analyst@verticegrc.local is unavailable in this environment — skipping ` +
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
    await expect(controlCard.getByText('0', { exact: true })).toHaveCount(0);

    const riskLabel = indicators.metricKeyLabels.RISK_TOTAL_BY_LEVEL;
    const riskLegend = page.getByRole('list', {
      name: indicators.overview.card.legendLabel(riskLabel),
    });
    await expect(riskLegend).toBeVisible();
  });

  test('no page horizontal scroll and no clipped value/badge/link/control at 1920/1440/1024/768/390', async ({
    page,
  }) => {
    await page.goto('/indicators');
    await waitForIndicatorOverviewContent(page);

    for (const width of [1920, 1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
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
