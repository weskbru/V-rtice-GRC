'use client';

/**
 * PharosGRC — risk detail, Audit section (T171, US7, FR-033 to FR-037).
 *
 * Consumes `GET /risks/{riskId}/audit-events` — the raw, append-only audit
 * trail for the risk and its child records. Requires `risk:view` (already
 * needed to reach this screen) **and** `audit:view`.
 *
 * ## Hidden — not disabled, not errored — without `audit:view`
 *
 * This component is never mounted for a caller without `audit:view` in the
 * first place: `RiskDetailView` passes `visible={canViewAudit}` on the
 * "Auditoria" `EntityTab`, exactly like it already gates every other
 * permission-sensitive tab, and `EntityTabs` (`@pharos/design-system`)
 * omits an invisible tab from BOTH the tab list and the mounted content
 * (never renders it disabled — a disabled control would itself disclose
 * that the section exists, FR-030). So the ONLY way this component's own
 * `useEffect` ever runs is that the caller's own permission snapshot
 * already said `audit:view` is present — the same advisory-only mirror
 * every other permission check in this app uses (`usePermissions()`'s own
 * module doc comment).
 *
 * ## Handling a `403` gracefully anyway
 *
 * That client-side snapshot can be stale (a permission revoked seconds ago,
 * before the next `GET /auth/session` refresh) — the server re-checks
 * `audit:view` independently and unconditionally on every request
 * (ADR-003), and this section's own fetch can therefore still come back
 * `403` even though the tab rendered. This is handled explicitly, not left
 * to fall into the generic `loadError` path: a `403` renders
 * `risks.audit.forbidden`'s own title/description via `ErrorState`
 * (through `AuditTimeline`'s `error` prop) instead of the generic "could
 * not load" message, so a caller in this narrow, transient situation is
 * told the true reason rather than a misleading "try again" prompt. Every
 * OTHER failure (network error, 5xx, an out-of-scope/nonexistent risk
 * surfacing as 404) still falls into the generic `loadError` message.
 *
 * ## Making a changed field readable (product owner UAT finding)
 *
 * A raw `{ categoryId: null → "01a071be-…" }` diff is data, not an audit
 * trail a person can read — this section additionally loads the same
 * reference data `RiskForm` loads (categories/types/origins/org units/
 * users) and hands `risks.audit.buildValueResolver` the result, so
 * `AuditTimeline` renders "Categoria: Não registrado → <nome real>" instead
 * of a database column name and a UUID (`buildAuditValueResolver`'s own doc
 * comment in `@/lib/messages/risks` has the full resolution rules,
 * including what an unresolvable id shows and why). This fetch is
 * independent of, and never blocks or fails, the audit-events fetch below —
 * `timelineLabels`' `resolveFieldValue` is simply `undefined` until it
 * resolves, during which a changed field still renders its pt-BR label with
 * the raw value, exactly like an id this catalog has no lookup for at all.
 */
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

  // Reference data (categories/types/origins/org units/users) — the same
  // lookups `RiskForm` already loads to populate its own selects — used
  // ONLY to resolve a changed field's id to the name this app already
  // displays for it (e.g. `categoryId` -> the category's own name), never
  // to gate rendering: a failure here is swallowed and simply leaves ids
  // unresolved (raw, but still labelled and still visible) rather than
  // breaking the audit tab itself, which has its own, independent error
  // handling for the audit events fetch below.
  const [referenceData, setReferenceData] = useState<AuditReferenceData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      risksApi.listCategories(),
      risksApi.listTypes(),
      risksApi.listOrigins(),
      risksApi.listOrgUnits(),
      // Not a picker — a one-off, unsearched id→name lookup TABLE for
      // whatever user ids appear as changed values in this risk's own
      // audit history (S-10, `risksApi.searchUsers`'s own doc comment).
      // `GET /users` has no id-based lookup and no unbounded listing
      // (`list-directory-users-query.dto.ts` caps `pageSize` at 100) — this
      // was already a bounded resolver before this fix (previously
      // `pageSize=100`, unsearched); requesting the same maximum page here
      // preserves exactly that pre-existing resolution rate rather than
      // narrowing it to a picker's smaller per-keystroke page, and does not
      // invent a second, id-based endpoint this contract does not offer. A
      // user id outside this page still renders unresolved (raw, but still
      // labelled) — the same graceful degradation this section already
      // documents above for a failed fetch.
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
      .catch(() => {
        // Deliberately silent — see the state's own doc comment above.
      });
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
        // A `403` here means the server's OWN `audit:view` check refused —
        // see this file's own doc comment for why the tab could still be
        // mounted when that happens. Every other failure keeps the generic
        // message.
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
