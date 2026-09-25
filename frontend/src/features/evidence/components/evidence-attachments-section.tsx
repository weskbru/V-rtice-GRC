'use client';

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
  evidenceLabel: string;
  canUpload: boolean;
  canWithdraw: boolean;
}

const PAGE_SIZE = 20;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva das dependências listadas.
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
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <>
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
