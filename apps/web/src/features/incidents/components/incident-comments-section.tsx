'use client';

import { CommentThread, ConfirmDialog } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { incidentsApi } from '@/features/incidents/api';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { incidents } from '@/lib/messages/incidents';

import type { Comment } from '@/features/risks/types';

export interface IncidentCommentsSectionProps {
  incidentId: string;
  canComment: boolean;
  canWithdraw: boolean;
}

const PAGE_SIZE = 20;

function toThreadItem(comment: Comment, canWithdraw: boolean) {
  return {
    id: comment.id,
    authorName: comment.author.fullName,
    body: comment.body,
    createdAtLabel: new Date(comment.createdAt).toLocaleString('pt-BR'),
    canWithdraw,
  };
}

export function IncidentCommentsSection({
  incidentId,
  canComment,
  canWithdraw,
}: IncidentCommentsSectionProps): React.JSX.Element {
  const [items, setItems] = useState<readonly Comment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const [commentValue, setCommentValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [pendingWithdrawId, setPendingWithdrawId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const [refreshToken, setRefreshToken] = useState(0);
  const requestKey = `${incidentId}|${refreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    incidentsApi
      .listComments(incidentId, 1, PAGE_SIZE)
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
      const result = await incidentsApi.listComments(incidentId, nextPage, PAGE_SIZE);
      setItems((current) => [...current, ...result.data]);
      setPage(nextPage);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    const body = commentValue.trim();
    if (!body) return;
    setSubmitting(true);
    try {
      await incidentsApi.createComment(incidentId, body);
      feedback.success(incidents.comments.submitSuccess);
      setCommentValue('');
      setRefreshToken((token) => token + 1);
    } catch {
      feedback.error(incidents.comments.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmWithdraw(): Promise<void> {
    if (!pendingWithdrawId) return;
    setWithdrawing(true);
    try {
      await incidentsApi.withdrawComment(pendingWithdrawId);
      feedback.success(incidents.comments.withdrawSuccess);
      setPendingWithdrawId(null);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      const detail = err instanceof ApiError ? err.problem.detail : undefined;
      feedback.error(detail ?? incidents.comments.withdrawError);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{incidents.comments.cardTitle}</CardTitle>
        <CardDescription>{incidents.comments.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <CommentThread
          items={items.map((comment) => toThreadItem(comment, canWithdraw))}
          labels={incidents.comments}
          isLoading={loading}
          error={error && items.length === 0 ? { detail: incidents.comments.loadError } : undefined}
          hasMore={page < totalPages}
          isLoadingMore={loadingMore}
          onLoadMore={() => void loadMore()}
          commentValue={commentValue}
          onCommentValueChange={setCommentValue}
          onSubmit={() => void handleSubmit()}
          isSubmitting={submitting}
          canComment={canComment}
          onWithdraw={(id) => setPendingWithdrawId(id)}
        />
      </CardContent>

      <ConfirmDialog
        open={pendingWithdrawId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingWithdrawId(null);
        }}
        title={incidents.comments.withdrawConfirm.title}
        description={incidents.comments.withdrawConfirm.description}
        labels={{
          confirm: incidents.comments.withdrawLabel,
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
