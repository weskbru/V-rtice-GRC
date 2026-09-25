'use client';

import { EmptyState, ErrorState, LoadingState } from '@pharos/design-system/components';
import { GitMerge } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';

import { complianceApi } from '../api';
import { formatTimestamp } from '../date';

import { MappingMigrationDialog } from './mapping-migration-dialog';

import type { MappingMigrationSummary } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface MappingMigrationPanelProps {
  frameworkId: string;
  versionId: string;
  canMap: boolean;
  onMigrated?: () => void;
}

export function MappingMigrationPanel({
  frameworkId,
  versionId,
  canMap,
  onMigrated,
}: MappingMigrationPanelProps): React.JSX.Element {
  const [rows, setRows] = useState<readonly MappingMigrationSummary[]>([]);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const requestKey = `${versionId}|${reloadToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    complianceApi
      .listMappingMigrations(frameworkId, versionId, 1, 25)
      .then((page) => {
        if (cancelled) return;
        setRows(page.data);
        setError(undefined);
        setResolvedRequestKey(requestKey);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva das dependências listadas.
  }, [frameworkId, versionId, reloadToken]);

  function handleExecuted(): void {
    setReloadToken((token) => token + 1);
    onMigrated?.();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {compliance.mappingMigration.sectionDescription}
        </p>
        {canMap ? (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <GitMerge aria-hidden="true" className="size-4" />
            {compliance.mappingMigration.newAction}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <LoadingState variant="table" rows={3} label={compliance.mappingMigration.loadingResults} />
      ) : error ? (
        <ErrorState
          problem={error}
          message={compliance.mappingMigration.loadError}
          action={
            <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
              {common.actions.retry}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="empty"
          title={compliance.mappingMigration.empty}
          action={
            canMap ? (
              <Button onClick={() => setDialogOpen(true)}>
                {compliance.mappingMigration.newAction}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <caption className="sr-only">{compliance.mappingMigration.tableCaption}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{compliance.mappingMigration.columns.source}</TableHead>
                <TableHead>{compliance.mappingMigration.columns.executedBy}</TableHead>
                <TableHead>{compliance.mappingMigration.columns.executedAt}</TableHead>
                <TableHead>{compliance.mappingMigration.columns.copied}</TableHead>
                <TableHead>{compliance.mappingMigration.columns.pending}</TableHead>
                <TableHead>{compliance.mappingMigration.columns.skipped}</TableHead>
                <TableHead className="sr-only">
                  {compliance.mappingMigration.viewDetailAction}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((migration) => (
                <TableRow key={migration.id}>
                  <TableCell className="font-medium text-foreground">
                    {migration.sourceFrameworkVersion.label}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {migration.executedBy.fullName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatTimestamp(migration.executedAt)}
                  </TableCell>
                  <TableCell>{migration.copiedCount}</TableCell>
                  <TableCell>{migration.pendingDecisionCount}</TableCell>
                  <TableCell>{migration.skippedAlreadyMappedCount}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        href={`/compliance/${frameworkId}/versions/${versionId}/mapping-migrations/${migration.id}`}
                      >
                        {compliance.mappingMigration.viewDetailAction}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MappingMigrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        frameworkId={frameworkId}
        targetVersionId={versionId}
        onExecuted={handleExecuted}
      />
    </div>
  );
}
