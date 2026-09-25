'use client';

import { MetricCard, PharosLoader, useDelayedVisibility } from '@pharos/design-system/components';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { reports } from '@/lib/messages/reports';

import { reportsApi } from '../api';
import { formatTimestamp } from '../date';
import { REPORT_METRIC_ICON } from '../metric-visuals';
import { buildReportItemMetricCardValue } from '../report-metric-card-value';

import type { ReportDefinition, ReportRunResult } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface ReportRunDialogProps {
  report: ReportDefinition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportRunDialog({
  report,
  open,
  onOpenChange,
}: ReportRunDialogProps): React.JSX.Element {
  const { scope } = useAuth();
  const [result, setResult] = useState<ReportRunResult | null>(null);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const requestKey = `${report.id}|${reloadToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = open && resolvedRequestKey !== requestKey;
  const showLoader = useDelayedVisibility(loading);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    reportsApi
      .run(report.id)
      .then((run) => {
        if (cancelled) return;
        setResult(run);
        setError(undefined);
        setResolvedRequestKey(requestKey);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setResult(null);
        if (caught instanceof ApiError) {
          setError({
            title: caught.problem.title,
            detail: caught.problem.detail,
            correlationId: caught.problem.correlationId,
          });
        } else {
          setError({});
        }
        setResolvedRequestKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` inclui `report.id` e `reloadToken`; `open` é controlado pela guarda.
  }, [open, requestKey]);

  const csvUrl = reportsApi.buildRunCsvUrl(report.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{report.name}</DialogTitle>
          <DialogDescription>
            {report.description || reports.run.dialogDescriptionFallback}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center py-12">
              {showLoader ? <PharosLoader variant="inline" label={reports.run.loading} /> : null}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm font-medium text-status-danger-fg">
                {error.title ?? reports.run.loadError}
              </p>
              {error.detail ? (
                <p className="text-sm text-muted-foreground">{error.detail}</p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => setReloadToken((token) => token + 1)}
              >
                {common.actions.retry}
              </Button>
            </div>
          ) : result ? (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                {reports.run.computedAtLabel(formatTimestamp(result.computedAt))}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {result.items.map((item) => (
                  <MetricCard
                    key={item.metricKey}
                    label={item.label}
                    orgUnitLabel={reports.run.scopeLabel(item.scopeApplicability, scope.global)}
                    icon={REPORT_METRIC_ICON[item.metricKey]}
                    value={buildReportItemMetricCardValue(item)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button asChild variant="outline">
            <a
              href={csvUrl}
              aria-label={reports.run.csvExport.accessibleLabel(report.name)}
              className="inline-flex items-center gap-1.5"
            >
              <Download aria-hidden="true" className="size-4" />
              {reports.run.csvExport.action}
            </a>
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {reports.run.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
