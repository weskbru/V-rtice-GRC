'use client';

import { AttachmentList, ConfirmDialog } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { problemsApi } from '@/features/problems/api';
import { ApiError } from '@/lib/api-client';
import { formatBytes } from '@/lib/format';
import { common } from '@/lib/messages/common';
import { problems } from '@/lib/messages/problems';

import type { Attachment } from '@/features/risks/types';

export interface ProblemAttachmentsSectionProps {
  problemId: string;
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

export function ProblemAttachmentsSection({
  problemId,
  canUpload,
  canWithdraw,
}: ProblemAttachmentsSectionProps): React.JSX.Element {
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
  const requestKey = `${problemId}|${refreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    problemsApi
      .listAttachments(problemId, 1, PAGE_SIZE)
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
  }, [problemId, refreshToken]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await problemsApi.listAttachments(problemId, nextPage, PAGE_SIZE);
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
      await problemsApi.uploadAttachment(problemId, file);
      feedback.success(problems.attachments.uploadSuccess);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      const detail = err instanceof ApiError ? err.problem.detail : undefined;
      setUploadErrorDetail(detail ?? problems.attachments.uploadGenericError);
      feedback.error(detail ?? problems.attachments.uploadGenericError);
    } finally {
      setUploading(false);
    }
  }

  async function confirmWithdraw(): Promise<void> {
    if (!pendingWithdraw) return;
    setWithdrawing(true);
    try {
      await problemsApi.withdrawAttachment(pendingWithdraw.id);
      feedback.success(problems.attachments.withdrawSuccess);
      setPendingWithdraw(null);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      const detail = err instanceof ApiError ? err.problem.detail : undefined;
      feedback.error(detail ?? problems.attachments.withdrawError);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{problems.attachments.cardTitle}</CardTitle>
        <CardDescription>{problems.attachments.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <AttachmentList
          items={items.map((attachment) => toListItem(attachment, canWithdraw))}
          labels={{ ...problems.attachments, uploadError: uploadErrorDetail }}
          isLoading={loading}
          error={
            error && items.length === 0 ? { detail: problems.attachments.loadError } : undefined
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
      </CardContent>

      <ConfirmDialog
        open={pendingWithdraw !== null}
        onOpenChange={(open) => {
          if (!open) setPendingWithdraw(null);
        }}
        title={problems.attachments.withdrawConfirm.title}
        description={
          pendingWithdraw
            ? problems.attachments.withdrawConfirm.description(pendingWithdraw.fileName)
            : ''
        }
        labels={{
          confirm: problems.attachments.withdrawLabel,
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
