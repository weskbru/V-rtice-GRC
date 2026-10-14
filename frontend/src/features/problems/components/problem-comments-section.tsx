'use client';

import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { problemsApi } from '@/features/problems/api';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { problems } from '@/lib/messages/problems';
import { CommentThread, ConfirmDialog } from '@vertice/design-system/components';

import type { Comment } from '@/features/risks/types';

export interface ProblemCommentsSectionProps {
  problemId: string;
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

export function ProblemCommentsSection({
  problemId,
  canComment,
  canWithdraw,
}: ProblemCommentsSectionProps): React.JSX.Element {
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
  const requestKey = `${problemId}|${refreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    problemsApi
      .listComments(problemId, 1, PAGE_SIZE)
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
      const result = await problemsApi.listComments(problemId, nextPage, PAGE_SIZE);
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
      await problemsApi.createComment(problemId, body);
      feedback.success(problems.comments.submitSuccess);
      setCommentValue('');
      setRefreshToken((token) => token + 1);
    } catch {
      feedback.error(problems.comments.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmWithdraw(): Promise<void> {
    if (!pendingWithdrawId) return;
    setWithdrawing(true);
    try {
      await problemsApi.withdrawComment(pendingWithdrawId);
      feedback.success(problems.comments.withdrawSuccess);
      setPendingWithdrawId(null);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      const detail = err instanceof ApiError ? err.problem.detail : undefined;
      feedback.error(detail ?? problems.comments.withdrawError);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{problems.comments.cardTitle}</CardTitle>
        <CardDescription>{problems.comments.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <CommentThread
          items={items.map((comment) => toThreadItem(comment, canWithdraw))}
          labels={problems.comments}
          isLoading={loading}
          error={error && items.length === 0 ? { detail: problems.comments.loadError } : undefined}
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
        title={problems.comments.withdrawConfirm.title}
        description={problems.comments.withdrawConfirm.description}
        labels={{
          confirm: problems.comments.withdrawLabel,
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
