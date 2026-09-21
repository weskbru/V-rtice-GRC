'use client';

/**
 * PharosGRC — the redesigned `/indicators` first screen: a "central de
 * indicadores de GRC" (indicators-round, S1 ownership, coordinator
 * PLAN.md §2/§3).
 *
 * Replaces the PREVIOUS static 11-card grid (`s3-baseline.md`'s own
 * baseline capture measured 11 independent `GET /indicators/{key}/current`
 * requests on load, 22 under React StrictMode, colliding with the global
 * rate limiter — F-59) with ONE composition over S2's `useIndicatorOverview`
 * (`../overview/use-indicator-overview.ts`), which fires exactly two
 * requests: `GET /dashboard/summary` (the batch source for all 11 current
 * values, PLAN.md §1) and `GET /indicators` (definitions, for threshold/
 * description text only).
 *
 * ## Composition, not calculation
 *
 * This file reads `item.shape`/`item.reading.kind` to decide WHICH already-
 * built card to render — it never computes a value, a domain, a threshold,
 * or a navigation link itself (CLAUDE.md §19.7): every fact rendered here
 * was already produced by S2's `buildIndicatorOverviewItems`
 * (`../overview/indicator-overview-model.ts`).
 *
 * ## Two sections, split by SHAPE — never by availability
 *
 * "Composição por nível e severidade" (the four `BY_BUCKET` keys) and
 * "Contagens e percentuais" (the seven `SINGLE_VALUE` keys) are fixed by the
 * closed catalog's own `shape` field, not by whether a caller can currently
 * read each key — an unavailable `BY_BUCKET` key still renders in the
 * distribution section (as `IndicatorUnavailableItemCard`), never migrates
 * to the other section. This is also what fixes the baseline's own measured
 * row-stretch defect (`s3-baseline.md` §4/§6): a tall `BY_BUCKET` card no
 * longer shares a CSS grid row with three short `SINGLE_VALUE` cards.
 *
 * ## The one per-card scope exception
 *
 * `COMPLIANCE_PERCENTAGE` is the only `ORGANIZATION_WIDE` key
 * (`s1-backend-domain.md` Q15) — its card gets a `scopeNote` ONLY when the
 * caller's OWN resolved scope (`useAuth().scope.global`) is not already
 * global, so the context band's single scope statement is never silently
 * wrong for this one card.
 */
import { useAuth } from '@/lib/auth-context';
import { indicators } from '@/lib/messages/indicators';

import { useIndicatorOverviewState } from '../hooks/use-indicator-overview-state';
import { IndicatorDistributionCard } from '../overview/components/indicator-distribution-card';
import { IndicatorOverviewContextBand } from '../overview/components/indicator-overview-context-band';
import { IndicatorOverviewEmpty } from '../overview/components/indicator-overview-empty';
import { IndicatorOverviewError } from '../overview/components/indicator-overview-error';
import { IndicatorOverviewFilters } from '../overview/components/indicator-overview-filters';
import { IndicatorOverviewLoading } from '../overview/components/indicator-overview-loading';
import { IndicatorOverviewSection } from '../overview/components/indicator-overview-section';
import { IndicatorSingleValueCard } from '../overview/components/indicator-single-value-card';
import { IndicatorUnavailableItemCard } from '../overview/components/indicator-unavailable-item-card';
import {
  buildIndicatorDomainCounts,
  filterIndicatorOverviewItems,
  sortByIndicatorDomainOrder,
} from '../overview/filter-indicator-items';
import { useIndicatorOverview } from '../overview/use-indicator-overview';

import type { IndicatorOverviewItem, IndicatorReading } from '../overview/indicator-overview-model';

/**
 * Narrows a `SINGLE_VALUE` item's reading for `IndicatorSingleValueCard`.
 * Only ever called for an item whose `reading.kind` the caller already
 * confirmed is NOT `'no-permission'` (`renderSingleValueItem`'s own branch
 * above it) — `'buckets'` is additionally structurally unreachable for a
 * `SINGLE_VALUE` shape (every such key's provider only ever produces
 * `'single'`/`'no-data'`, `s1-backend-domain.md` Q9), but the TYPE does not
 * encode either correlation. Falling back to `'no-data'` for anything else
 * — rather than an unchecked cast — keeps this branch crash-free if either
 * invariant is ever violated, instead of rendering a wrong number.
 */
function toSingleCardReading(
  reading: IndicatorReading,
): Extract<IndicatorReading, { kind: 'single' } | { kind: 'no-data' }> {
  return reading.kind === 'single' || reading.kind === 'no-data' ? reading : { kind: 'no-data' };
}

function renderDistributionItem(item: IndicatorOverviewItem): React.ReactNode {
  const name = indicators.metricKeyLabels[item.metricKey];

  if (item.reading.kind === 'no-permission') {
    return (
      <IndicatorUnavailableItemCard
        key={item.metricKey}
        domain={item.domain}
        name={name}
        detailHref={item.detailHref}
        reason="no-permission"
        variant="wide"
      />
    );
  }

  if (item.reading.kind !== 'buckets') {
    return (
      <IndicatorUnavailableItemCard
        key={item.metricKey}
        domain={item.domain}
        name={name}
        detailHref={item.detailHref}
        reason="no-data"
        variant="wide"
      />
    );
  }

  return (
    <IndicatorDistributionCard
      key={item.metricKey}
      domain={item.domain}
      name={name}
      detailHref={item.detailHref}
      total={item.reading.total}
      buckets={item.reading.buckets}
      recordsHref={item.recordsHref}
    />
  );
}

function renderSingleValueItem(
  item: IndicatorOverviewItem,
  callerScopeGlobal: boolean,
): React.ReactNode {
  const name = indicators.metricKeyLabels[item.metricKey];

  if (item.reading.kind === 'no-permission') {
    return (
      <IndicatorUnavailableItemCard
        key={item.metricKey}
        domain={item.domain}
        name={name}
        detailHref={item.detailHref}
        reason="no-permission"
        variant="compact"
      />
    );
  }

  const scopeNote =
    item.scopeApplicability === 'ORGANIZATION_WIDE' && !callerScopeGlobal
      ? indicators.overview.card.scopeNoteOrganizationWide
      : undefined;

  return (
    <IndicatorSingleValueCard
      key={item.metricKey}
      domain={item.domain}
      name={name}
      detailHref={item.detailHref}
      reading={toSingleCardReading(item.reading)}
      threshold={item.threshold}
      definitionDescription={item.definition?.description}
      recordsHref={item.recordsHref}
      scopeNote={scopeNote}
    />
  );
}

export function IndicatorCatalogView(): React.JSX.Element {
  const { scope } = useAuth();
  const overview = useIndicatorOverview();
  const filterState = useIndicatorOverviewState();

  if (overview.status === 'loading') {
    return <IndicatorOverviewLoading />;
  }

  if (!overview.data) {
    return <IndicatorOverviewError onRetry={overview.refresh} />;
  }

  const { items, monitoring, fetchedAt } = overview.data;
  const availableCount = items.filter((item) => item.reading.kind !== 'no-permission').length;
  const domainOptions = buildIndicatorDomainCounts(items);
  const filteredItems = filterIndicatorOverviewItems(items, {
    query: filterState.query,
    domain: filterState.domain,
  });
  // Sidebar order, not catalog/key order — see `sortByIndicatorDomainOrder`'s
  // own header: the same order the domain filter chips themselves use
  // (`buildIndicatorDomainCounts` above), so a card's position in its
  // section never disagrees with the chip row above it.
  const distributionItems = sortByIndicatorDomainOrder(
    filteredItems.filter((item) => item.shape === 'BY_BUCKET'),
  );
  const singleValueItems = sortByIndicatorDomainOrder(
    filteredItems.filter((item) => item.shape === 'SINGLE_VALUE'),
  );

  return (
    <div className="flex flex-col gap-6">
      <IndicatorOverviewContextBand
        totalCount={items.length}
        availableCount={availableCount}
        scopeGlobal={scope.global}
        fetchedAt={fetchedAt}
        monitoring={monitoring}
        isRefreshing={overview.isRefreshing}
        onRefresh={overview.refresh}
      />

      <IndicatorOverviewFilters
        query={filterState.query}
        onQueryChange={filterState.setQuery}
        totalCount={items.length}
        domainOptions={domainOptions}
        activeDomain={filterState.domain}
        onDomainChange={filterState.setDomain}
        hasActiveFilters={filterState.hasActiveFilters}
        onClearFilters={filterState.clearFilters}
      />

      {overview.definitionsUnavailable ? (
        <p className="text-xs text-muted-foreground">
          {indicators.overview.states.definitionsUnavailableNote}
        </p>
      ) : null}

      {filteredItems.length === 0 ? (
        <IndicatorOverviewEmpty onClearFilters={filterState.clearFilters} />
      ) : (
        <>
          {distributionItems.length > 0 ? (
            <IndicatorOverviewSection
              title={indicators.overview.sections.distributionTitle}
              variant="wide"
            >
              {distributionItems.map((item) => renderDistributionItem(item))}
            </IndicatorOverviewSection>
          ) : null}

          {singleValueItems.length > 0 ? (
            <IndicatorOverviewSection
              title={indicators.overview.sections.singleValueTitle}
              variant="compact"
            >
              {singleValueItems.map((item) => renderSingleValueItem(item, scope.global))}
            </IndicatorOverviewSection>
          ) : null}
        </>
      )}
    </div>
  );
}
