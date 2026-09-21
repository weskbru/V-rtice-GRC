'use client';

/**
 * PharosGRC — risk detail, Comments section (T195, US9, FR-095, FR-098,
 * FR-100, FR-102).
 *
 * Consumes `GET/POST /comments` and `DELETE /comments/{commentId}`,
 * scoped to this risk via `entityType=RISK&entityId={riskId}`
 * (`risksApi.listComments`/`createComment`/`withdrawComment`,
 * ADR-008's entity-type registry). Renders through `CommentThread`
 * (`@pharos/design-system`, T194) — a generic, domain-agnostic component
 * that knows nothing about risks; this file supplies every word (D-10) and
 * owns the fetch/pagination/mutation lifecycle, mirroring
 * `RiskHistorySection`'s own pagination pattern exactly.
 *
 * ## A comment body is never rendered as markup
 *
 * `CommentThread` renders `item.body` as a plain JSX text child — see its
 * own doc comment for the full reasoning. This section passes the raw
 * server-returned `Comment.body` straight through, with no markdown/HTML
 * processing of its own, so the guarantee holds end to end.
 *
 * ## Withdrawing is audited, not erased (FR-102) — confirmed before it happens
 *
 * `ConfirmDialog` gates every withdrawal, exactly like
 * `RiskControlsSection`'s own unlink pattern, and its description states
 * plainly that the comment is not erased — it remains in the audited
 * history, only that it stops appearing in this list.
 *
 * `comment:delete` is a fixed, entity-type-independent permission
 * (`data-model.md` §3) with no author restriction server-side
 * (`WithdrawCommentUseCase` checks only the permission plus parent access,
 * never authorship) — so `canWithdraw` here applies uniformly to every
 * comment for a caller holding it, not only their own.
 */
import { CommentThread, ConfirmDialog } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';

import { risksApi } from '../api';

import type { Comment } from '../types';

export interface RiskCommentsSectionProps {
  riskId: string;
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

export function RiskCommentsSection({
  riskId,
  canComment,
  canWithdraw,
}: RiskCommentsSectionProps): React.JSX.Element {
  const [items, setItems] = useState<readonly Comment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const [commentValue, setCommentValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [pendingWithdrawId, setPendingWithdrawId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // Bumped after a successful create/withdraw so the effect below re-fetches
  // from page 1 — mirrors `RiskHistorySection`'s `resolvedRequestKey`
  // convention exactly.
  const [refreshToken, setRefreshToken] = useState(0);
  const requestKey = `${riskId}|${refreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    risksApi
      .listComments(riskId, 1, PAGE_SIZE)
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
      const result = await risksApi.listComments(riskId, nextPage, PAGE_SIZE);
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
      await risksApi.createComment(riskId, body);
      feedback.success(risks.comments.submitSuccess);
      setCommentValue('');
      setRefreshToken((token) => token + 1);
    } catch {
      feedback.error(risks.comments.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmWithdraw(): Promise<void> {
    if (!pendingWithdrawId) return;
    setWithdrawing(true);
    try {
      await risksApi.withdrawComment(pendingWithdrawId);
      feedback.success(risks.comments.withdrawSuccess);
      setPendingWithdrawId(null);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      const detail = err instanceof ApiError ? err.problem.detail : undefined;
      feedback.error(detail ?? risks.comments.withdrawError);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{risks.comments.cardTitle}</CardTitle>
        <CardDescription>{risks.comments.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <CommentThread
          items={items.map((comment) => toThreadItem(comment, canWithdraw))}
          labels={risks.comments}
          isLoading={loading}
          error={error && items.length === 0 ? { detail: risks.comments.loadError } : undefined}
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
        title={risks.comments.withdrawConfirm.title}
        description={risks.comments.withdrawConfirm.description}
        labels={{
          confirm: risks.comments.withdrawLabel,
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
