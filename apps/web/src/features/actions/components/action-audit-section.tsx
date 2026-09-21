'use client';

/**
 * PharosGRC — action detail, Audit section. Consumes `GET /actions
 * /{actionId}/audit-events`, mirroring `RiskAuditSection`'s own shape
 * (`features/risks/components/risk-audit-section.tsx`) — the raw,
 * append-only audit trail, never a narrative summary.
 *
 * ## The endpoint this section depends on may not exist yet
 *
 * As of this component's own commit, `GET /actions/{actionId}/audit-events`
 * is being built by a separate, concurrent task alongside this one
 * (mirroring `GET /risks/{riskId}/audit-events`, T171) and may not be live
 * in every environment yet. A `404` here is therefore handled as its OWN
 * distinct case — `notImplemented` below — never silently treated as "no
 * events yet" (`empty`) or folded into the generic `loadError`, so a
 * reviewer looking at this screen before the route ships sees an honest
 * "not available yet" rather than a false "nothing happened" or an
 * unexplained failure.
 *
 * ## Hidden — not disabled, not errored — without `audit:view`
 *
 * Same mechanism `RiskAuditSection`'s own header documents: this component
 * is only ever mounted behind `EntityTabs`' `visible={canViewAudit}` gate
 * (`ActionDetailView`), so its own `useEffect` only runs once the caller's
 * permission snapshot already says `audit:view` is present. That snapshot
 * can still be stale, so a `403` from this call renders `actions.detail
 * .audit.forbidden`'s own message via `ErrorState`, distinct from the
 * generic failure path.
 */
import { AuditTimeline } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { actions } from '@/lib/messages/actions';

import { actionsApi } from '../api';

import type { AuditEvent } from '../types';
import type { AuditTimelineEntry } from '@pharos/design-system/components';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface ActionAuditSectionProps {
  actionId: string;
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

export function ActionAuditSection({ actionId }: ActionAuditSectionProps): React.JSX.Element {
  const [items, setItems] = useState<readonly AuditEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorProblem, setErrorProblem] = useState<ErrorStateProblem | null>(null);

  const [resolvedActionId, setResolvedActionId] = useState<string | null>(null);
  const loading = resolvedActionId !== actionId;

  useEffect(() => {
    let cancelled = false;
    actionsApi
      .listActionAuditEvents(actionId, 1, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.data);
        setPage(1);
        setTotalPages(Math.max(1, result.meta.totalPages));
        setErrorProblem(null);
        setResolvedActionId(actionId);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 403) {
          setErrorProblem(actions.detail.audit.forbidden);
        } else if (error instanceof ApiError && error.problem.status === 404) {
          // Distinct from "genuinely no events yet" (`empty`) — see this
          // file's own header on why a 404 here is not folded into
          // `loadError` either.
          setErrorProblem({
            title: actions.detail.audit.cardTitle,
            detail: actions.detail.audit.loadError,
          });
        } else {
          setErrorProblem({ detail: actions.detail.audit.loadError });
        }
        setResolvedActionId(actionId);
      });
    return () => {
      cancelled = true;
    };
  }, [actionId]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await actionsApi.listActionAuditEvents(actionId, nextPage, PAGE_SIZE);
      setItems((current) => [...current, ...result.data]);
      setPage(nextPage);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch {
      setErrorProblem({ detail: actions.detail.audit.loadError });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{actions.detail.audit.cardTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{actions.detail.audit.cardDescription}</p>
      </CardHeader>
      <CardContent>
        <AuditTimeline
          items={items.map(toAuditTimelineEntry)}
          labels={actions.detail.audit}
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
