'use client';

import { ActivityHistory, MultiSelectFilter } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { risks } from '@/lib/messages/risks';

import { risksApi } from '../api';
import { formatDateOnly } from '../date';

import type { RiskHistoryEntry, RiskHistoryEntryType } from '../types';
import type { ActivityHistoryEntry } from '@pharos/design-system/components';

export interface RiskHistorySectionProps {
  riskId: string;
}

const PAGE_SIZE = 20;

const HISTORY_ENTRY_TYPES: readonly RiskHistoryEntryType[] = [
  'ASSESSMENT',
  'LEVEL_CHANGE',
  'OWNERSHIP_CHANGE',
  'TREATMENT_DECISION',
  'TREATMENT_ACTION',
  'CONTROL_LINK',
  'LIFECYCLE_TRANSITION',
  'APPROVAL',
  'FIELD_CHANGE',
];

const TYPE_FILTER_OPTIONS = HISTORY_ENTRY_TYPES.map((value) => ({
  value,
  label: risks.history.typeLabels[value],
}));

function toActivityEntry(entry: RiskHistoryEntry): ActivityHistoryEntry {
  return {
    id: entry.id,
    kindLabel: risks.history.typeLabels[entry.type],
    occurredAtLabel: new Date(entry.occurredAt).toLocaleString('pt-BR'),
    assertedDateLabel: entry.assessedOn ? formatDateOnly(entry.assessedOn) : null,
    actorName: entry.actor.fullName,
    summary: entry.summary,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
  };
}

export function RiskHistorySection({ riskId }: RiskHistorySectionProps): React.JSX.Element {
  const [selectedTypes, setSelectedTypes] = useState<readonly string[]>([]);
  const [items, setItems] = useState<readonly RiskHistoryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const requestKey = `${riskId}|${selectedTypes.join(',')}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    risksApi
      .listHistory(riskId, 1, PAGE_SIZE, selectedTypes as readonly RiskHistoryEntryType[])
      .then((result) => {
        if (cancelled) return;
        setItems(result.data);
        setPage(1);
        setTotalPages(Math.max(1, result.meta.totalPages));
        setError(false);
        setResolvedRequestKey(requestKey);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setResolvedRequestKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from `riskId`/`selectedTypes`, both already listed.
  }, [riskId, selectedTypes]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await risksApi.listHistory(
        riskId,
        nextPage,
        PAGE_SIZE,
        selectedTypes as readonly RiskHistoryEntryType[],
      );
      setItems((current) => [...current, ...result.data]);
      setPage(nextPage);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div>
          <CardTitle className="text-base">{risks.history.cardTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{risks.history.cardDescription}</p>
        </div>
        <MultiSelectFilter
          label={risks.history.filter.label}
          options={TYPE_FILTER_OPTIONS}
          selected={selectedTypes}
          onChange={setSelectedTypes}
        />
      </CardHeader>
      <CardContent>
        <ActivityHistory
          items={items.map(toActivityEntry)}
          labels={risks.history}
          isLoading={loading}
          error={error && items.length === 0 ? { detail: risks.history.loadError } : undefined}
          hasMore={page < totalPages}
          isLoadingMore={loadingMore}
          onLoadMore={() => void loadMore()}
        />
      </CardContent>
    </Card>
  );
}
