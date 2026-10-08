'use client';

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
