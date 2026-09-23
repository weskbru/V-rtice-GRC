'use client';

import { AuditTimeline } from '@pharos/design-system/components';
import { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { risks } from '@/lib/messages/risks';

import { risksApi } from '../api';

import type { AuditEvent, OrgUnitNode, ReferenceDataItem, UserRef } from '../types';
import type { AuditReferenceData } from '@/lib/messages/risks';
import type { AuditTimelineEntry, AuditTimelineLabels } from '@pharos/design-system/components';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface RiskAuditSectionProps {
  riskId: string;
}

const PAGE_SIZE = 20;

function toAuditTimelineEntry(entry: AuditEvent): AuditTimelineEntry {
  return {
    id: entry.id,
    occurredAtLabel: new Date(entry.occurredAt).toLocaleString('pt-BR'),
    actorLabel: entry.actorLabel,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    outcome: entry.outcome,
    previousValues: entry.previousValues,
    newValues: entry.newValues,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    correlationId: entry.correlationId,
  };
}

export function RiskAuditSection({ riskId }: RiskAuditSectionProps): React.JSX.Element {
  const [items, setItems] = useState<readonly AuditEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorProblem, setErrorProblem] = useState<ErrorStateProblem | null>(null);

  const [resolvedRiskId, setResolvedRiskId] = useState<string | null>(null);
  const loading = resolvedRiskId !== riskId;

  const [referenceData, setReferenceData] = useState<AuditReferenceData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      risksApi.listCategories(),
      risksApi.listTypes(),
      risksApi.listOrigins(),
      risksApi.listOrgUnits(),
      risksApi.searchUsers('', undefined, 100),
    ])
      .then(
        ([categories, types, origins, orgUnits, usersPage]: [
          ReferenceDataItem[],
          ReferenceDataItem[],
          ReferenceDataItem[],
          OrgUnitNode[],
          { data: UserRef[]; isPartial: boolean },
        ]) => {
          if (cancelled) return;
          setReferenceData({ categories, types, origins, orgUnits, users: usersPage.data });
        },
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const timelineLabels: AuditTimelineLabels = useMemo(
    () => ({
      ...risks.audit,
      resolveFieldValue: referenceData ? risks.audit.buildValueResolver(referenceData) : undefined,
    }),
    [referenceData],
  );

  useEffect(() => {
    let cancelled = false;
    risksApi
      .listAuditEvents(riskId, 1, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.data);
        setPage(1);
        setTotalPages(Math.max(1, result.meta.totalPages));
        setErrorProblem(null);
        setResolvedRiskId(riskId);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 403) {
          setErrorProblem(risks.audit.forbidden);
        } else {
          setErrorProblem({ detail: risks.audit.loadError });
        }
        setResolvedRiskId(riskId);
      });
    return () => {
      cancelled = true;
    };
  }, [riskId]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await risksApi.listAuditEvents(riskId, nextPage, PAGE_SIZE);
      setItems((current) => [...current, ...result.data]);
      setPage(nextPage);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch {
      setErrorProblem({ detail: risks.audit.loadError });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{risks.audit.cardTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{risks.audit.cardDescription}</p>
      </CardHeader>
      <CardContent>
        <AuditTimeline
          items={items.map(toAuditTimelineEntry)}
          labels={timelineLabels}
          isLoading={loading}
          error={errorProblem && items.length === 0 ? errorProblem : undefined}
          hasMore={page < totalPages}
          isLoadingMore={loadingMore}
          onLoadMore={() => void loadMore()}
        />
      </CardContent>
    </Card>
  );
}
