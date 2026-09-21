/**
 * PharosGRC — search/domain filtering for the redesigned `/indicators` first
 * screen (indicators-round, S1 ownership, coordinator PLAN.md §2 step 3).
 *
 * Deliberately separate from S2's `indicator-overview-model.ts`: that module
 * turns a `GET /dashboard/summary` response into the platform's own facts
 * (which domain a key belongs to, what its current value is, whether a
 * navigation link is exact and permitted) — this module narrows an
 * ALREADY-BUILT `IndicatorOverviewItem[]` by the VIEWER's own search text and
 * domain choice, a presentation-layer concern with no server data of its
 * own. Nothing here computes a metric, a domain, or a navigation link — it
 * only filters and counts what `buildIndicatorOverviewItems` already
 * produced, reading each item's display name from `indicators
 * .metricKeyLabels` (the one owning catalog, CLAUDE.md §13.8), never a
 * second copy of it.
 */
import { indicators } from '@/lib/messages/indicators';

import type { IndicatorDomain, IndicatorOverviewItem } from './indicator-overview-model';

export type IndicatorDomainFilterValue = IndicatorDomain | 'ALL';

/**
 * Display order for domain filter chips AND for cards within each section —
 * the shell sidebar's own order (`navigation-registry.ts`: Riscos, Planos de
 * Ação, Problemas, Incidentes, Controles, Ativos, Processos, Compliance,
 * Auditoria), with `FINDING` appended right after `AUDIT` since Achado has
 * no sidebar entry of its own (a sub-resource of Auditoria, same reasoning
 * `indicators.overview.domainLabels`'s own header gives). Deliberately NOT
 * the closed catalog's own key order (`INDICATOR_METRIC_KEY_ORDER`, which is
 * backend-declaration order, e.g. Compliance before Achado before Ativos) —
 * a viewer scanning this screen reads it against the SAME mental order the
 * sidebar already taught them, not against an API implementation detail.
 */
export const INDICATOR_DOMAIN_ORDER: readonly IndicatorDomain[] = [
  'RISK',
  'ACTION',
  'PROBLEM',
  'INCIDENT',
  'CONTROL',
  'ASSET',
  'PROCESS',
  'COMPLIANCE',
  'AUDIT',
  'FINDING',
];

/** Sorts by `INDICATOR_DOMAIN_ORDER` — a new array, the input is never mutated. Used for both the domain filter chips and the card order inside each section, so the two never disagree with each other. */
export function sortByIndicatorDomainOrder<T extends { readonly domain: IndicatorDomain }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => INDICATOR_DOMAIN_ORDER.indexOf(a.domain) - INDICATOR_DOMAIN_ORDER.indexOf(b.domain),
  );
}

export interface IndicatorOverviewFilterState {
  readonly query: string;
  readonly domain: IndicatorDomainFilterValue;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

/** `query` matches the metric's own pt-BR name (the only thing this screen searches — the catalog is closed and has no other free-text field, `s1-backend-domain.md` Q9/Q11). */
export function filterIndicatorOverviewItems(
  items: readonly IndicatorOverviewItem[],
  filter: IndicatorOverviewFilterState,
): readonly IndicatorOverviewItem[] {
  const query = normalize(filter.query);

  return items.filter((item) => {
    if (filter.domain !== 'ALL' && item.domain !== filter.domain) {
      return false;
    }
    if (query && !normalize(indicators.metricKeyLabels[item.metricKey]).includes(query)) {
      return false;
    }
    return true;
  });
}

export interface IndicatorDomainCount {
  readonly value: IndicatorDomain;
  readonly count: number;
}

/**
 * Every domain present in `items`, in `INDICATOR_DOMAIN_ORDER` (sidebar
 * order) — never catalog/first-seen order, so the domain chip row always
 * reads in the same order the sidebar already taught the viewer. Counts the
 * FULL, unfiltered item list (never the search-narrowed one): the closed
 * 11-key catalog's domain distribution is structurally fixed, so a chip's
 * own count staying stable while the viewer types a search term is the more
 * legible choice — "Riscos (2)" should not itself change to "Riscos (1)"
 * mid-keystroke.
 */
export function buildIndicatorDomainCounts(
  items: readonly IndicatorOverviewItem[],
): readonly IndicatorDomainCount[] {
  const counts = new Map<IndicatorDomain, number>();
  for (const item of items) {
    counts.set(item.domain, (counts.get(item.domain) ?? 0) + 1);
  }
  return INDICATOR_DOMAIN_ORDER.flatMap((domain) => {
    const count = counts.get(domain);
    return count === undefined ? [] : [{ value: domain, count }];
  });
}
