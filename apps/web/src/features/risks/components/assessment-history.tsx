'use client';

/**
 * PharosGRC — risk detail, assessment history (T131, US4, FR-064 to FR-068,
 * ADR-006, ADR-007, Constitution VI — audit defensibility).
 *
 * Lists every assessment ever recorded for the risk, newest first, exactly
 * as `GET /risks/{riskId}/assessments` returns them — an immutable,
 * append-only record (ADR-007): a reassessment is never rendered as
 * replacing a row here, only as adding one. Each row shows who assessed it,
 * when, and how the RESIDUAL level moved relative to the assessment it
 * superseded (`levelChange`, FR-066) — computed and returned by the server,
 * never recomputed in this component (ADR-006). A reassessment that lands
 * on the same level as before still gets its own row with an explicit
 * "Permaneceu em X" line: deliberately not collapsed as noise, because a
 * risk manager re-confirming a level unchanged is itself an auditable fact.
 *
 * Pagination is a real "Carregar mais" control, not an unbounded single
 * fetch — a long-lived risk can accumulate more assessments than fit one
 * page, and Constitution VI's audit-defensibility promise would be hollow
 * if this list silently truncated at whatever the first page happened to
 * hold.
 */
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { risks } from '@/lib/messages/risks';

import { risksApi } from '../api';
import { formatDateOnly } from '../date';

import type { RiskAssessment } from '../types';

export interface AssessmentHistoryProps {
  riskId: string;
  /** Bump this to force a re-fetch from page 1 (e.g. right after a new assessment was recorded elsewhere on the page). */
  refreshToken?: number;
}

const PAGE_SIZE = 20;

function levelChangeText(assessment: RiskAssessment): string {
  const { levelChange } = assessment;
  if (levelChange.direction === null || levelChange.previousResidualLevel === null) {
    return risks.assessment.history.change.first;
  }
  const previousLabel = risks.riskLevelBadge.levelName(levelChange.previousResidualLevel);
  const currentLabel = risks.riskLevelBadge.levelName(assessment.residualLevel);
  if (levelChange.direction === 'INCREASED') {
    return risks.assessment.history.change.increased(previousLabel, currentLabel);
  }
  if (levelChange.direction === 'DECREASED') {
    return risks.assessment.history.change.decreased(previousLabel, currentLabel);
  }
  return risks.assessment.history.change.unchanged(currentLabel);
}

export function AssessmentHistory({
  riskId,
  refreshToken = 0,
}: AssessmentHistoryProps): React.JSX.Element {
  const [items, setItems] = useState<readonly RiskAssessment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  // Derived, not an explicit `setLoading(true)` at the top of the effect
  // (which would be a synchronous `setState` inside the effect body,
  // `react-hooks/set-state-in-effect`) — mirrors `risk-register-view.tsx`'s
  // own `resolvedRequestKey`/`loading` pattern: "loading" simply means "the
  // last request this effect resolved doesn't match what `riskId`/
  // `refreshToken` call for right now".
  const requestKey = `${riskId}|${refreshToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    risksApi
      .listAssessments(riskId, 1, PAGE_SIZE)
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
      const result = await risksApi.listAssessments(riskId, nextPage, PAGE_SIZE);
      setItems((current) => [...current, ...result.data]);
      setPage(nextPage);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{risks.assessment.history.cardTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{risks.assessment.history.cardDescription}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">{risks.assessment.history.loading}</p>
        ) : error && items.length === 0 ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {risks.assessment.history.loadError}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{risks.assessment.history.empty}</p>
        ) : (
          <>
            <Table>
              <TableCaption className="sr-only">{risks.assessment.history.cardTitle}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{risks.assessment.history.columns.assessedOn}</TableHead>
                  <TableHead>{risks.assessment.history.columns.assessedBy}</TableHead>
                  <TableHead>{risks.assessment.history.columns.inherent}</TableHead>
                  <TableHead>{risks.assessment.history.columns.residual}</TableHead>
                  <TableHead>{risks.assessment.history.columns.change}</TableHead>
                  <TableHead>{risks.assessment.history.columns.rationale}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateOnly(assessment.assessedOn)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {assessment.assessedBy.fullName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {assessment.inherentScore} —{' '}
                      {risks.riskLevelBadge.levelName(assessment.inherentLevel)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {assessment.residualScore} —{' '}
                      {risks.riskLevelBadge.levelName(assessment.residualLevel)}
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal">
                      {levelChangeText(assessment)}
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap">
                      {assessment.rationale ?? risks.assessment.history.noRationale}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {page < totalPages ? (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : null}
                  {risks.assessment.history.loadMore}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
