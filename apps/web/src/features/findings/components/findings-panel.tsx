'use client';

/**
 * PharosGRC — Findings panel (T075/T077/T078, 002-shared-grc-foundation +
 * 005-audit-findings, US3).
 *
 * Consumed by the risk detail screen's own "Achados" tab — the ONE
 * frontend surface Phase 1 gave Finding (spec.md's own Assumptions:
 * "Evidência, Ação e Achado não recebem entrada própria na navegação
 * principal nesta fase"). Mirrors `EvidencePanel`'s established shape for
 * a collaboration-style panel embedded in another entity's detail screen.
 *
 * ## Scoped by organizational unit, not a persisted Finding-to-Risk link
 *
 * `data-model.md`'s own overview diagram gave `Finding` exactly two
 * relationships in Phase 1: `Finding --1:N--> Action` and
 * `Finding --N:M--> Evidence` (via `EvidenceLink`). This panel still lists
 * its findings by the risk's OWN organizational unit (`GET
 * /findings?orgUnitId=`) rather than by a Finding-to-Risk link — that
 * read path is unchanged. What 005-audit-findings adds is the link ITSELF
 * (`FindingRiskLink`, US3, FR-015): each finding row below now also
 * renders `FindingLinksSection`, which lists/links/withdraws that new N:M
 * relationship explicitly, alongside the equally new Finding↔Control one.
 *
 * ## Origin (005-audit-findings, SC-001)
 *
 * `Finding.auditEngagementId` is non-null for a finding produced by
 * `POST /audits/{auditId}/findings` and null for one recorded manually via
 * this panel's own "Novo achado" (`POST /findings`, unchanged). Both cases
 * are surfaced explicitly per row — never left to silent inference — using
 * `findingsFromEngagement.originNotice`/`.manualOriginNotice`. The
 * engagement's own `code` is resolved lazily and cached by id (a small,
 * best-effort lookup — `findingsFromEngagement.originNoticeUnknown` covers
 * the case where the viewer cannot read `audit-engagement:view` and the
 * lookup itself is refused).
 *
 * ## Collapsed/expanded rows (016-risk-detail-experience, Área 5, 2026-09-17)
 *
 * With ten or twenty findings this panel used to render every field,
 * select, checkbox and action button for every row at once — a wall of
 * open forms rather than a list. Each row is now a `DisclosureGroup`
 * (`@pharos/design-system`, already used by this same screen's contextual
 * aside): collapsed shows only what identifies and prioritizes a finding —
 * code, title, status, severity — using fields `GET /findings?orgUnitId=`
 * already returned, no additional request. Expanded shows EVERYTHING that
 * rendered unconditionally before this change — category/origin/priority,
 * owner/identified-on, open-action/evidence counts, description,
 * recommendation, closure justification, the origin notice, the corrective-
 * actions toggle, every edit/remediate/close/reopen/archive action, and
 * `FindingLinksSection`'s link/unlink affordances — byte-for-byte the same
 * markup, moved rather than rewritten. No capability is removed.
 *
 * `DisclosureGroup` UNMOUNTS its content while collapsed (that component's
 * own doc comment explains why — `docs/STATE.md` §8 registers this as a
 * known, deliberate trade-off, not something to fix here). A side effect
 * worth stating plainly, not leaving implicit: `FindingLinksSection`'s own
 * two per-row requests, and the corrective-actions fetch, now fire only for
 * a finding the reader actually expands, instead of for every row in the
 * list unconditionally — fewer incidental requests, not a behaviour change
 * to what either request does or returns.
 */
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
  /** `finding:remediate` (005-audit-findings, T077) — gates `FindingRemediationAction`, itself further gated by `item.status === 'OPEN'`. */
  canRemediate: boolean;
  /** `finding:link` (005-audit-findings, T078) — gates the link/unlink affordances of `FindingLinksSection`; the list itself is always shown to anyone who can already see this panel. */
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

/**
 * 005-audit-findings, SC-001 — one line, always present, distinguishing a
 * finding produced by an engagement from one recorded manually. `null`
 * return (only while the engagement's own `code` is still being resolved,
 * `undefined` in the map) renders nothing rather than a stale/incorrect
 * line.
 */
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

  // 005-audit-findings, SC-001 — the engagement `code` behind each
  // produced finding's `auditEngagementId`, resolved lazily and cached by
  // id so the same engagement is fetched at most once regardless of how
  // many of this panel's findings it produced. `null` means the lookup was
  // attempted and refused/failed (`originNoticeUnknown`'s own case), never
  // "not yet attempted" (absent from the map).
  const [engagementCodeById, setEngagementCodeById] = useState<Record<string, string | null>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Finding | null>(null);
  const [closeTarget, setCloseTarget] = useState<Finding | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Finding | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Finding | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Corrective actions (audit-findings follow-up, 2026-09-12) — collapsed
  // per finding by default, so mounting this panel never fires one
  // `GET /actions` request per finding the way `FindingLinksSection`'s own
  // two per-row requests already do unconditionally. Expanded on demand via
  // each row's own "N ações em aberto" toggle (`FindingCorrectiveActions`'s
  // own header comment has the full reasoning).
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

  /**
   * `Finding.openActionCount` is derived on the SERVER, on read, from the
   * `actions` table (`prisma-finding.repository.ts`) — never held here as an
   * editable field and never recomputed client-side (CLAUDE.md §19.7). So
   * when the expanded panel creates or transitions one of those actions, the
   * only correct way to refresh the count is to re-read the finding.
   *
   * Without this the header kept reporting the count it was loaded with —
   * the reader added a third remediation action and the row still said two.
   * Given that this whole surface exists because that number had nowhere to
   * lead, leaving it stale would have replaced a dead number with a wrong
   * one. A failed re-read is deliberately silent: the action itself already
   * succeeded and reported so, and the count self-corrects on the next load.
   */
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
      // The dialog stays open with its own destructive action still
      // available to retry — mirrors `EvidencePanel#confirmArchive`.
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
                      {/* 005-audit-findings, SC-001 — origin surfaced explicitly, both directions (never left to silent inference). */}
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
