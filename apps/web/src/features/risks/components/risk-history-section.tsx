'use client';

/**
 * PharosGRC — risk detail, History section (T170, US7, FR-105, ADR-007).
 *
 * Consumes `GET /risks/{riskId}/history` — a merged, chronological,
 * attributed account of assessments, treatment decisions, lifecycle
 * transitions, approvals and ownership changes (`RiskHistoryQueryService`'s
 * own header comment has the full reasoning for what is merged and why).
 * Available to anyone who can see the risk at all (`risk:view`, already
 * required to reach this screen) — unlike `RiskAuditSection`, this section
 * carries no additional permission gate.
 *
 * ## The recorded-instant vs. asserted-date distinction (F-9) is never flattened
 *
 * Every entry carries `occurredAt` — the instant the platform RECORDED it,
 * always present, and what the server orders the timeline by. Only
 * `ASSESSMENT` entries also carry `assessedOn` — the date the ASSESSOR
 * asserts and can backdate. This component passes both straight through to
 * `ActivityHistory` (`@pharos/design-system`, T169) as two SEPARATELY
 * labeled facts (`recordedAtLabel`/`assertedDateLabel`) rather than
 * collapsing them into one "date" column — exactly the "quiet dishonesty"
 * the task brief warns a GRC audit trail cannot afford. `occurredAt` is
 * formatted with `toLocaleString` (date AND time — a genuine instant);
 * `assessedOn` is formatted with `formatDateOnly` (date only, matching its
 * `@db.Date` storage, per `RiskAssessment.assessedOn`'s own convention
 * elsewhere in this app) — the two therefore look visibly different even
 * on the rare occasion they name the same calendar day.
 *
 * ## The `type` filter is exposed (a deliberate choice, not the default)
 *
 * The contract's `type` query parameter is real and genuinely narrows a
 * long-lived risk's history (FR-105 lists five kinds of change this single
 * chronology already merges) — a reviewer tracing, say, only the approval
 * trail of a risk with dozens of assessments benefits from filtering rather
 * than scrolling. Exposed as a `MultiSelectFilter` (`@pharos/design-system`,
 * already the register's own filter primitive, T109) offering every
 * `RiskHistoryEntryType` the contract declares — including the four
 * `RiskHistoryQueryService` does not populate yet (`LEVEL_CHANGE`,
 * `TREATMENT_ACTION`, `CONTROL_LINK`, `FIELD_CHANGE`) — so this filter
 * needs no update the day that service starts emitting one of them; an
 * option that currently matches nothing behaves exactly like any other
 * filter with zero results, which is not a defect.
 */
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
    // F-9 — a SEPARATE, distinctly labeled fact; never merged with
    // `occurredAtLabel` above even when both name the same calendar day.
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

  // Derived "loading" — mirrors `AssessmentHistory`/`TreatmentHistory`'s own
  // convention exactly: never `setLoading(true)` synchronously in the
  // effect body (`react-hooks/set-state-in-effect`).
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
