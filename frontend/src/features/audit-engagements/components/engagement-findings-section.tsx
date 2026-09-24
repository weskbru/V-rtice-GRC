'use client';

import { EmptyState, ErrorState, StatusBadge } from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { findings as findingsMessages } from '@/lib/messages/findings';

import { auditEngagementsApi } from '../api';

import { EngagementFindingCreateDialog } from './engagement-finding-create-dialog';

import type { AuditEngagementStatus, FindingSummary } from '../types';

const { findingsFromEngagement } = auditEngagements;

const PAGE_SIZE = 100;

const STATUS_VARIANT: Record<FindingSummary['status'], 'info' | 'warning' | 'success' | 'neutral'> =
  {
    OPEN: 'info',
    IN_REMEDIATION: 'warning',
    CLOSED: 'success',
    ARCHIVED: 'neutral',
  };

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export interface EngagementFindingsSectionProps {
  engagementId: string;
  engagementStatus: AuditEngagementStatus;
  canCreate: boolean;
  defaultOwnerUserId: string;
}

export function EngagementFindingsSection({
  engagementId,
  engagementStatus,
  canCreate,
  defaultOwnerUserId,
}: EngagementFindingsSectionProps): React.JSX.Element {
  const [items, setItems] = useState<readonly FindingSummary[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${engagementId}|${reloadToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    auditEngagementsApi
      .listEngagementFindings(engagementId, { page: 1, pageSize: PAGE_SIZE })
      .then((page) => {
        if (!cancelled) {
          setItems(page.data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setResolvedRequestKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from `engagementId`/`reloadToken`, both already listed.
  }, [engagementId, reloadToken]);

  function retry(): void {
    setReloadToken((token) => token + 1);
  }

  function addItem(created: FindingSummary): void {
    setItems((current) => [created, ...current]);
  }

  const canRecordNow = canCreate && engagementStatus === 'IN_PROGRESS';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{auditEngagements.detail.sections.findings}</CardTitle>
          <CardDescription>{findingsFromEngagement.sectionDescription}</CardDescription>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!canRecordNow}>
            <Plus aria-hidden="true" className="size-4" />
            {findingsFromEngagement.newAction}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {canCreate && !canRecordNow ? (
          <p className="text-sm text-muted-foreground">
            {findingsFromEngagement.notInProgressNotice}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">{findingsFromEngagement.loading}</p>
        ) : loadError ? (
          <ErrorState
            problem={{ title: findingsFromEngagement.loadError }}
            action={
              <Button size="sm" variant="outline" onClick={retry}>
                {auditEngagements.register.retryAction}
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState variant="empty" title={findingsFromEngagement.empty} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">
                {auditEngagements.aria.findingsRegionLabel}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{findingsFromEngagement.columns.code}</TableHead>
                  <TableHead>{findingsFromEngagement.columns.title}</TableHead>
                  <TableHead>{findingsFromEngagement.columns.category}</TableHead>
                  <TableHead>{findingsFromEngagement.columns.severity}</TableHead>
                  <TableHead>{findingsFromEngagement.columns.priority}</TableHead>
                  <TableHead>{findingsFromEngagement.columns.status}</TableHead>
                  <TableHead>{findingsFromEngagement.columns.identifiedOn}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap font-medium text-foreground">
                      {item.code}
                    </TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {findingsMessages.categoryLabels[item.category]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {findingsMessages.severityLabels[item.severity]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {findingsMessages.priorityLabels[item.priority]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <StatusBadge
                        variant={STATUS_VARIANT[item.status]}
                        label={findingsMessages.statusLabels[item.status]}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateOnly(item.identifiedOn)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {canCreate ? (
        <EngagementFindingCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          auditId={engagementId}
          defaultOwnerUserId={defaultOwnerUserId}
          onCreated={addItem}
        />
      ) : null}
    </Card>
  );
}
