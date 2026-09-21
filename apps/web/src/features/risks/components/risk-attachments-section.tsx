'use client';

/**
 * PharosGRC — risk detail, Attachments section (T195, US9, FR-096 to
 * FR-100, FR-102).
 *
 * Consumes `GET/POST /attachments` and `DELETE /attachments/{attachmentId}`,
 * scoped to this risk via `entityType=RISK&entityId={riskId}`
 * (`risksApi.listAttachments`/`uploadAttachment`/`withdrawAttachment`,
 * ADR-008's entity-type registry). Renders through `AttachmentList`
 * (`@pharos/design-system`, T194) — a generic, domain-agnostic component;
 * this file supplies every word (D-10) and owns the fetch/pagination/
 * mutation lifecycle, mirroring `RiskCommentsSection`'s own pattern.
 *
 * ## The allow-list is communicated BEFORE an upload, not only after a refusal
 *
 * The server sniffs the uploaded bytes' actual magic number and requires
 * them to agree with the declared content type — PDF, PNG, JPEG or plain
 * text only, 25 MB maximum by default (`magic-bytes.ts`,
 * `.env.example`'s `ATTACHMENT_ALLOWED_MIME_TYPES`/`ATTACHMENT_MAX_SIZE_BYTES`).
 * `risks.attachments.allowedTypesHint` states this in the UI itself, always
 * visible next to the upload control (US9 AS3) — a user learns the
 * constraint before attempting an upload, not only from a `422`/`413`
 * refusal. `ACCEPTED_CONTENT_TYPES` below is the native file input's
 * `accept` hint only (a browser courtesy, easily bypassed) — the server
 * remains the sole authority, and its own refusal `detail` (already pt-BR)
 * is surfaced verbatim through `uploadErrorDetail`, never replaced with a
 * generic message.
 *
 * ## Withdrawing is audited, not erased (FR-102) — confirmed before it happens
 *
 * Same `ConfirmDialog`-gated pattern as `RiskCommentsSection`/
 * `RiskControlsSection`. `attachment:delete` carries no author restriction
 * server-side (`WithdrawAttachmentUseCase`), so `canWithdraw` applies
 * uniformly to every attachment for a caller holding it.
 *
 * ## Download never routes through this component's own fetch
 *
 * `AttachmentList` renders `Attachment.contentUrl` as a plain `<a href>` —
 * this section only ever passes that server-supplied path through
 * unchanged (ADR-010).
 */
import { AttachmentList, ConfirmDialog } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { formatBytes } from '@/lib/format';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';

import { risksApi } from '../api';

import type { Attachment } from '../types';

export interface RiskAttachmentsSectionProps {
  riskId: string;
  canUpload: boolean;
  canWithdraw: boolean;
}

const PAGE_SIZE = 20;

/** Native file input `accept` hint only — a courtesy, not the actual allow-list authority. Kept in sync with `magic-bytes.ts`'s `SNIFFABLE_CONTENT_TYPES` / `.env.example`'s `ATTACHMENT_ALLOWED_MIME_TYPES` default. */
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

export function RiskAttachmentsSection({
  riskId,
  canUpload,
  canWithdraw,
}: RiskAttachmentsSectionProps): React.JSX.Element {
  const [items, setItems] = useState<readonly Attachment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadErrorDetail, setUploadErrorDetail] = useState<string | null>(null);

  const [pendingWithdraw, setPendingWithdraw] = useState<Attachment | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // Mirrors `RiskCommentsSection`'s own refresh-token convention.
  const [refreshToken, setRefreshToken] = useState(0);
  const requestKey = `${riskId}|${refreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    risksApi
      .listAttachments(riskId, 1, PAGE_SIZE)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from `riskId`/`refreshToken`, both already listed.
  }, [riskId, refreshToken]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await risksApi.listAttachments(riskId, nextPage, PAGE_SIZE);
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
      await risksApi.uploadAttachment(riskId, file);
      feedback.success(risks.attachments.uploadSuccess);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      // The server's own refusal reason — magic-byte mismatch (422),
      // disallowed type (422) or excessive size (413) — is already pt-BR
      // and specific (FR-097); surfaced verbatim rather than replaced by a
      // generic failure message (US9 AS3).
      const detail = err instanceof ApiError ? err.problem.detail : undefined;
      setUploadErrorDetail(detail ?? risks.attachments.uploadGenericError);
      feedback.error(detail ?? risks.attachments.uploadGenericError);
    } finally {
      setUploading(false);
    }
  }

  async function confirmWithdraw(): Promise<void> {
    if (!pendingWithdraw) return;
    setWithdrawing(true);
    try {
      await risksApi.withdrawAttachment(pendingWithdraw.id);
      feedback.success(risks.attachments.withdrawSuccess);
      setPendingWithdraw(null);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      const detail = err instanceof ApiError ? err.problem.detail : undefined;
      feedback.error(detail ?? risks.attachments.withdrawError);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{risks.attachments.cardTitle}</CardTitle>
        <CardDescription>{risks.attachments.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <AttachmentList
          items={items.map((attachment) => toListItem(attachment, canWithdraw))}
          labels={{ ...risks.attachments, uploadError: uploadErrorDetail }}
          isLoading={loading}
          error={error && items.length === 0 ? { detail: risks.attachments.loadError } : undefined}
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
      </CardContent>

      <ConfirmDialog
        open={pendingWithdraw !== null}
        onOpenChange={(open) => {
          if (!open) setPendingWithdraw(null);
        }}
        title={risks.attachments.withdrawConfirm.title}
        description={
          pendingWithdraw
            ? risks.attachments.withdrawConfirm.description(pendingWithdraw.fileName)
            : ''
        }
        labels={{
          confirm: risks.attachments.withdrawLabel,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        variant="destructive"
        isConfirming={withdrawing}
        onConfirm={() => void confirmWithdraw()}
      />
    </Card>
  );
}
