'use client';

/**
 * PharosGRC — the "Versões" section of a framework's detail screen (US1).
 * Loading, genuinely-empty and failed-to-load are three distinguishable
 * states, with a retry on failure (CLAUDE.md §18.11) — never a silent
 * empty list.
 */
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
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
import { usePermissions } from '@/lib/permissions';

import { complianceApi } from '../api';
import { formatTimestampDate } from '../date';
import {
  frameworkVersionStatusBadgeVariant,
  frameworkVersionStatusIcon,
  frameworkVersionStatusLabel,
} from '../status';

import type { FrameworkVersion } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface FrameworkVersionListSectionProps {
  frameworkId: string;
}

export function FrameworkVersionListSection({
  frameworkId,
}: FrameworkVersionListSectionProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [versions, setVersions] = useState<readonly FrameworkVersion[]>([]);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  // `loading` is DERIVED from comparing the in-flight request's key against
  // the last one that actually resolved — never a separate `setLoading(true)`
  // at the top of the effect — mirroring `FrameworkListView`/
  // `ControlCatalogView`'s own convention, which avoids the
  // `react-hooks/set-state-in-effect` cascading-render pattern entirely.
  const requestKey = `${frameworkId}|${reloadToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    complianceApi
      .listFrameworkVersions(frameworkId, { page: 1, pageSize: 100 })
      .then((page) => {
        if (cancelled) return;
        setVersions(page.data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from `frameworkId`/`reloadToken`, both already listed.
  }, [frameworkId, reloadToken]);

  const canAdminister = hasPermission('compliance:administer');
  const newVersionAction = canAdminister ? (
    <Button asChild size="sm">
      <Link href={`/compliance/${frameworkId}/versions/new`}>
        <Plus aria-hidden="true" className="size-4" />
        {compliance.frameworkDetail.versions.createAction}
      </Link>
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {compliance.frameworkDetail.versions.description}
        </p>
        {newVersionAction}
      </div>

      {loading ? (
        <LoadingState variant="table" rows={4} label={compliance.versionDetail.loading} />
      ) : error ? (
        <ErrorState
          problem={error}
          message={compliance.frameworkDetail.versions.loadError}
          action={
            <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
              {common.actions.retry}
            </Button>
          }
        />
      ) : versions.length === 0 ? (
        <EmptyState
          variant="empty"
          title={compliance.frameworkDetail.versions.empty.title}
          description={compliance.frameworkDetail.versions.empty.description}
          action={
            canAdminister ? (
              <Button asChild>
                <Link href={`/compliance/${frameworkId}/versions/new`}>
                  {compliance.frameworkDetail.versions.empty.createAction}
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <caption className="sr-only">{compliance.frameworkDetail.versions.tableCaption}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>{compliance.frameworkDetail.versions.columns.label}</TableHead>
              <TableHead>{compliance.frameworkDetail.versions.columns.status}</TableHead>
              <TableHead>{compliance.frameworkDetail.versions.columns.publishedAt}</TableHead>
              <TableHead>{compliance.frameworkDetail.versions.columns.updatedAt}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((version) => (
              <TableRow key={version.id}>
                <TableCell>
                  <Link
                    href={`/compliance/${frameworkId}/versions/${version.id}`}
                    className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {version.label}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    variant={frameworkVersionStatusBadgeVariant(version.status)}
                    label={frameworkVersionStatusLabel(version.status)}
                    icon={frameworkVersionStatusIcon(version.status)}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {version.publishedAt ? formatTimestampDate(version.publishedAt) : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTimestampDate(version.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
