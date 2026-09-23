'use client';

import {
  ConfirmDialog,
  DisclosureGroup,
  EmptyState,
  ErrorState,
  StatusBadge,
} from '@pharos/design-system/components';
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auditEngagementsApi } from '@/features/audit-engagements/api';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { findings as findingsMessages } from '@/lib/messages/findings';

import { findingsApi } from '../api';

import { FindingCloseDialog } from './finding-close-dialog';
import { FindingCorrectiveActions } from './finding-corrective-actions';
import { FindingCreateDialog } from './finding-create-dialog';
import { FindingEditDialog } from './finding-edit-dialog';
import { FindingLinksSection } from './finding-links-section';
import { FindingRemediationAction } from './finding-remediation-action';
import { FindingReopenDialog } from './finding-reopen-dialog';

import type { Finding, FindingSeverity } from '../types';

const { findingsFromEngagement } = auditEngagements;

export interface FindingsPanelProps {
  orgUnitId: string;
  defaultOwnerUserId: string;
  canCreate: boolean;
  canEdit: boolean;
  canClose: boolean;
  canAdminister: boolean;
  canRemediate: boolean;
  canLinkFindings: boolean;
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function findingCardLabel(item: Finding): string {
  return `${item.code} — ${item.title}`;
}

const SEVERITY_VARIANT: Record<FindingSeverity, 'neutral' | 'info' | 'warning' | 'danger'> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const STATUS_VARIANT: Record<Finding['status'], 'info' | 'warning' | 'success' | 'neutral'> = {
  OPEN: 'info',
  IN_REMEDIATION: 'warning',
  CLOSED: 'success',
  ARCHIVED: 'neutral',
};

function findingOriginNotice(
  item: Finding,
  engagementCodeById: Readonly<Record<string, string | null>>,
): string | null {
  if (item.auditEngagementId === null) return findingsFromEngagement.manualOriginNotice;
  const code = engagementCodeById[item.auditEngagementId];
  if (code === undefined) return null;
  return code === null
    ? findingsFromEngagement.originNoticeUnknown
    : findingsFromEngagement.originNotice(code);
}

export function FindingsPanel({
  orgUnitId,
  defaultOwnerUserId,
  canCreate,
  canEdit,
  canClose,
  canAdminister,
  canRemediate,
  canLinkFindings,
}: FindingsPanelProps): React.JSX.Element {
  const [items, setItems] = useState<readonly Finding[]>([]);
  const [error, setError] = useState(false);

  const [engagementCodeById, setEngagementCodeById] = useState<Record<string, string | null>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Finding | null>(null);
  const [closeTarget, setCloseTarget] = useState<Finding | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Finding | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Finding | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [expandedActionsFindingIds, setExpandedActionsFindingIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  function toggleActionsExpanded(findingId: string): void {
    setExpandedActionsFindingIds((current) => {
      const next = new Set(current);
      if (next.has(findingId)) {
        next.delete(findingId);
      } else {
        next.add(findingId);
      }
      return next;
    });
  }

  const [resolvedOrgUnitId, setResolvedOrgUnitId] = useState<string | null>(null);
  const loading = resolvedOrgUnitId !== orgUnitId;

  useEffect(() => {
    let cancelled = false;
    findingsApi
      .listByOrgUnit(orgUnitId)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setResolvedOrgUnitId(orgUnitId);
      });
    return () => {
      cancelled = true;
    };
  }, [orgUnitId]);

  useEffect(() => {
    const unresolvedIds = Array.from(
      new Set(
        items
          .map((item) => item.auditEngagementId)
          .filter((id): id is string => id !== null && !(id in engagementCodeById)),
      ),
    );
    if (unresolvedIds.length === 0) return;
    let cancelled = false;
    void Promise.all(
      unresolvedIds.map(async (id) => {
        try {
          const { engagement } = await auditEngagementsApi.getEngagement(id);
          return [id, engagement.code] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setEngagementCodeById((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running on `engagementCodeById` itself would loop; `unresolvedIds` is already derived from both `items` and it.
  }, [items]);

  function replaceItem(updated: Finding): void {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  function addItem(created: Finding): void {
    setItems((current) => [created, ...current]);
  }

  function refreshFindingCounts(findingId: string): void {
    void findingsApi
      .getFinding(findingId)
      .then(replaceItem)
      .catch(() => undefined);
  }

  async function confirmArchive(): Promise<void> {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const archived = await findingsApi.archiveFinding(archiveTarget.id);
      replaceItem(archived);
      setArchiveTarget(null);
    } catch {
    } finally {
      setArchiving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{findingsMessages.panel.cardTitle}</CardTitle>
          <CardDescription>{findingsMessages.panel.cardDescription}</CardDescription>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {findingsMessages.panel.newAction}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{findingsMessages.panel.loading}</p>
        ) : error ? (
          <ErrorState problem={{ title: findingsMessages.panel.loadError }} />
        ) : items.length === 0 ? (
          <EmptyState variant="empty" title={findingsMessages.panel.empty} />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border border-border">
                <DisclosureGroup
                  title={<span className="font-medium">{findingCardLabel(item)}</span>}
                  meta={
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        variant={STATUS_VARIANT[item.status]}
                        label={findingsMessages.statusLabels[item.status]}
                      />
                      <StatusBadge
                        variant={SEVERITY_VARIANT[item.severity]}
                        label={findingsMessages.severityLabels[item.severity]}
                      />
                    </span>
                  }
                  contentClassName="flex flex-col gap-3 px-3 pb-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm text-muted-foreground">
                        {findingsMessages.categoryLabels[item.category]} ·{' '}
                        {findingsMessages.originLabels[item.origin]} ·{' '}
                        {findingsMessages.priorityLabels[item.priority]}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {findingsMessages.panel.ownerLabel(item.owner.fullName)} ·{' '}
                        {findingsMessages.panel.identifiedOnLabel(
                          formatDateOnly(item.identifiedOn),
                        )}
                      </p>
                      <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                        <button
                          type="button"
                          aria-expanded={expandedActionsFindingIds.has(item.id)}
                          aria-controls={`finding-corrective-actions-${item.id}`}
                          onClick={() => toggleActionsExpanded(item.id)}
                          className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {findingsMessages.panel.openActionCountLabel(item.openActionCount)}
                          {expandedActionsFindingIds.has(item.id) ? (
                            <ChevronUp aria-hidden="true" className="size-3.5" />
                          ) : (
                            <ChevronDown aria-hidden="true" className="size-3.5" />
                          )}
                          <span className="sr-only">
                            {expandedActionsFindingIds.has(item.id)
                              ? auditEngagements.correctiveActions.toggleCollapseSr
                              : auditEngagements.correctiveActions.toggleExpandSr}
                          </span>
                        </button>
                        <span>·</span>
                        <span>{findingsMessages.panel.evidenceCountLabel(item.evidenceCount)}</span>
                      </p>
                      <p className="text-sm">{item.description}</p>
                      {item.recommendation ? (
                        <p className="text-sm text-muted-foreground">{item.recommendation}</p>
                      ) : null}
                      {item.closureJustification ? (
                        <p className="text-sm text-muted-foreground">
                          {findingsMessages.panel.closureJustificationLabel(
                            item.closureJustification,
                          )}
                        </p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        {findingOriginNotice(item, engagementCodeById)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {canEdit && item.status !== 'ARCHIVED' ? (
                        <Button size="sm" variant="outline" onClick={() => setEditTarget(item)}>
                          <Pencil aria-hidden="true" className="size-4" />
                          {findingsMessages.panel.editAction}
                        </Button>
                      ) : null}
                      {canRemediate ? (
                        <FindingRemediationAction finding={item} onRemediated={replaceItem} />
                      ) : null}
                      {canClose && (item.status === 'OPEN' || item.status === 'IN_REMEDIATION') ? (
                        <Button size="sm" variant="outline" onClick={() => setCloseTarget(item)}>
                          <ShieldCheck aria-hidden="true" className="size-4" />
                          {findingsMessages.panel.closeAction}
                        </Button>
                      ) : null}
                      {canClose && item.status === 'CLOSED' ? (
                        <Button size="sm" variant="outline" onClick={() => setReopenTarget(item)}>
                          <RotateCcw aria-hidden="true" className="size-4" />
                          {findingsMessages.panel.reopenAction}
                        </Button>
                      ) : null}
                      {canAdminister && item.status === 'CLOSED' ? (
                        <Button size="sm" variant="outline" onClick={() => setArchiveTarget(item)}>
                          <Archive aria-hidden="true" className="size-4" />
                          {findingsMessages.panel.archiveAction}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {expandedActionsFindingIds.has(item.id) ? (
                    <div id={`finding-corrective-actions-${item.id}`}>
                      <FindingCorrectiveActions
                        findingId={item.id}
                        regionLabel={auditEngagements.aria.findingCorrectiveActionsRegionLabel}
                        onActionsChanged={() => refreshFindingCounts(item.id)}
                      />
                    </div>
                  ) : null}

                  <FindingLinksSection
                    findingId={item.id}
                    findingStatus={item.status}
                    canLinkPermission={canLinkFindings}
                  />
                </DisclosureGroup>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {canCreate ? (
        <FindingCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          orgUnitId={orgUnitId}
          defaultOwnerUserId={defaultOwnerUserId}
          onCreated={addItem}
        />
      ) : null}

      {canEdit ? (
        <FindingEditDialog
          finding={editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          onSaved={replaceItem}
        />
      ) : null}

      {canClose ? (
        <FindingCloseDialog
          finding={closeTarget}
          onOpenChange={(open) => {
            if (!open) setCloseTarget(null);
          }}
          onClosed={replaceItem}
        />
      ) : null}

      {canClose ? (
        <FindingReopenDialog
          finding={reopenTarget}
          onOpenChange={(open) => {
            if (!open) setReopenTarget(null);
          }}
          onReopened={replaceItem}
        />
      ) : null}

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title={findingsMessages.panel.archiveConfirm.title}
        description={
          archiveTarget
            ? findingsMessages.panel.archiveConfirm.description(archiveTarget.title)
            : ''
        }
        labels={{
          confirm: findingsMessages.panel.archiveAction,
          cancel: findingsMessages.form.cancel,
          close: findingsMessages.form.cancel,
        }}
        variant="destructive"
        isConfirming={archiving}
        onConfirm={() => void confirmArchive()}
      />
    </Card>
  );
}
