'use client';

/**
 * PharosGRC — incident detail, Attachments section (CLAUDE.md §19.10
 * remediation). Mirrors `RiskAttachmentsSection` exactly — see that
 * file's own header for the full reasoning this one deliberately does
 * not repeat: `AttachableEntityType.INCIDENT` was registered on the
 * backend (`IncidentParentRecordAccessor`) with no reachable interface
 * until this file. Consumes `GET/POST /attachments` and
 * `DELETE /attachments/{attachmentId}`, scoped to this incident via
 * `entityType=INCIDENT&entityId={incidentId}`
 * (`incidentsApi.listAttachments`/`uploadAttachment`/`withdrawAttachment`,
 * ADR-008's entity-type registry). Renders through `AttachmentList`
 * (`@pharos/design-system`) — a generic, domain-agnostic component; this
 * file supplies every word (D-10).
 */
import { AttachmentList, ConfirmDialog } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { incidentsApi } from '@/features/incidents/api';
import { ApiError } from '@/lib/api-client';
import { formatBytes } from '@/lib/format';
import { common } from '@/lib/messages/common';
import { incidents } from '@/lib/messages/incidents';

import type { Attachment } from '@/features/risks/types';

export interface IncidentAttachmentsSectionProps {
  incidentId: string;
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

export function IncidentAttachmentsSection({
  incidentId,
  canUpload,
  canWithdraw,
}: IncidentAttachmentsSectionProps): React.JSX.Element {
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
  const requestKey = `${incidentId}|${refreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    incidentsApi
      .listAttachments(incidentId, 1, PAGE_SIZE)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from `incidentId`/`refreshToken`, both already listed.
  }, [incidentId, refreshToken]);

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await incidentsApi.listAttachments(incidentId, nextPage, PAGE_SIZE);
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
      await incidentsApi.uploadAttachment(incidentId, file);
      feedback.success(incidents.attachments.uploadSuccess);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      const detail = err instanceof ApiError ? err.problem.detail : undefined;
      setUploadErrorDetail(detail ?? incidents.attachments.uploadGenericError);
      feedback.error(detail ?? incidents.attachments.uploadGenericError);
    } finally {
      setUploading(false);
    }
  }

  async function confirmWithdraw(): Promise<void> {
    if (!pendingWithdraw) return;
    setWithdrawing(true);
    try {
      await incidentsApi.withdrawAttachment(pendingWithdraw.id);
      feedback.success(incidents.attachments.withdrawSuccess);
      setPendingWithdraw(null);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      const detail = err instanceof ApiError ? err.problem.detail : undefined;
      feedback.error(detail ?? incidents.attachments.withdrawError);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{incidents.attachments.cardTitle}</CardTitle>
        <CardDescription>{incidents.attachments.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <AttachmentList
          items={items.map((attachment) => toListItem(attachment, canWithdraw))}
          labels={{ ...incidents.attachments, uploadError: uploadErrorDetail }}
          isLoading={loading}
          error={
            error && items.length === 0 ? { detail: incidents.attachments.loadError } : undefined
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
        title={incidents.attachments.withdrawConfirm.title}
        description={
          pendingWithdraw
            ? incidents.attachments.withdrawConfirm.description(pendingWithdraw.fileName)
            : ''
        }
        labels={{
          confirm: incidents.attachments.withdrawLabel,
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
