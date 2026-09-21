'use client';

/**
 * PharosGRC — Evidence attachments, per evidence card (assurance-audit
 * Fix 1, HIGH).
 *
 * Before this file, a file attached at evidence-creation time
 * (`EvidenceCreateDialog`'s optional file field) was never visible again
 * anywhere in the product: no filename, no download link, no icon, no
 * count on `EvidencePanel`'s cards, and no way to attach a file to
 * evidence that already existed. `evidenceApi.listAttachments` existed but
 * had zero callers.
 *
 * ## Reused vs. not — stated explicitly, per the audit's own instruction
 *
 * `@pharos/design-system`'s `AttachmentList` — the actual list/upload/
 * download/withdraw UI — is reused UNCHANGED; it was already a fully
 * generic, entity-agnostic component (`RiskAttachmentsSection` is its only
 * other current consumer) and needed no modification. `formatBytes` moved
 * out of `risk-attachments-section.tsx` into `@/lib/format` once evidence
 * became a genuine second caller (see that file's own comment).
 *
 * What is NOT reused is `RiskAttachmentsSection` itself: that component
 * owns exactly ONE risk's attachment list for a whole page. Evidence has
 * MANY records per panel, each needing its OWN attachment list, upload
 * control and pagination state — a fundamentally different shape (N
 * independent instances vs. one), not a cosmetic difference. Forcing them
 * to share a component would mean threading an evidence-id/risk-id union
 * through it for no real reduction in code. This file instead mirrors
 * `RiskAttachmentsSection`'s data-fetching WIRING (fetch-on-mount with a
 * refresh token, page/hasMore, upload/withdraw handlers) — the same
 * small-per-section-duplication convention every collaboration section in
 * this codebase already follows (`RiskCommentsSection`, `EvidencePanel`
 * itself, `FindingsPanel`), rather than introducing this codebase's first
 * generic data-fetching hook.
 */
import { AttachmentList, ConfirmDialog } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { ApiError } from '@/lib/api-client';
import { formatBytes } from '@/lib/format';
import { common } from '@/lib/messages/common';
import { evidence as evidenceMessages } from '@/lib/messages/evidence';

import { evidenceApi } from '../api';

import type { Attachment } from '@/features/risks/types';

export interface EvidenceAttachmentsSectionProps {
  evidenceId: string;
  /** Shown in the section title and the list's accessible caption, e.g. "EVD-2026-0001 — Relatório de teste de intrusão". */
  evidenceLabel: string;
  canUpload: boolean;
  canWithdraw: boolean;
}

const PAGE_SIZE = 20;

/** Native file input `accept` hint only — mirrors `RiskAttachmentsSection`'s own, kept in sync with the SAME server-side allow-list (`magic-bytes.ts`), which is not entity-type-specific. */
const ACCEPTED_CONTENT_TYPES = 'application/pdf,image/png,image/jpeg,text/plain';

function toListItem(attachment: Attachment, canWithdraw: boolean) {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    sizeLabel: formatBytes(attachment.sizeBytes),
    uploadedByName: attachment.uploadedBy.fullName,
    uploadedAtLabel: new Date(attachment.createdAt).toLocaleString('pt-BR'),
    contentUrl: attachment.contentUrl,
    canWithdraw,
  };
}

export function EvidenceAttachmentsSection({
  evidenceId,
  evidenceLabel,
  canUpload,
  canWithdraw,
}: EvidenceAttachmentsSectionProps): React.JSX.Element {
  const [items, setItems] = useState<readonly Attachment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadErrorDetail, setUploadErrorDetail] = useState<string | null>(null);

  const [pendingWithdraw, setPendingWithdraw] = useState<Attachment | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // Mirrors `RiskAttachmentsSection`'s own refresh-token convention.
  const [refreshToken, setRefreshToken] = useState(0);
  const requestKey = `${evidenceId}|${refreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    evidenceApi
      .listAttachments(evidenceId, 1, PAGE_SIZE)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from `evidenceId`/`refreshToken`, both already listed.
  }, [evidenceId, refreshToken]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await evidenceApi.listAttachments(evidenceId, nextPage, PAGE_SIZE);
      setItems((current) => [...current, ...result.data]);
      setPage(nextPage);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleUpload(file: File): Promise<void> {
    setUploading(true);
    setUploadErrorDetail(null);
    try {
      await evidenceApi.uploadAttachment(evidenceId, file);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      // The server's own refusal reason — never a generic failure message,
      // matching `RiskAttachmentsSection`'s own handling (US9 AS3).
      const detail = err instanceof ApiError ? err.problem.detail : undefined;
      setUploadErrorDetail(detail ?? evidenceMessages.attachments.uploadGenericError);
    } finally {
      setUploading(false);
    }
  }

  async function confirmWithdraw(): Promise<void> {
    if (!pendingWithdraw) return;
    setWithdrawing(true);
    try {
      await evidenceApi.withdrawAttachment(pendingWithdraw.id);
      setPendingWithdraw(null);
      setRefreshToken((token) => token + 1);
    } catch {
      // The dialog stays open with its own destructive action still
      // available to retry — same reasoning `EvidencePanel`'s own
      // archive/unlink handlers give for not surfacing a separate toast.
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <>
      {/*
       * A plain, borderless block rather than a nested `Card` — this
       * section already lives inside one `<li>` of `EvidencePanel`'s own
       * bordered list; a card within that border would be exactly the
       * "cartão dentro de cartão" CLAUDE.md §18.5 rules out. A top divider
       * plus a small label is enough to separate it from the evidence
       * metadata above.
       */}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {evidenceMessages.attachments.sectionTitle}
        </span>
        <AttachmentList
          items={items.map((attachment) => toListItem(attachment, canWithdraw))}
          labels={{
            caption: evidenceMessages.attachments.caption(evidenceLabel),
            loading: evidenceMessages.attachments.loading,
            loadError: evidenceMessages.attachments.loadError,
            empty: evidenceMessages.attachments.empty,
            chooseFileLabel: evidenceMessages.attachments.chooseFileLabel,
            uploadLabel: evidenceMessages.attachments.uploadLabel,
            uploadingLabel: evidenceMessages.attachments.uploadingLabel,
            allowedTypesHint: evidenceMessages.attachments.allowedTypesHint,
            uploadError: uploadErrorDetail,
            downloadLabel: evidenceMessages.attachments.downloadLabel,
            withdrawLabel: evidenceMessages.attachments.withdrawLabel,
            loadMoreLabel: evidenceMessages.attachments.loadMoreLabel,
            loadingMoreLabel: evidenceMessages.attachments.loadingMoreLabel,
          }}
          isLoading={loading}
          error={
            error && items.length === 0
              ? { detail: evidenceMessages.attachments.loadError }
              : undefined
          }
          hasMore={page < totalPages}
          isLoadingMore={loadingMore}
          onLoadMore={() => void loadMore()}
          canUpload={canUpload}
          onUpload={(file) => void handleUpload(file)}
          isUploading={uploading}
          acceptAttribute={ACCEPTED_CONTENT_TYPES}
          onWithdraw={(id) => {
            const attachment = items.find((item) => item.id === id) ?? null;
            setPendingWithdraw(attachment);
          }}
        />
      </div>

      <ConfirmDialog
        open={pendingWithdraw !== null}
        onOpenChange={(open) => {
          if (!open) setPendingWithdraw(null);
        }}
        title={evidenceMessages.attachments.withdrawConfirm.title}
        description={
          pendingWithdraw
            ? evidenceMessages.attachments.withdrawConfirm.description(pendingWithdraw.fileName)
            : ''
        }
        labels={{
          confirm: evidenceMessages.attachments.withdrawLabel,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        variant="destructive"
        isConfirming={withdrawing}
        onConfirm={() => void confirmWithdraw()}
      />
    </>
  );
}
