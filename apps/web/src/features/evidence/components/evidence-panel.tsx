'use client';

/**
 * PharosGRC — Evidence panel (T036/T037, 002-shared-grc-foundation, US1).
 *
 * Consumed by any domain screen's detail view — currently the risk detail
 * screen's own "Evidência" tab (`risk-detail-view.tsx`). No new sidebar
 * entry (R-009): this is a tab within an existing screen, the same pattern
 * `RiskAttachmentsSection`/`RiskCommentsSection` already establish.
 *
 * Lists the evidence currently linked to `subjectId` (`GET /evidence
 * ?subjectType=&subjectId=`, R-010: subjects/evidence the caller cannot
 * see are simply absent from the response, never surfaced as a
 * placeholder). Creating a new evidence links it to this subject in the
 * same flow (`EvidenceCreateDialog`) — SC-001's own target.
 */
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  StatusBadge,
} from '@pharos/design-system/components';
import { Archive, Link2Off, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { evidence as evidenceMessages } from '@/lib/messages/evidence';

import { evidenceApi } from '../api';

import { EvidenceAttachmentsSection } from './evidence-attachments-section';
import { EvidenceCreateDialog } from './evidence-create-dialog';

import type { Evidence, EvidenceSubjectType } from '../types';

export interface EvidencePanelProps {
  subjectType: EvidenceSubjectType;
  subjectId: string;
  orgUnitId: string;
  defaultOwnerUserId: string;
  canCreate: boolean;
  canLink: boolean;
  canAdminister: boolean;
  /** `attachment:create` — the SAME entity-type-independent permission `RiskAttachmentsSection` gates on (assurance-audit Fix 1). */
  canUploadAttachment: boolean;
  /** `attachment:delete`. */
  canWithdrawAttachment: boolean;
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function evidenceCardLabel(item: Evidence): string {
  return `${item.code} — ${item.title}`;
}

export function EvidencePanel({
  subjectType,
  subjectId,
  orgUnitId,
  defaultOwnerUserId,
  canCreate,
  canLink,
  canAdminister,
  canUploadAttachment,
  canWithdrawAttachment,
}: EvidencePanelProps): React.JSX.Element {
  const [items, setItems] = useState<readonly Evidence[]>([]);
  const [error, setError] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<Evidence | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [pendingUnlink, setPendingUnlink] = useState<Evidence | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [linkIdByEvidenceId, setLinkIdByEvidenceId] = useState<Record<string, string>>({});

  // Mirrors `RiskAttachmentsSection`'s own refresh-token convention:
  // `loading` is DERIVED from comparing the current request's key against
  // the last one that finished, rather than a `setLoading(true)` call at
  // the top of the effect body — that would be a synchronous `setState`
  // inside an effect, which can cascade an extra render.
  const requestKey = `${subjectType}|${subjectId}|${refreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    evidenceApi
      .listBySubject(subjectType, subjectId)
      .then(async (page) => {
        if (cancelled) return;
        setItems(page.items);
        setError(false);
        // Each evidence card's "unlink" action needs the LINK id, not the
        // evidence id — `listBySubject` (the evidence-centric endpoint)
        // does not carry it, so the active link per evidence is resolved
        // once here rather than the card re-deriving it on click.
        const entries = await Promise.all(
          page.items.map(async (item) => {
            try {
              const links = await evidenceApi.listLinks(item.id);
              const active = links.find(
                (link) => link.subjectType === subjectType && link.subjectId === subjectId,
              );
              return [item.id, active?.id] as const;
            } catch {
              return [item.id, undefined] as const;
            }
          }),
        );
        if (cancelled) return;
        setLinkIdByEvidenceId(
          Object.fromEntries(entries.filter((entry): entry is [string, string] => !!entry[1])),
        );
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setResolvedRequestKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from `subjectType`/`subjectId`/`refreshToken`, all already listed.
  }, [subjectType, subjectId, refreshToken]);

  async function confirmArchive(): Promise<void> {
    if (!pendingArchive) return;
    setArchiving(true);
    try {
      await evidenceApi.archiveEvidence(pendingArchive.id);
      setPendingArchive(null);
      setRefreshToken((token) => token + 1);
    } catch {
      // The dialog stays open with its own destructive action still
      // available to retry; no separate toast is needed for a dialog the
      // user can see failed to close.
    } finally {
      setArchiving(false);
    }
  }

  async function confirmUnlink(): Promise<void> {
    if (!pendingUnlink) return;
    const linkId = linkIdByEvidenceId[pendingUnlink.id];
    if (!linkId) {
      setPendingUnlink(null);
      return;
    }
    setUnlinking(true);
    try {
      await evidenceApi.unlinkEvidence(pendingUnlink.id, linkId);
      setPendingUnlink(null);
      setRefreshToken((token) => token + 1);
    } catch {
      // See `confirmArchive`'s own comment.
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{evidenceMessages.panel.cardTitle}</CardTitle>
          <CardDescription>{evidenceMessages.panel.cardDescription}</CardDescription>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {evidenceMessages.panel.newAction}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{evidenceMessages.panel.loading}</p>
        ) : error ? (
          <ErrorState problem={{ title: evidenceMessages.panel.loadError }} />
        ) : items.length === 0 ? (
          <EmptyState variant="empty" title={evidenceMessages.panel.empty} />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 rounded-md border border-border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{evidenceCardLabel(item)}</span>
                      <StatusBadge
                        variant={item.status === 'ARCHIVED' ? 'neutral' : 'success'}
                        label={evidenceMessages.statusLabels[item.status]}
                      />
                      {item.expired ? (
                        <StatusBadge
                          variant="warning"
                          label={evidenceMessages.panel.expiredBadge}
                        />
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {evidenceMessages.typeLabels[item.type]} ·{' '}
                      {evidenceMessages.sourceLabels[item.source]}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {evidenceMessages.panel.ownerLabel(item.owner.fullName)} ·{' '}
                      {evidenceMessages.panel.collectedOnLabel(formatDateOnly(item.collectedOn))}
                      {item.validUntil
                        ? ` · ${evidenceMessages.panel.validUntilLabel(formatDateOnly(item.validUntil))}`
                        : ''}
                    </p>
                    {item.observation ? <p className="text-sm">{item.observation}</p> : null}
                    {item.externalUrl ? (
                      <a
                        href={item.externalUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-sm text-primary underline underline-offset-2"
                      >
                        {item.externalUrl}
                      </a>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {canLink && item.status === 'ACTIVE' && linkIdByEvidenceId[item.id] ? (
                      <Button size="sm" variant="outline" onClick={() => setPendingUnlink(item)}>
                        <Link2Off aria-hidden="true" className="size-4" />
                        {evidenceMessages.panel.unlinkAction}
                      </Button>
                    ) : null}
                    {canAdminister && item.status === 'ACTIVE' ? (
                      <Button size="sm" variant="outline" onClick={() => setPendingArchive(item)}>
                        <Archive aria-hidden="true" className="size-4" />
                        {evidenceMessages.panel.archiveAction}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/*
                 * Assurance-audit Fix 1: a file attached at creation time
                 * (`EvidenceCreateDialog`'s optional file field) previously
                 * had no other surface in the product — not here, not
                 * anywhere. Upload-to-existing-evidence is only offered for
                 * ACTIVE evidence (an archived record "não pode mais ser
                 * editada", per `archiveConfirm.description` above) — a UI
                 * courtesy mirroring the link/archive actions' own
                 * `item.status === 'ACTIVE'` gate; the server remains the
                 * actual authority (ADR-003).
                 */}
                <EvidenceAttachmentsSection
                  evidenceId={item.id}
                  evidenceLabel={evidenceCardLabel(item)}
                  canUpload={canUploadAttachment && item.status === 'ACTIVE'}
                  canWithdraw={canWithdrawAttachment}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {canCreate ? (
        <EvidenceCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          orgUnitId={orgUnitId}
          subjectType={subjectType}
          subjectId={subjectId}
          defaultOwnerUserId={defaultOwnerUserId}
          onCreated={() => setRefreshToken((token) => token + 1)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingArchive !== null}
        onOpenChange={(open) => {
          if (!open) setPendingArchive(null);
        }}
        title={evidenceMessages.panel.archiveConfirm.title}
        description={
          pendingArchive
            ? evidenceMessages.panel.archiveConfirm.description(pendingArchive.title)
            : ''
        }
        labels={{
          confirm: evidenceMessages.panel.archiveAction,
          cancel: evidenceMessages.form.cancel,
          close: evidenceMessages.form.cancel,
        }}
        variant="destructive"
        isConfirming={archiving}
        onConfirm={() => void confirmArchive()}
      />

      <ConfirmDialog
        open={pendingUnlink !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUnlink(null);
        }}
        title={evidenceMessages.panel.unlinkConfirm.title}
        description={
          pendingUnlink ? evidenceMessages.panel.unlinkConfirm.description(pendingUnlink.title) : ''
        }
        labels={{
          confirm: evidenceMessages.panel.unlinkAction,
          cancel: evidenceMessages.form.cancel,
          close: evidenceMessages.form.cancel,
        }}
        variant="destructive"
        isConfirming={unlinking}
        onConfirm={() => void confirmUnlink()}
      />
    </Card>
  );
}
